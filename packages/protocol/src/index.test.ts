import { describe, expect, it } from 'vitest';
import {
  isClientMessage,
  isServerMessage,
  type ClientMessage,
  type ServerMessage,
} from './index';

describe('isClientMessage', () => {
  const valid: ClientMessage[] = [
    { type: 'audio_chunk', data: 'AAAA' },
    { type: 'interrupt' },
    { type: 'ping' },
    { type: 'popup_status', allowed: true },
    { type: 'popup_status', allowed: false },
  ];

  it.each(valid)('accepts a well-formed $type message', (message) => {
    expect(isClientMessage(message)).toBe(true);
  });

  it('rejects an audio chunk with no payload', () => {
    // The server forwards `data` straight to Gemini, so an empty or absent
    // string must not slip through as a valid message.
    expect(isClientMessage({ type: 'audio_chunk' })).toBe(false);
    expect(isClientMessage({ type: 'audio_chunk', data: '' })).toBe(false);
    expect(isClientMessage({ type: 'audio_chunk', data: 42 })).toBe(false);
  });

  it('rejects popup_status without a boolean verdict', () => {
    // `allowed: "false"` would otherwise be truthy and wrongly authorise a popup.
    expect(isClientMessage({ type: 'popup_status', allowed: 'false' })).toBe(false);
    expect(isClientMessage({ type: 'popup_status' })).toBe(false);
  });

  it('rejects unknown types and non-objects', () => {
    expect(isClientMessage({ type: 'drop_tables' })).toBe(false);
    expect(isClientMessage(null)).toBe(false);
    expect(isClientMessage('ping')).toBe(false);
    expect(isClientMessage(undefined)).toBe(false);
  });

  it('does not accept a server message', () => {
    expect(isClientMessage({ type: 'session_ready' })).toBe(false);
  });
});

describe('isServerMessage', () => {
  const valid: ServerMessage[] = [
    { type: 'session_ready' },
    { type: 'audio_chunk', data: 'AAAA' },
    { type: 'transcript', text: 'hello', role: 'user', isFinal: true },
    { type: 'transcript', text: '', role: 'model', isFinal: false },
    { type: 'interrupted' },
    { type: 'turn_complete' },
    { type: 'error', message: 'boom' },
    { type: 'pong' },
    { type: 'open_url', url: 'https://github.com/x', name: 'github' },
    { type: 'send_mailto', mailtoUrl: 'mailto:a@b.c' },
    { type: 'check_popup' },
  ];

  it.each(valid)('accepts a well-formed $type message', (message) => {
    expect(isServerMessage(message)).toBe(true);
  });

  it('rejects a transcript with an unknown role', () => {
    expect(
      isServerMessage({ type: 'transcript', text: 'hi', role: 'system', isFinal: true }),
    ).toBe(false);
  });

  it('rejects open_url without a URL', () => {
    // The client passes `url` to window.open(); an empty value must not reach it.
    expect(isServerMessage({ type: 'open_url', name: 'github' })).toBe(false);
    expect(isServerMessage({ type: 'open_url', url: '', name: 'github' })).toBe(false);
  });

  it('rejects an error message whose detail is not a string', () => {
    expect(isServerMessage({ type: 'error', message: { code: 500 } })).toBe(false);
  });
});
