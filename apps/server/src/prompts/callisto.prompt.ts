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
