// ─── Shared WebSocket Types ─────────────────────────────────────────────────

/** Messages sent from the browser client to the server */
export interface ClientMessage {
  type: 'audio_chunk' | 'interrupt' | 'ping' | 'popup_status';
  /** Base64-encoded PCM16 audio at 16 kHz — present when type === 'audio_chunk' */
  data?: string;
  /** Whether popups are allowed — present when type === 'popup_status' */
  allowed?: boolean;
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
    | 'pong'
    | 'open_url'
    | 'send_mailto'
    | 'check_popup';
  /** URL to open in a new tab — present when type === 'open_url' */
  url?: string;
  /** Contact name — present when type === 'open_url' */
  contact?: string;
  /** Full mailto: URL — present when type === 'send_mailto' */
  mailtoUrl?: string;
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
