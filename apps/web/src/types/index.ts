// ─── Shared Frontend Types ────────────────────────────────────────────────────

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface Turn {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

/** Messages received from the Callisto Node WebSocket server */
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
  /** Base64-encoded PCM16 at 24 kHz — present when type === 'audio_chunk' */
  data?: string;
  text?: string;
  role?: 'user' | 'model';
  isFinal?: boolean;
  message?: string;
  /** URL to open — present when type === 'open_url' */
  url?: string;
  /** Contact name — present when type === 'open_url' */
  contact?: string;
  /** Full mailto: URL — present when type === 'send_mailto' */
  mailtoUrl?: string;
}
