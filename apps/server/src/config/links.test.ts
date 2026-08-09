import { afterEach, describe, expect, it } from 'vitest';
import { getLinks, renderLinksForPrompt } from './links';

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

function setLinks(value: unknown): void {
  process.env.CALLISTO_LINKS = typeof value === 'string' ? value : JSON.stringify(value);
}

describe('getLinks', () => {
  it('parses a configured list into ids, names, descriptions and urls', () => {
    setLinks([
      { name: 'Portfolio Site', description: 'The main portfolio', url: 'https://example.com' },
    ]);

    expect(getLinks()).toEqual([
      {
        id: 'portfolio_site',
        name: 'Portfolio Site',
        description: 'The main portfolio',
        url: 'https://example.com',
      },
    ]);
  });

  it('accepts the capitalised keys a hand-written .env is likely to use', () => {
    // The format is documented with lowercase keys, but this value is typed by
    // a human into a file with no schema in front of it.
    setLinks([{ Name: 'GitHub', Description: 'The repos', Url: 'https://github.com/x' }]);
    expect(getLinks()[0]?.id).toBe('github');
    expect(getLinks()[0]?.description).toBe('The repos');
  });

  it('treats unset or blank as "no links", not as an error', () => {
    delete process.env.CALLISTO_LINKS;
    expect(getLinks()).toEqual([]);

    process.env.CALLISTO_LINKS = '   ';
    expect(getLinks()).toEqual([]);
  });

  it('throws an actionable error rather than dropping a malformed entry', () => {
    // Silently skipping would mean a link that does nothing at the exact moment
    // a visitor asks to see it — the failure has to happen at startup instead.
    setLinks('not json at all');
    expect(() => getLinks()).toThrow(/CALLISTO_LINKS/);

    setLinks({ name: 'GitHub' });
    expect(() => getLinks()).toThrow(/JSON array/);

    setLinks([{ name: 'GitHub', url: 'https://github.com/x' }]);
    expect(() => getLinks()).toThrow(/description/);

    setLinks([{ description: 'no name', url: 'https://github.com/x' }]);
    expect(() => getLinks()).toThrow(/name/);
  });

  it('rejects a url that is not http(s)', () => {
    // These URLs reach window.open() in the visitor's browser. A javascript:
    // value there would execute in the opening page.
    setLinks([{ name: 'Bad', description: 'nope', url: 'javascript:alert(1)' }]);
    expect(() => getLinks()).toThrow(/http\(s\)/);
  });

  it('rejects two entries that resolve to the same id', () => {
    // Matching is case-insensitive, so "GitHub" and "github" would both answer
    // to the same request and only one could ever win.
    setLinks([
      { name: 'GitHub', description: 'one', url: 'https://github.com/a' },
      { name: 'github', description: 'two', url: 'https://github.com/b' },
    ]);
    expect(() => getLinks()).toThrow(/same name/);
  });

  it('keeps names that differ only by spacing apart', () => {
    // "GitHub" and "Git Hub" are different ids (github, git_hub), so both are
    // addressable — spacing is normalised, not discarded.
    setLinks([
      { name: 'GitHub', description: 'one', url: 'https://github.com/a' },
      { name: 'Git Hub', description: 'two', url: 'https://github.com/b' },
    ]);
    expect(getLinks().map((l) => l.id)).toEqual(['github', 'git_hub']);
  });
});

describe('renderLinksForPrompt', () => {
  it('lists names, ids and descriptions but never the urls', () => {
    // Callisto speaks her answers. A URL read aloud helps nobody, and inviting
    // her to recite one is how she ends up spelling out a domain.
    const rendered = renderLinksForPrompt([
      { id: 'github', name: 'GitHub', description: 'The repos', url: 'https://github.com/x' },
    ]);

    expect(rendered).toContain('GitHub');
    expect(rendered).toContain('github');
    expect(rendered).toContain('The repos');
    expect(rendered).not.toContain('https://github.com/x');
  });

  it('renders nothing at all when there are no links', () => {
    // An empty section header would still be tokens the model has to read, and
    // an "AVAILABLE LINKS" heading with nothing under it invites invention.
    expect(renderLinksForPrompt([])).toBe('');
  });
});
