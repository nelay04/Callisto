import { describe, expect, it } from 'vitest';
import { SessionLimiter, clientIpFrom, isOriginAllowed } from './gate';

const ALLOWED = ['http://localhost:3000', 'https://callisto.example.com'];

describe('isOriginAllowed', () => {
  it('accepts an origin on the list', () => {
    expect(isOriginAllowed('https://callisto.example.com', ALLOWED)).toBe(true);
  });

  it('rejects an origin that is not on the list', () => {
    expect(isOriginAllowed('https://evil.example.com', ALLOWED)).toBe(false);
  });

  it('rejects a missing Origin header', () => {
    // Browsers always send Origin, so a blank one is what stops an arbitrary
    // page from opening a socket and draining the Gemini quota.
    expect(isOriginAllowed(undefined, ALLOWED)).toBe(false);
    expect(isOriginAllowed('', ALLOWED)).toBe(false);
  });

  it('tolerates a trailing slash on either side', () => {
    expect(isOriginAllowed('https://callisto.example.com/', ALLOWED)).toBe(true);
  });

  it('does not treat a subdomain or prefix as a match', () => {
    expect(isOriginAllowed('https://callisto.example.com.evil.net', ALLOWED)).toBe(false);
    expect(isOriginAllowed('http://localhost:30000', ALLOWED)).toBe(false);
  });
});

describe('clientIpFrom', () => {
  it('falls back to the socket address when there is no proxy header', () => {
    expect(clientIpFrom(undefined, '10.0.0.5')).toBe('10.0.0.5');
  });

  it('prefers the left-most X-Forwarded-For entry', () => {
    // The left-most entry is the original client; later ones are proxies.
    expect(clientIpFrom('203.0.113.7, 10.0.0.1', '10.0.0.1')).toBe('203.0.113.7');
  });

  it('handles a repeated header arriving as an array', () => {
    expect(clientIpFrom(['203.0.113.7', '10.0.0.1'], '10.0.0.1')).toBe('203.0.113.7');
  });

  it('reports "unknown" rather than empty when nothing identifies the client', () => {
    expect(clientIpFrom(undefined, undefined)).toBe('unknown');
    expect(clientIpFrom('', undefined)).toBe('unknown');
  });
});

describe('SessionLimiter', () => {
  it('admits clients up to the limit and refuses the next one', () => {
    const limiter = new SessionLimiter(2);
    const ip = '203.0.113.7';

    expect(limiter.canAccept(ip)).toBe(true);
    limiter.acquire(ip);
    expect(limiter.canAccept(ip)).toBe(true);
    limiter.acquire(ip);
    expect(limiter.canAccept(ip)).toBe(false);
  });

  it('admits again once a session is released', () => {
    const limiter = new SessionLimiter(1);
    limiter.acquire('a');
    expect(limiter.canAccept('a')).toBe(false);

    limiter.release('a');
    expect(limiter.canAccept('a')).toBe(true);
  });

  it('counts each client independently', () => {
    const limiter = new SessionLimiter(1);
    limiter.acquire('a');

    expect(limiter.canAccept('a')).toBe(false);
    expect(limiter.canAccept('b')).toBe(true);
  });

  it('does not go negative when release is called more than acquire', () => {
    // A socket can emit close after an error path already released it; that
    // must not leave a negative count that grants unlimited future sessions.
    const limiter = new SessionLimiter(1);
    limiter.acquire('a');
    limiter.release('a');
    limiter.release('a');

    expect(limiter.countFor('a')).toBe(0);
    limiter.acquire('a');
    expect(limiter.canAccept('a')).toBe(false);
  });

  it('forgets clients with no sessions so the map cannot grow unbounded', () => {
    const limiter = new SessionLimiter(5);
    limiter.acquire('a');
    limiter.release('a');

    expect(limiter.countFor('a')).toBe(0);
  });
});
