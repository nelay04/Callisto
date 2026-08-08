/**
 * The WebSocket wire format lives in `@callisto/protocol` so the browser and
 * this server cannot drift apart. Re-exported here for convenient local imports.
 */
export type {
  ClientMessage,
  ServerMessage,
  TranscriptRole,
} from '@callisto/protocol';
