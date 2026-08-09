import { GoogleGenAI, type LiveServerMessage, type Session } from '@google/genai';
import type { TranscriptRole } from '@callisto/protocol';
import { GEMINI_MODEL, getGeminiLiveConfig } from '../config/gemini';
import { getGreetingPrompt } from '../prompts/callisto.prompt';
import { resolveContactUrl } from '../tools/openUrl.tool';
import { buildMailtoUrl } from '../tools/mailto.tool';

/**
 * Wraps a single Gemini Live API session.
 * Wire up the public callbacks before calling connect().
 */
export class GeminiService {
  private readonly ai: GoogleGenAI;
  private session: Session | null = null;

  // ── Event Callbacks ──────────────────────────────────────────────────────
  public onReady: () => void = () => {};
  public onAudioChunk: (base64PCM: string) => void = () => {};
  public onTranscript: (text: string, role: TranscriptRole, isFinal: boolean) => void = () => {};
  public onInterrupted: () => void = () => {};
  public onTurnComplete: () => void = () => {};
  public onError: (err: Error) => void = () => {};
  public onClose: () => void = () => {};
  /** Fired when the model calls the open_url tool. Provides the resolved URL. */
  public onOpenUrl: (url: string, contact: string) => void = () => {};
  /** Fired when the model calls the send_mailto tool. Provides the full mailto: URL. */
  public onSendMailto: (mailtoUrl: string) => void = () => {};
  /** Fired when the model calls check_popup. Caller must later invoke resolveCheckPopup(). */
  public onCheckPopup: (callId: string) => void = () => {};

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /** Establish a Gemini Live session. Resolves when the session object is returned
   *  (onReady fires asynchronously via the onopen callback). */
  async connect(): Promise<void> {
    this.session = await this.ai.live.connect({
      model: GEMINI_MODEL,
      config: getGeminiLiveConfig(),
      callbacks: {
        onopen: () => this.onReady(),
        onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
        onclose: () => this.onClose(),
        onerror: (e: unknown) => this.onError(new Error(String(e))),
      },
    });

    // Make Callisto speak first. This has to happen *after* the await, not in
    // onopen: the SDK fires onopen just before connect() resolves, so at that
    // point this.session is still null and the turn would be dropped silently.
    const greeting = getGreetingPrompt();
    if (greeting) this.sendTextTurn(greeting);
  }

  /**
   * Send a text turn as the user and close it, so the model responds
   * immediately. Used for the greeting; audio input goes through sendAudio().
   *
   * Unlike audio, this produces no inputTranscription, so the text never
   * surfaces in the visitor's transcript panel.
   */
  sendTextTurn(text: string): void {
    this.session?.sendClientContent({
      turns: [{ role: 'user', parts: [{ text }] }],
      turnComplete: true,
    });
  }

  /** Send a base64-encoded PCM16 audio chunk (16 kHz mono) to Gemini. */
  sendAudio(base64PCM: string): void {
    this.session?.sendRealtimeInput({
      media: { data: base64PCM, mimeType: 'audio/pcm;rate=16000' },
    });
  }

  /**
   * Resolve a pending check_popup tool call once the frontend has reported
   * whether popups are allowed. Must be called in response to onCheckPopup.
   */
  resolveCheckPopup(callId: string, allowed: boolean): void {
    this.session?.sendToolResponse({
      functionResponses: [{
        id: callId,
        name: 'check_popup',
        response: { output: { popupsAllowed: allowed } },
      }],
    });
  }

  /** Tear down the session. Safe to call multiple times. */
  disconnect(): void {
    try {
      this.session?.close?.();
    } catch {
      // ignore close errors
    }
    this.session = null;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private handleMessage(msg: LiveServerMessage): void {
    // 1. Audio output from Gemini (PCM16 at 24 kHz, base64-encoded)
    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData) {
      this.onAudioChunk(audioData);
    }

    // 2. User speech transcription
    const inputText = msg.serverContent?.inputTranscription?.text;
    if (inputText) {
      this.onTranscript(inputText, 'user', true);
    }

    // 3. Model speech transcription
    const outputText = msg.serverContent?.outputTranscription?.text;
    if (outputText) {
      this.onTranscript(outputText, 'model', true);
    }

    // 4. Interruption signal
    if (msg.serverContent?.interrupted) {
      this.onInterrupted();
    }

    // 5. Turn complete
    if (msg.serverContent?.turnComplete) {
      this.onTurnComplete();
    }

    // 6. Tool / function calls from the model
    const functionCalls = msg.toolCall?.functionCalls;
    if (functionCalls?.length) {
      for (const call of functionCalls) {
        if (call.name === 'open_url') {
          const contact = (call.args as Record<string, string>)?.contact?.toLowerCase();
          const url = resolveContactUrl(contact);

          this.session?.sendToolResponse({
            functionResponses: [{
              id: call.id,
              name: call.name,
              response: url
                ? { output: { success: true, opened: contact } }
                : { output: { success: false, error: `Unknown contact: ${contact}` } },
            }],
          });

          if (url) this.onOpenUrl(url, contact);

        } else if (call.name === 'send_mailto') {
          const args = call.args as Record<string, string> | undefined ?? {};
          const mailtoUrl = buildMailtoUrl(args.subject, args.body);

          this.session?.sendToolResponse({
            functionResponses: [{
              id: call.id,
              name: call.name,
              response: { output: { success: true } },
            }],
          });

          this.onSendMailto(mailtoUrl);

        } else if (call.name === 'check_popup') {
          // Response is deferred — the controller will call resolveCheckPopup()
          // once the frontend reports back via popup_status message.
          this.onCheckPopup(call.id ?? '');
        }
      }
    }
  }
}
