import type { Turn, TranscriptRole } from '@/types';

/**
 * Fold a streaming transcript fragment into the running list of turns.
 *
 * Gemini emits transcripts as a stream of small fragments rather than whole
 * utterances, so consecutive fragments from the same speaker are merged into
 * one turn — otherwise the panel fills with one-word rows. A new turn starts
 * when the speaker changes, or when `forceFresh` is set (the caller sets it
 * after a `turn_complete`, so a follow-up from the same speaker is treated as
 * a separate utterance rather than being appended to the previous one).
 *
 * Pure and immutable: the input array is never mutated, so this is safe to use
 * directly inside a React state updater.
 */
export function appendTranscript(
  turns: readonly Turn[],
  fragment: { role: TranscriptRole; text: string },
  forceFresh: boolean,
  now: Date = new Date(),
): Turn[] {
  const last = turns[turns.length - 1];

  if (!last || last.role !== fragment.role || forceFresh) {
    return [...turns, { role: fragment.role, text: fragment.text, timestamp: now }];
  }

  // Gemini's fragments carry their own leading/trailing spaces inconsistently;
  // insert one only when neither side already has it.
  const needsSpace = !last.text.endsWith(' ') && !fragment.text.startsWith(' ');
  const merged: Turn = {
    ...last,
    text: last.text + (needsSpace ? ' ' : '') + fragment.text,
  };

  return [...turns.slice(0, -1), merged];
}
