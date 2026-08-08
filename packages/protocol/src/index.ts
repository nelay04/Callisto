/**
 * Callisto WebSocket wire format.
 *
 * This is the single source of truth for every message crossing the socket
 * between the browser (`@callisto/web`) and the session server
 * (`@callisto/server`). Both sides import from here, so the two ends of the
 * connection cannot drift apart without a type error.
 *
 * Audio is always base64-encoded signed 16-bit little-endian PCM, mono:
 *   - client → server at 16 kHz (what Gemini Live expects as input)
 *   - server → client at 24 kHz (what Gemini Live emits)
 */

/** Who produced a transcript segment. */
export type TranscriptRole = 'user' | 'model';

// ─── Client → Server ─────────────────────────────────────────────────────────

/** A chunk of microphone audio: base64 PCM16 @ 16 kHz mono. */
export interface AudioChunkRequest {
  type: 'audio_chunk';
  data: string;
}

/**
 * Explicit barge-in signal.
 *
 * Gemini Live detects interruptions from the realtime audio stream on its own,
 * so this is currently a no-op reserved for clients that want to cut the model
 * off without speaking.
 */
export interface InterruptRequest {
  type: 'interrupt';
}

/** Liveness probe; the server replies with {@link PongMessage}. */
export interface PingRequest {
  type: 'ping';
}

/**
 * The client's answer to {@link CheckPopupMessage}: whether the browser will
 * let us call `window.open()`. Resolves the model's pending `check_popup`
 * tool call.
 */
export interface PopupStatusRequest {
  type: 'popup_status';
  allowed: boolean;
}

/** Any message the browser may send to the server. */
export type ClientMessage =
  | AudioChunkRequest
  | InterruptRequest
  | PingRequest
  | PopupStatusRequest;

// ─── Server → Client ─────────────────────────────────────────────────────────

/** The Gemini Live session is open and ready for audio. */
export interface SessionReadyMessage {
  type: 'session_ready';
}

/** A chunk of synthesised speech: base64 PCM16 @ 24 kHz mono. */
export interface AudioChunkMessage {
  type: 'audio_chunk';
  data: string;
}

/** A streaming transcript fragment for either side of the conversation. */
export interface TranscriptMessage {
  type: 'transcript';
  text: string;
  role: TranscriptRole;
  /** Whether this fragment closes the segment. */
  isFinal: boolean;
}

/** The user spoke over the model — the client should stop playback immediately. */
export interface InterruptedMessage {
  type: 'interrupted';
}

/** The model finished its turn; the next transcript starts a new turn. */
export interface TurnCompleteMessage {
  type: 'turn_complete';
}

/** Something went wrong server-side. `message` is safe to surface to the user. */
export interface ErrorMessage {
  type: 'error';
  message: string;
}

/** Reply to {@link PingRequest}. */
export interface PongMessage {
  type: 'pong';
}

/** The model invoked `open_url`; the client should open `url` in a new tab. */
export interface OpenUrlMessage {
  type: 'open_url';
  url: string;
  /** Which profile was resolved, e.g. `"github"`. */
  contact: string;
}

/** The model invoked `send_mailto`; the client should navigate to `mailtoUrl`. */
export interface SendMailtoMessage {
  type: 'send_mailto';
  mailtoUrl: string;
}

/**
 * The model wants to open a tab and needs to know whether popups are blocked.
 *
 * The server defers the model's tool response until the client answers with
 * {@link PopupStatusRequest} — the one place in the protocol where a single
 * tool call spans a full round trip to the browser.
 */
export interface CheckPopupMessage {
  type: 'check_popup';
}

/** Any message the server may send to the browser. */
export type ServerMessage =
  | SessionReadyMessage
  | AudioChunkMessage
  | TranscriptMessage
  | InterruptedMessage
  | TurnCompleteMessage
  | ErrorMessage
  | PongMessage
  | OpenUrlMessage
  | SendMailtoMessage
  | CheckPopupMessage;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Validate an unknown parsed payload as a `ClientMessage`.
 *
 * Both ends of this socket are ours, but the server end is publicly reachable,
 * so it validates the full payload — not just the discriminant. A handler that
 * has passed this guard can use its fields without further checks.
 */
export function isClientMessage(value: unknown): value is ClientMessage {
  if (!isRecord(value)) return false;

  switch (value.type) {
    case 'audio_chunk':
      return isNonEmptyString(value.data);
    case 'interrupt':
    case 'ping':
      return true;
    case 'popup_status':
      return typeof value.allowed === 'boolean';
    default:
      return false;
  }
}

/** Validate an unknown parsed payload as a `ServerMessage`. */
export function isServerMessage(value: unknown): value is ServerMessage {
  if (!isRecord(value)) return false;

  switch (value.type) {
    case 'session_ready':
    case 'interrupted':
    case 'turn_complete':
    case 'pong':
    case 'check_popup':
      return true;
    case 'audio_chunk':
      return isNonEmptyString(value.data);
    case 'transcript':
      return (
        typeof value.text === 'string' &&
        (value.role === 'user' || value.role === 'model') &&
        typeof value.isFinal === 'boolean'
      );
    case 'error':
      return typeof value.message === 'string';
    case 'open_url':
      return isNonEmptyString(value.url) && typeof value.contact === 'string';
    case 'send_mailto':
      return isNonEmptyString(value.mailtoUrl);
    default:
      return false;
  }
}
