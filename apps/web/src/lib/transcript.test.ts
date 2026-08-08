import { describe, expect, it } from 'vitest';
import { appendTranscript } from './transcript';
import type { Turn } from '@/types';

const AT = new Date('2026-01-01T00:00:00Z');

const turn = (role: Turn['role'], text: string): Turn => ({ role, text, timestamp: AT });

describe('appendTranscript', () => {
  it('starts the first turn', () => {
    const result = appendTranscript([], { role: 'user', text: 'hello' }, false, AT);

    expect(result).toEqual([turn('user', 'hello')]);
  });

  it('merges consecutive fragments from the same speaker', () => {
    // Gemini streams transcripts word by word; without merging, the panel would
    // render one row per fragment.
    const result = appendTranscript(
      [turn('user', 'hello')],
      { role: 'user', text: 'world' },
      false,
      AT,
    );

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('hello world');
  });

  it('does not double up whitespace the fragments already carry', () => {
    expect(
      appendTranscript([turn('model', 'hello ')], { role: 'model', text: 'world' }, false, AT)[0]
        .text,
    ).toBe('hello world');

    expect(
      appendTranscript([turn('model', 'hello')], { role: 'model', text: ' world' }, false, AT)[0]
        .text,
    ).toBe('hello world');
  });

  it('starts a new turn when the speaker changes', () => {
    const result = appendTranscript(
      [turn('user', 'hello')],
      { role: 'model', text: 'hi' },
      false,
      AT,
    );

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual(turn('model', 'hi'));
  });

  it('starts a new turn when forceFresh is set, even for the same speaker', () => {
    // The caller sets this after `turn_complete`, so a second question from the
    // user is a separate bubble rather than being glued to the first.
    const result = appendTranscript(
      [turn('user', 'first question')],
      { role: 'user', text: 'second question' },
      true,
      AT,
    );

    expect(result).toHaveLength(2);
    expect(result[1].text).toBe('second question');
  });

  it('keeps the timestamp of the turn it merges into', () => {
    const earlier = new Date('2026-01-01T00:00:00Z');
    const later = new Date('2026-01-01T00:00:05Z');
    const result = appendTranscript(
      [{ role: 'user', text: 'hello', timestamp: earlier }],
      { role: 'user', text: 'world' },
      false,
      later,
    );

    expect(result[0].timestamp).toBe(earlier);
  });

  it('never mutates the input array or its turns', () => {
    // The result feeds a React state updater, so shared references would cause
    // missed re-renders.
    const original = [turn('user', 'hello')];
    const snapshot = [{ ...original[0] }];

    appendTranscript(original, { role: 'user', text: 'world' }, false, AT);

    expect(original).toEqual(snapshot);
  });
});
