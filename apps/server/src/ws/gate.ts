/**
 * Admission control for WebSocket upgrades.
 *
 * Every accepted socket opens a Gemini Live session, which bills against the
 * project's quota. Because the endpoint is public, it needs two cheap guards
 * before that happens: the request must come from a known origin, and no single
 * client may hold more than a handful of sessions at once.
 *
 * Both guards are exported as plain functions/classes so they can be tested
 * without standing up a server.
 */

/**
 * Whether `origin` is in the allow-list.
 *
 * A missing Origin header means a non-browser client (curl, a native app, a
 * load-balancer health check). Browsers always send one, so rejecting the
 * blank case is what actually stops a random web page from opening a socket.
 * Trailing slashes are normalised because `CORS_ORIGIN` is hand-written.
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowed: readonly string[],
): boolean {
  if (!origin) return false;
  return allowed.includes(origin.replace(/\/$/, ''));
}

/**
 * Extract the client IP, preferring the left-most `X-Forwarded-For` entry when
 * running behind a reverse proxy. Falls back to the socket address.
 */
export function clientIpFrom(
  forwardedFor: string | string[] | undefined,
  remoteAddress: string | undefined,
): string {
  const header = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const first = header?.split(',')[0]?.trim();
  return first || remoteAddress || 'unknown';
}

/** Tracks concurrent sessions per client IP. */
export class SessionLimiter {
  private readonly counts = new Map<string, number>();

  constructor(private readonly maxPerIp: number) {}

  /** Whether `ip` is under the limit right now. */
  canAccept(ip: string): boolean {
    return (this.counts.get(ip) ?? 0) < this.maxPerIp;
  }

  /** Record a new session for `ip`. */
  acquire(ip: string): void {
    this.counts.set(ip, (this.counts.get(ip) ?? 0) + 1);
  }

  /** Record a session for `ip` ending. Safe to call more than once. */
  release(ip: string): void {
    const next = (this.counts.get(ip) ?? 0) - 1;
    if (next > 0) {
      this.counts.set(ip, next);
    } else {
      // Delete rather than store zero, so the map can't grow without bound.
      this.counts.delete(ip);
    }
  }

  /** Current session count for `ip`. Exposed for tests and diagnostics. */
  countFor(ip: string): number {
    return this.counts.get(ip) ?? 0;
  }
}
