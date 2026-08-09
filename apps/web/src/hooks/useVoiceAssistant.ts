'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isServerMessage } from '@callisto/protocol';
import { ConnectionState, type Turn, type ClientMessage } from '@/types';
import { createPcmBase64, decodeBase64ToPCM } from '@/lib/audioUtils';
import { appendTranscript } from '@/lib/transcript';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://127.0.0.1:3013/ws/session';

interface VoiceAssistantState {
  connectionState: ConnectionState;
  transcripts: Turn[];
  inputVolume: number;
  outputVolume: number;
  /** Spectral centroid 0–1: proxy for dominant pitch (higher = brighter/higher pitch). */
  inputPitch: number;
  outputPitch: number;
  /**
   * Bumped each time the model asks for the orb flourish. A counter rather than
   * a boolean so a second request retriggers the animation instead of being
   * swallowed as "already true".
   */
  scatterToken: number;
}

export function useVoiceAssistant() {
  const [state, setState] = useState<VoiceAssistantState>({
    connectionState: ConnectionState.DISCONNECTED,
    transcripts: [],
    inputVolume: 0,
    outputVolume: 0,
    inputPitch: 0,
    outputPitch: 0,
    scatterToken: 0,
  });

  // ── Refs (avoid stale closures in audio callbacks) ───────────────────────
  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const analyserInRef = useRef<AnalyserNode | null>(null);
  const analyserOutRef = useRef<AnalyserNode | null>(null);
  const volumeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track connectionState without making it a dep of stable callbacks
  const connectionStateRef = useRef<ConnectionState>(ConnectionState.DISCONNECTED);

  // Always-current reference to the message handler (avoids stale closure on ws.onmessage)
  const handleMessageRef = useRef<(raw: string) => void>(() => {});

  // When true, the next transcript — even with the same role — starts a fresh turn
  const forceFreshTurnRef = useRef(false);

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Send a protocol message, silently dropping it if the socket isn't open. */
  const sendToServer = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify(message));
  }, []);

  const setConnectionState = useCallback((s: ConnectionState) => {
    connectionStateRef.current = s;
    setState((prev) => ({ ...prev, connectionState: s }));
  }, []);

  const stopVolumePolling = useCallback(() => {
    if (volumeTimerRef.current) {
      clearInterval(volumeTimerRef.current);
      volumeTimerRef.current = null;
    }
  }, []);

  const startVolumePolling = useCallback(() => {
    stopVolumePolling();
    volumeTimerRef.current = setInterval(() => {
      let inVol = 0, outVol = 0, inPitch = 0, outPitch = 0;

      if (analyserInRef.current) {
        const buf = new Uint8Array(analyserInRef.current.frequencyBinCount);
        analyserInRef.current.getByteFrequencyData(buf);
        let total = 0, weighted = 0;
        for (let i = 0; i < buf.length; i++) { total += buf[i]; weighted += i * buf[i]; }
        inVol = total / buf.length / 255;
        // Spectral centroid as pitch proxy; gate on minimum energy to avoid noise
        inPitch = total > buf.length * 5 ? weighted / (total * buf.length) : 0;
      }

      if (analyserOutRef.current) {
        const buf = new Uint8Array(analyserOutRef.current.frequencyBinCount);
        analyserOutRef.current.getByteFrequencyData(buf);
        let total = 0, weighted = 0;
        for (let i = 0; i < buf.length; i++) { total += buf[i]; weighted += i * buf[i]; }
        outVol = total / buf.length / 255;
        outPitch = total > buf.length * 5 ? weighted / (total * buf.length) : 0;
      }

      setState((prev) => ({ ...prev, inputVolume: inVol, outputVolume: outVol, inputPitch: inPitch, outputPitch: outPitch }));
    }, 50);
  }, [stopVolumePolling]);

  const teardown = useCallback(() => {
    stopVolumePolling();

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    sourcesRef.current.forEach((s) => {
      try { s.stop(); } catch { /* ignore */ }
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    inputCtxRef.current?.close().catch(() => {});
    inputCtxRef.current = null;

    outputCtxRef.current?.close().catch(() => {});
    outputCtxRef.current = null;

    analyserInRef.current = null;
    analyserOutRef.current = null;

    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent the onclose callback from firing teardown again
      wsRef.current.close();
      wsRef.current = null;
    }

    setState((prev) => ({ ...prev, inputVolume: 0, outputVolume: 0, inputPitch: 0, outputPitch: 0 }));
  }, [stopVolumePolling]);

  // ── Message Handler ──────────────────────────────────────────────────────

  const handleMessage = useCallback(
    (raw: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.error('Failed to parse server message');
        return;
      }

      if (!isServerMessage(parsed)) {
        console.warn('Ignoring unrecognised message from server');
        return;
      }
      const msg = parsed;

      switch (msg.type) {
        case 'session_ready':
          setConnectionState(ConnectionState.CONNECTED);
          break;

        case 'audio_chunk': {
          if (!msg.data || !outputCtxRef.current) break;

          // Lazily create the output analyser chain
          if (!analyserOutRef.current) {
            analyserOutRef.current = outputCtxRef.current.createAnalyser();
            analyserOutRef.current.fftSize = 256;
            analyserOutRef.current.connect(outputCtxRef.current.destination);
          }

          try {
            const buffer = decodeBase64ToPCM(msg.data, outputCtxRef.current, 24000);
            const source = outputCtxRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(analyserOutRef.current);

            nextStartTimeRef.current = Math.max(
              nextStartTimeRef.current,
              outputCtxRef.current.currentTime,
            );
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;

            sourcesRef.current.add(source);
            source.addEventListener('ended', () => sourcesRef.current.delete(source));
          } catch (e) {
            console.error('Failed to decode audio chunk:', e);
          }
          break;
        }

        case 'transcript': {
          if (!msg.text) break;
          // Read and clear the flag *outside* setState — the updater must stay
          // pure, since React may invoke it more than once.
          const fresh = forceFreshTurnRef.current;
          forceFreshTurnRef.current = false;
          const fragment = { role: msg.role, text: msg.text };
          setState((prev) => ({
            ...prev,
            transcripts: appendTranscript(prev.transcripts, fragment, fresh),
          }));
          break;
        }

        case 'turn_complete':
          // Mark that the next transcript message should open a new turn
          forceFreshTurnRef.current = true;
          break;

        case 'interrupted':
          sourcesRef.current.forEach((s) => { try { s.stop(); } catch { /* ignore */ } });
          sourcesRef.current.clear();
          nextStartTimeRef.current = 0;
          break;

        case 'open_url':
          if (msg.url) {
            window.open(msg.url, '_blank', 'noopener,noreferrer');
          }
          break;

        case 'scatter_orb':
          setState((prev) => ({ ...prev, scatterToken: prev.scatterToken + 1 }));
          break;

        case 'send_mailto':
          if (msg.mailtoUrl) {
            // Use a hidden anchor click — avoids navigating the current page
            const a = document.createElement('a');
            a.href = msg.mailtoUrl;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
          break;

        case 'check_popup': {
          // NOTE: do NOT pass noopener here — it makes window.open() return null
          // even when popups are allowed, causing a false "blocked" result.
          const testWin = window.open('about:blank', '_blank');
          const allowed = testWin !== null;
          if (testWin) testWin.close();
          sendToServer({ type: 'popup_status', allowed });
          break;
        }

        case 'pong':
          // Liveness reply; receiving it is the whole point, nothing to do.
          break;

        case 'error':
          console.error('Server error:', msg.message);
          setConnectionState(ConnectionState.ERROR);
          break;

        // Adding a ServerMessage variant without handling it above fails to
        // compile here, rather than being silently dropped at runtime.
        default: {
          const unhandled: never = msg;
          console.warn('Unhandled server message:', unhandled);
          break;
        }
      }
    },
    [setConnectionState, sendToServer],
  );

  // Keep the ref in sync with the latest handler
  useEffect(() => {
    handleMessageRef.current = handleMessage;
  }, [handleMessage]);

  // ── Public API ───────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    const cs = connectionStateRef.current;
    if (cs !== ConnectionState.DISCONNECTED && cs !== ConnectionState.ERROR) return;

    setConnectionState(ConnectionState.CONNECTING);
    setState((prev) => ({ ...prev, transcripts: [] }));

    try {
      // Create audio contexts — browser requires user gesture, which this satisfies
      inputCtxRef.current = new AudioContext({ sampleRate: 16000 });
      outputCtxRef.current = new AudioContext({ sampleRate: 24000 });

      // Request microphone access
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      // WebSocket
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        handleMessageRef.current(event.data as string);
      };

      ws.onclose = () => {
        teardown();
        setConnectionState(ConnectionState.DISCONNECTED);
      };

      ws.onerror = () => {
        setConnectionState(ConnectionState.ERROR);
        teardown();
      };

      // Microphone → ScriptProcessor → WebSocket pipeline
      const inputCtx = inputCtxRef.current;
      const micSource = inputCtx.createMediaStreamSource(mediaStreamRef.current);

      analyserInRef.current = inputCtx.createAnalyser();
      analyserInRef.current.fftSize = 256;
      micSource.connect(analyserInRef.current);

      // ScriptProcessor is deprecated but universally supported.
      // For production, consider upgrading to AudioWorklet.
      const processor = inputCtx.createScriptProcessor(2048, 1, 1);
      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        sendToServer({ type: 'audio_chunk', data: createPcmBase64(float32) });
      };

      analyserInRef.current.connect(processor);
      // Connect to destination to keep the processor alive (required by some browsers)
      processor.connect(inputCtx.destination);

      startVolumePolling();
    } catch (err) {
      console.error('Failed to connect:', err);
      teardown();
      setConnectionState(ConnectionState.ERROR);
    }
  }, [setConnectionState, teardown, startVolumePolling, sendToServer]);

  const disconnect = useCallback(() => {
    teardown();
    setConnectionState(ConnectionState.DISCONNECTED);
  }, [teardown, setConnectionState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { teardown(); };
  }, [teardown]);

  return {
    connectionState: state.connectionState,
    transcripts: state.transcripts,
    inputVolume: state.inputVolume,
    outputVolume: state.outputVolume,
    inputPitch: state.inputPitch,
    outputPitch: state.outputPitch,
    scatterToken: state.scatterToken,
    connect,
    disconnect,
    isConnected: state.connectionState === ConnectionState.CONNECTED,
    isConnecting: state.connectionState === ConnectionState.CONNECTING,
  };
}
