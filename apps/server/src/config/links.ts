/**
 * The links Callisto can talk about and open.
 *
 * One `CALLISTO_LINKS` variable replaces the old per-profile `LINKEDIN_URL` /
 * `GITHUB_URL` pair: adding a portfolio site, a CV, a case study or a demo is
 * an edit to `.env`, not a change to TypeScript and a rebuild. The description
 * travels with each entry, so the model can explain a link as well as open it.
 */

/** One configured destination, after parsing and validation. */
export interface CallistoLink {
  /** Lowercase identifier the model passes to `open_url`. Derived from `name`. */
  id: string;
  /** Human spelling, used when Callisto refers to the link out loud. */
  name: string;
  /** What the link is, in the operator's words. Spoken, so keep it a phrase. */
  description: string;
  url: string;
}

/** Shape accepted from JSON, before validation. Keys are matched case-insensitively. */
type RawLink = Record<string, unknown>;

const ENV_KEY = 'CALLISTO_LINKS';

function fail(detail: string): never {
  throw new Error(
    `Invalid ${ENV_KEY}: ${detail}. Expected a single-line JSON array, e.g. ` +
      '[{"name":"GitHub","description":"Repositories behind the work","url":"https://github.com/you"}]',
  );
}

/** Case-insensitive field read, so `Name`, `name` and `NAME` all work. */
function field(raw: RawLink, key: string): unknown {
  const match = Object.keys(raw).find((k) => k.toLowerCase() === key);
  return match === undefined ? undefined : raw[match];
}

function requireString(raw: RawLink, key: string, index: number): string {
  const value = field(raw, key);

  if (typeof value !== 'string' || !value.trim()) {
    fail(`entry ${index} is missing a non-empty "${key}"`);
  }

  return value.trim();
}

/**
 * Slug the model sees. Spaces become underscores because a function-call enum
 * value with a space in it is a reliable way to get a near-miss back from the
 * model.
 */
function toId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parse and validate `CALLISTO_LINKS`.
 *
 * Read on every call rather than at import time, matching the system prompt:
 * the result must not depend on whether dotenv happened to run first.
 *
 * Unset or blank yields an empty list — Callisto simply has nothing to open.
 * Anything malformed throws, because the alternative is a link that silently
 * does nothing at the exact moment a visitor asks to see the work.
 */
export function getLinks(): CallistoLink[] {
  const raw = process.env[ENV_KEY];

  if (!raw?.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail('not valid JSON');
  }

  if (!Array.isArray(parsed)) fail('not a JSON array');

  const links = parsed.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      fail(`entry ${index} is not an object`);
    }

    const item = entry as RawLink;
    const name = requireString(item, 'name', index);
    const url = requireString(item, 'url', index);

    // Only http(s) reaches window.open(). These URLs come from the operator's
    // own .env rather than from a visitor, but a stray `javascript:` here would
    // execute in the page that opened it, so the scheme is checked rather than
    // assumed.
    if (!/^https?:\/\//i.test(url)) {
      fail(`entry ${index} ("${name}") has a url that is not http(s)`);
    }

    return {
      id: toId(name),
      name,
      description: requireString(item, 'description', index),
      url,
    };
  });

  const seen = new Set<string>();
  for (const link of links) {
    if (seen.has(link.id)) {
      fail(`two entries resolve to the same name ("${link.id}")`);
    }
    seen.add(link.id);
  }

  return links;
}

/**
 * Resolve what the model asked for to a URL, or `undefined` when it named
 * something that is not configured.
 *
 * Matching is case- and separator-insensitive: the value arrives from a
 * language model, which will say `GitHub` or `github profile` when the
 * configured id is `github`.
 */
export function resolveLinkUrl(name: string | undefined): string | undefined {
  if (!name?.trim()) return undefined;

  const wanted = toId(name.trim());
  return getLinks().find((link) => link.id === wanted)?.url;
}

/**
 * The links, rendered for the system instruction.
 *
 * Descriptions go to the model as prose rather than only as tool metadata, so
 * Callisto can talk about a link without being asked to open it. URLs are
 * deliberately omitted — she speaks her answers, and reading one aloud helps
 * nobody.
 */
export function renderLinksForPrompt(links: CallistoLink[] = getLinks()): string {
  if (links.length === 0) return '';

  const lines = links.map((l) => `- ${l.name} (id: ${l.id}) — ${l.description}`);

  return [
    '',
    '══════════════════════════════════════════',
    '  AVAILABLE LINKS',
    '══════════════════════════════════════════',
    '',
    'These are the destinations you can describe, and open with the open_url',
    'tool when the visitor explicitly asks. Pass the id exactly as written.',
    'Never read a URL out loud — offer to open it instead.',
    '',
    ...lines,
  ].join('\n');
}
