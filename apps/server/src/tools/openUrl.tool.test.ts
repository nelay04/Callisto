import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getOpenUrlDeclaration, resolveLinkUrl } from './openUrl.tool';

const ORIGINAL = { ...process.env };

const LINKS = JSON.stringify([
  { name: 'GitHub', description: 'Repositories behind the work', url: 'https://github.com/example' },
  { name: 'LinkedIn', description: 'Professional history', url: 'https://www.linkedin.com/in/example' },
  { name: 'Portfolio Site', description: 'The main portfolio', url: 'https://example.com' },
]);

beforeEach(() => {
  process.env.CALLISTO_LINKS = LINKS;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('resolveLinkUrl', () => {
  it('resolves every configured link', () => {
    expect(resolveLinkUrl('github')).toBe('https://github.com/example');
    expect(resolveLinkUrl('linkedin')).toBe('https://www.linkedin.com/in/example');
    expect(resolveLinkUrl('portfolio_site')).toBe('https://example.com');
  });

  it('is case- and separator-insensitive, since the value comes from a language model', () => {
    expect(resolveLinkUrl('GitHub')).toBe('https://github.com/example');
    expect(resolveLinkUrl('Portfolio Site')).toBe('https://example.com');
    expect(resolveLinkUrl('  portfolio   site  ')).toBe('https://example.com');
  });

  it('returns undefined for anything not configured', () => {
    expect(resolveLinkUrl('twitter')).toBeUndefined();
    expect(resolveLinkUrl(undefined)).toBeUndefined();
    expect(resolveLinkUrl('')).toBeUndefined();
  });

  it('returns undefined when no links are configured at all', () => {
    delete process.env.CALLISTO_LINKS;
    expect(resolveLinkUrl('github')).toBeUndefined();
  });

  it('reads the environment on each call, not at import time', () => {
    process.env.CALLISTO_LINKS = JSON.stringify([
      { name: 'GitHub', description: 'Changed', url: 'https://github.com/changed' },
    ]);
    expect(resolveLinkUrl('github')).toBe('https://github.com/changed');
  });
});

describe('getOpenUrlDeclaration', () => {
  it('constrains the enum to the configured ids', () => {
    // The enum is what stops the model inventing a destination that was never
    // published — it must track .env, not a list frozen in this file.
    const declaration = getOpenUrlDeclaration();
    expect(declaration?.parameters?.properties?.name?.enum).toEqual([
      'github',
      'linkedin',
      'portfolio_site',
    ]);
  });

  it('carries each description into the tool metadata', () => {
    // Descriptions are how the model knows a link is worth offering at all.
    expect(getOpenUrlDeclaration()?.description).toContain('Repositories behind the work');
    expect(getOpenUrlDeclaration()?.description).toContain('The main portfolio');
  });

  it('is withheld entirely when nothing is configured', () => {
    // An enum with no members is a parameter the model cannot legally fill, so
    // the tool is dropped rather than offered as a dead end.
    delete process.env.CALLISTO_LINKS;
    expect(getOpenUrlDeclaration()).toBeUndefined();

    process.env.CALLISTO_LINKS = '[]';
    expect(getOpenUrlDeclaration()).toBeUndefined();
  });
});
