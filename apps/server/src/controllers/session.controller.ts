import { WebSocket } from 'ws';
import { isClientMessage } from '@callisto/protocol';
import { GeminiService } from '../services/gemini.service';
import { config } from '../config';
import type { ServerMessage } from '../types';

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
  // Stores the pending check_popup tool call id until the frontend responds
  let pendingPopupCheckCallId: string | null = null;

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

  gemini.onOpenUrl = (url, name) => {
    console.log(`Tool: open_url → ${name} (${url})`);
    send(ws, { type: 'open_url', url, name });
  };

  gemini.onSendMailto = (mailtoUrl) => {
    console.log(`Tool: send_mailto → ${mailtoUrl}`);
    send(ws, { type: 'send_mailto', mailtoUrl });
  };

  gemini.onScatterOrb = () => {
    console.log('Tool: scatter_orb');
    send(ws, { type: 'scatter_orb' });
  };

  gemini.onCheckPopup = (callId) => {
    pendingPopupCheckCallId = callId;
    send(ws, { type: 'check_popup' });
  };

  // Start the Gemini session
  gemini.connect().catch((err: Error) => {
    console.error('Failed to connect to Gemini:', err.message);
    send(ws, { type: 'error', message: 'Failed to establish Gemini session.' });
    ws.close();
  });

  // ── Handle messages from the browser ───────────────────────────────────

  ws.on('message', (rawData: Buffer) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData.toString());
    } catch (err) {
      console.error('Failed to parse client message:', err);
      return;
    }

    if (!isClientMessage(parsed)) {
      console.warn('Ignoring unrecognised message from client');
      return;
    }

    switch (parsed.type) {
      case 'audio_chunk':
        gemini.sendAudio(parsed.data);
        break;

      case 'interrupt':
        // Gemini Live handles barge-in automatically via real-time audio input.
        // Reserved for explicit client-side interruption signals if needed.
        break;

      case 'ping':
        send(ws, { type: 'pong' });
        break;

      case 'popup_status':
        if (pendingPopupCheckCallId !== null) {
          gemini.resolveCheckPopup(pendingPopupCheckCallId, parsed.allowed);
          pendingPopupCheckCallId = null;
        }
        break;

      // Adding a ClientMessage variant without handling it above fails to
      // compile here, rather than being silently dropped at runtime.
      default: {
        const unhandled: never = parsed;
        console.warn('Unhandled client message:', unhandled);
        break;
      }
    }
  });

  // ── Teardown ────────────────────────────────────────────────────────────

  ws.on('close', () => {
    console.log('Client disconnected');
    gemini.disconnect();
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    gemini.disconnect();
  });
}
