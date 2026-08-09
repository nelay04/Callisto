import { afterEach, describe, expect, it } from 'vitest';
import { getDefaultLanguage, renderLanguagePolicy } from './language.prompt';

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('getDefaultLanguage', () => {
  it('reads and trims the configured language', () => {
    process.env.CALLISTO_LANGUAGE = '  Bengali  ';
    expect(getDefaultLanguage()).toBe('Bengali');
  });

  it('falls back to English only when nothing is set', () => {
    // The fallback exists so an unconfigured deployment still opens in a
    // definite language rather than letting the model pick per session.
    delete process.env.CALLISTO_LANGUAGE;
    expect(getDefaultLanguage()).toBe('English');

    process.env.CALLISTO_LANGUAGE = '   ';
    expect(getDefaultLanguage()).toBe('English');
  });

  it('reads the environment on each call, not at import time', () => {
    process.env.CALLISTO_LANGUAGE = 'Hindi';
    expect(getDefaultLanguage()).toBe('Hindi');

    process.env.CALLISTO_LANGUAGE = 'Bengali';
    expect(getDefaultLanguage()).toBe('Bengali');
  });
});

describe('renderLanguagePolicy', () => {
  it('names the configured language rather than a hardcoded one', () => {
    process.env.CALLISTO_LANGUAGE = 'Bengali';
    const policy = renderLanguagePolicy();

    expect(policy).toContain('Speak Bengali');
    expect(policy).not.toMatch(/Speak English/);
  });

  it('is always rendered — there is no way to switch it off', () => {
    // Unlike the architecture briefing, an absent language policy is not a
    // neutral default: the model drifts between languages without it.
    delete process.env.CALLISTO_LANGUAGE;
    expect(renderLanguagePolicy().length).toBeGreaterThan(0);
  });

  it('forbids switching on incidental cues, and requires it on request', () => {
    delete process.env.CALLISTO_LANGUAGE;
    const policy = renderLanguagePolicy();

    expect(policy).toMatch(/do not change language because/i);
    // Phrased generically rather than by example, so a request made in any
    // language and any wording is covered — "banglay bolo" included.
    expect(policy).toMatch(/in any wording/i);
    expect(policy).toMatch(/switch to it at once/i);
  });

  it('treats a language request as "they are not comfortable in this one"', () => {
    // A one-sentence translation followed by a drift back is the failure this
    // is written against.
    const policy = renderLanguagePolicy();

    expect(policy).toMatch(/they are not comfortable/i);
    expect(policy).toMatch(/do not drift back/i);
    expect(policy).toMatch(/one language per reply/i);
  });
});
