import { WebSocket } from 'ws';
import { GeminiService } from '../services/gemini.service';
import { config } from '../config';
import type { ClientMessage, ServerMessage } from '../types';

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Handles a single WebSocket connection from the frontend.
 * Creates a dedicated GeminiService per connection so sessions are isolated.
 */
export function handleSessionWebSocket(ws: WebSocket): void {
  console.log('Client connected');

  const gemini = new GeminiService(config.GEMINI_API_KEY);

  // ── Wire Gemini callbacks → WebSocket ──────────────────────────────────

  gemini.onReady = () => {
    console.log('Gemini session ready');
    send(ws, { type: 'session_ready' });
  };

  gemini.onAudioChunk = (data) => {
    send(ws, { type: 'audio_chunk', data });
  };

  gemini.onTranscript = (text, role, isFinal) => {
    send(ws, { type: 'transcript', text, role, isFinal });
  };

  gemini.onInterrupted = () => {
    send(ws, { type: 'interrupted' });
  };

  gemini.onTurnComplete = () => {
    send(ws, { type: 'turn_complete' });
  };

  gemini.onError = (err) => {
    console.error('Gemini error:', err.message);
    send(ws, { type: 'error', message: err.message });
  };

  gemini.onClose = () => {
    console.log('Gemini session closed by remote');
    ws.close();
  };

  // Start the Gemini session
  gemini.connect().catch((err: Error) => {
    console.error('Failed to connect to Gemini:', err.message);
    send(ws, { type: 'error', message: 'Failed to establish Gemini session.' });
    ws.close();
  });

  // ── Handle messages from the browser ───────────────────────────────────

  ws.on('message', (rawData: Buffer) => {
    try {
      const message = JSON.parse(rawData.toString()) as ClientMessage;

      switch (message.type) {
        case 'audio_chunk':
          if (message.data) {
            gemini.sendAudio(message.data);
          }
          break;

        case 'interrupt':
          // Gemini Live handles barge-in automatically via real-time audio input.
          // Reserved for explicit client-side interruption signals if needed.
          break;

        case 'ping':
          send(ws, { type: 'pong' });
          break;

        default:
          console.warn('Unknown message type from client:', (message as { type: string }).type);
      }
    } catch (err) {
      console.error('Failed to parse client message:', err);
    }
  });

  // ── Teardown ────────────────────────────────────────────────────────────

  ws.on('close', () => {
    console.log(' Client disconnected');
    gemini.disconnect();
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    gemini.disconnect();
  });
}
