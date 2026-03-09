'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConnectionState, type Turn, type ServerMessage } from '@/types';
import { createPcmBase64, decodeBase64ToPCM } from '@/lib/audioUtils';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws/session';

interface VoiceAssistantState {
  connectionState: ConnectionState;
  transcripts: Turn[];
  inputVolume: number;
  outputVolume: number;
}

export function useVoiceAssistant() {
  const [state, setState] = useState<VoiceAssistantState>({
    connectionState: ConnectionState.DISCONNECTED,
    transcripts: [],
    inputVolume: 0,
    outputVolume: 0,
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

  // ── Helpers ──────────────────────────────────────────────────────────────

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
      let inVol = 0;
      let outVol = 0;

      if (analyserInRef.current) {
        const buf = new Uint8Array(analyserInRef.current.frequencyBinCount);
        analyserInRef.current.getByteFrequencyData(buf);
        inVol = buf.reduce((a, b) => a + b, 0) / buf.length / 255;
      }

      if (analyserOutRef.current) {
        const buf = new Uint8Array(analyserOutRef.current.frequencyBinCount);
        analyserOutRef.current.getByteFrequencyData(buf);
        outVol = buf.reduce((a, b) => a + b, 0) / buf.length / 255;
      }

      setState((prev) => ({ ...prev, inputVolume: inVol, outputVolume: outVol }));
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

    setState((prev) => ({ ...prev, inputVolume: 0, outputVolume: 0 }));
  }, [stopVolumePolling]);

  // ── Message Handler ──────────────────────────────────────────────────────

  const handleMessage = useCallback(
    (raw: string) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(raw) as ServerMessage;
      } catch {
        console.error('Failed to parse server message');
        return;
      }

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

        case 'transcript':
          if (msg.text && msg.role) {
            setState((prev) => ({
              ...prev,
              transcripts: [
                ...prev.transcripts,
                { role: msg.role as 'user' | 'model', text: msg.text!, timestamp: new Date() },
              ],
            }));
          }
          break;

        case 'interrupted':
          sourcesRef.current.forEach((s) => { try { s.stop(); } catch { /* ignore */ } });
          sourcesRef.current.clear();
          nextStartTimeRef.current = 0;
          break;

        case 'error':
          console.error('Server error:', msg.message);
          setConnectionState(ConnectionState.ERROR);
          break;
      }
    },
    [setConnectionState],
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
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const base64 = createPcmBase64(float32);
        wsRef.current.send(JSON.stringify({ type: 'audio_chunk', data: base64 }));
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
  }, [setConnectionState, teardown, startVolumePolling]);

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
    connect,
    disconnect,
    isConnected: state.connectionState === ConnectionState.CONNECTED,
    isConnecting: state.connectionState === ConnectionState.CONNECTING,
  };
}
