// ─── Frontend-only types ─────────────────────────────────────────────────────
//
// The WebSocket wire format lives in `@callisto/protocol`, shared with the
// server. Only types that never cross the socket belong here.

export type {
  ClientMessage,
  ServerMessage,
  TranscriptRole,
} from '@callisto/protocol';

/** Lifecycle of the browser's connection to the session server. */
export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

/**
 * One contiguous block of speech from a single speaker, as rendered in the
 * transcript panel. Streaming `transcript` messages are merged into the
 * trailing turn until the speaker changes or the model's turn completes.
 */
export interface Turn {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}
