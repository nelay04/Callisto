import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveContactUrl } from './openUrl.tool';

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.LINKEDIN_URL = 'https://www.linkedin.com/in/example';
  process.env.GITHUB_URL = 'https://github.com/example';
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('resolveContactUrl', () => {
  it('resolves the configured profiles', () => {
    expect(resolveContactUrl('linkedin')).toBe('https://www.linkedin.com/in/example');
    expect(resolveContactUrl('github')).toBe('https://github.com/example');
  });

  it('is case-insensitive, since the value comes from a language model', () => {
    expect(resolveContactUrl('GitHub')).toBe('https://github.com/example');
    expect(resolveContactUrl('LinkedIn')).toBe('https://www.linkedin.com/in/example');
  });

  it('returns undefined for a profile we do not publish', () => {
    expect(resolveContactUrl('twitter')).toBeUndefined();
    expect(resolveContactUrl(undefined)).toBeUndefined();
    expect(resolveContactUrl('')).toBeUndefined();
  });

  it('returns undefined when the profile is known but unconfigured', () => {
    // Guards the deployment mistake this replaced: a misspelled env var used to
    // silently serve a placeholder URL instead of failing visibly.
    delete process.env.GITHUB_URL;
    expect(resolveContactUrl('github')).toBeUndefined();

    process.env.LINKEDIN_URL = '';
    expect(resolveContactUrl('linkedin')).toBeUndefined();
  });

  it('reads the environment on each call, not at import time', () => {
    process.env.GITHUB_URL = 'https://github.com/changed';
    expect(resolveContactUrl('github')).toBe('https://github.com/changed');
  });
});
