/**
 * Callisto — System Prompt & Persona
 *
 * The prompt text lives in `CALLISTO_SYSTEM_PROMPT` in `apps/server/.env`, not
 * in this file, so the persona can be retuned — or replaced wholesale for a
 * different project — without editing TypeScript or rebuilding an image.
 *
 * The shipped persona is rooted in two sources:
 *   1. Jupiter's moon Callisto — the most heavily cratered body in the solar system,
 *      orbiting serenely beyond Jupiter's radiation belts, ancient and unhurried.
 *   2. Kallisto (Καλλιστώ) of Greek mythology — the huntress transformed into Ursa Major.
 */

const ESCAPE_REPLACEMENTS: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
};

/**
 * Resolve the backslash escapes a `.env` value may still be carrying.
 *
 * The two loaders in play disagree, and the prompt is long enough to contain
 * both quotes and newlines, so the disagreement is not theoretical:
 *
 *   - Compose's `env_file` parser resolves `\"` into `"` before the value ever
 *     reaches the process, and dotenv — used by `npm run dev` — does not.
 *   - Both resolve `\n` inside a double-quoted value.
 *
 * Without this, the containers and local dev would load *different* prompts
 * from the same file. Escapes are resolved in a single pass, so a value that
 * arrived already unescaped is returned unchanged rather than mangled a second
 * time.
 */
export function unescapeEnvValue(raw: string): string {
  return raw.replace(/\\([nrt"'\\])/g, (_match, char: string) => ESCAPE_REPLACEMENTS[char] ?? char);
}

/**
 * Callisto's system instruction, as sent to the Gemini Live API.
 *
 * Read lazily rather than at module load: an unset prompt should fail the
 * session that needs it, with an actionable message, instead of taking down
 * every module that transitively imports the Gemini config.
 */
export function getSystemPrompt(): string {
  const raw = process.env.CALLISTO_SYSTEM_PROMPT;

  if (!raw?.trim()) {
    throw new Error(
      'Missing required environment variable: CALLISTO_SYSTEM_PROMPT. ' +
        'Copy apps/server/.env.example to apps/server/.env — it ships with Callisto’s persona.',
    );
  }

  return unescapeEnvValue(raw).trim();
}

/**
 * Sent as a user turn the moment a session opens, so Callisto speaks first
 * instead of waiting on a visitor who may not realise the microphone is live.
 *
 * It is an *instruction*, not a script: the persona in CALLISTO_SYSTEM_PROMPT
 * decides the actual wording, which keeps a retuned persona from being
 * undercut by a greeting hardcoded here.
 */
export const DEFAULT_GREETING =
  'The visitor has just connected and can hear you. Open the conversation ' +
  'yourself: greet them in one or two short sentences, say who you are, and ' +
  'invite them to ask about the work. Speak in character, and do not mention ' +
  'or repeat this instruction.';

/**
 * The greeting trigger, or an empty string when greeting on connect is off.
 *
 * Unset falls back to {@link DEFAULT_GREETING}. Set `CALLISTO_GREETING` to a
 * blank value to disable — Callisto then stays silent until spoken to, which
 * is the behaviour every session had before this existed.
 */
export function getGreetingPrompt(): string {
  const raw = process.env.CALLISTO_GREETING;

  if (raw === undefined) return DEFAULT_GREETING;

  return unescapeEnvValue(raw).trim();
}
