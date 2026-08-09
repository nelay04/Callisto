import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Parse a comma-separated origin list, dropping blanks and trailing slashes. */
function parseOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export const config = {
  PORT: parseInt(process.env.PORT ?? '3013', 10),
  /**
   * Interface to bind. Loopback by default so a dev server is not silently
   * exposed to the LAN; the container images set 0.0.0.0, because a published
   * port cannot reach a process listening only on the container's own
   * loopback. Host-side exposure stays on 127.0.0.1 via the compose files.
   */
  HOST: process.env.HOST ?? '127.0.0.1',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  /** Origins permitted for both CORS and WebSocket upgrades. */
  CORS_ORIGIN: parseOrigins(
    process.env.CORS_ORIGIN ?? 'http://127.0.0.1:3012,http://localhost:3012',
  ),
  /**
   * Maximum concurrent Gemini sessions per client IP. Each session bills against
   * the Gemini quota, so this is the cheapest guard against a public endpoint
   * being drained by one caller.
   */
  MAX_SESSIONS_PER_IP: parseInt(process.env.MAX_SESSIONS_PER_IP ?? '3', 10),
  get GEMINI_API_KEY() {
    return requireEnv('GEMINI_API_KEY');
  },
  get MAILTO_ADDRESS() {
    return requireEnv('MAILTO_ADDRESS');
  },
} as const;

export { parseOrigins, requireEnv };
