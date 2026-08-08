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
  PORT: parseInt(process.env.PORT ?? '3001', 10),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  /** Origins permitted for both CORS and WebSocket upgrades. */
  CORS_ORIGIN: parseOrigins(process.env.CORS_ORIGIN ?? 'http://localhost:3000'),
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
