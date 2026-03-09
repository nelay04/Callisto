import { GoogleGenAI, type LiveServerMessage } from '@google/genai';
import { GEMINI_MODEL, GEMINI_LIVE_CONFIG } from '../config/gemini';

type TranscriptRole = 'user' | 'model';

/**
 * Wraps a single Gemini Live API session.
 * Wire up the public callbacks before calling connect().
 */
export class GeminiService {
  private readonly ai: GoogleGenAI;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private session: any = null;

  // ── Event Callbacks ──────────────────────────────────────────────────────
  public onReady: () => void = () => {};
  public onAudioChunk: (base64PCM: string) => void = () => {};
  public onTranscript: (text: string, role: TranscriptRole, isFinal: boolean) => void = () => {};
  public onInterrupted: () => void = () => {};
  public onTurnComplete: () => void = () => {};
  public onError: (err: Error) => void = () => {};
  public onClose: () => void = () => {};

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /** Establish a Gemini Live session. Resolves when the session object is returned
   *  (onReady fires asynchronously via the onopen callback). */
  async connect(): Promise<void> {
    this.session = await this.ai.live.connect({
      model: GEMINI_MODEL,
      config: GEMINI_LIVE_CONFIG,
      callbacks: {
        onopen: () => this.onReady(),
        onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
        onclose: () => this.onClose(),
        onerror: (e: unknown) => this.onError(new Error(String(e))),
      },
    });
  }

  /** Send a base64-encoded PCM16 audio chunk (16 kHz mono) to Gemini. */
  sendAudio(base64PCM: string): void {
    this.session?.sendRealtimeInput({
      media: { data: base64PCM, mimeType: 'audio/pcm;rate=16000' },
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
  }
}
