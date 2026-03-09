// ─── Shared WebSocket Types ─────────────────────────────────────────────────

/** Messages sent from the browser client to the server */
export interface ClientMessage {
  type: 'audio_chunk' | 'interrupt' | 'ping';
  /** Base64-encoded PCM16 audio at 16 kHz — present when type === 'audio_chunk' */
  data?: string;
}

/** Messages sent from the server to the browser client */
export interface ServerMessage {
  type:
    | 'session_ready'
    | 'audio_chunk'
    | 'transcript'
    | 'interrupted'
    | 'turn_complete'
    | 'error'
    | 'pong';
  /** Base64-encoded PCM16 audio at 24 kHz — present when type === 'audio_chunk' */
  data?: string;
  /** Transcript text — present when type === 'transcript' */
  text?: string;
  /** Who spoke — present when type === 'transcript' */
  role?: 'user' | 'model';
  /** Whether the transcript segment is finalised */
  isFinal?: boolean;
  /** Error detail — present when type === 'error' */
  message?: string;
}
