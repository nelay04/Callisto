import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_GREETING,
  getGreetingPrompt,
  getSystemPrompt,
  unescapeEnvValue,
} from './callisto.prompt';

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('unescapeEnvValue', () => {
  it('resolves the escapes dotenv leaves behind', () => {
    // dotenv expands \n but not \", so a prompt loaded by `npm run dev` arrives
    // with literal backslashes in front of every inner quote.
    expect(unescapeEnvValue('say \\"hi\\"')).toBe('say "hi"');
    expect(unescapeEnvValue('one\\ntwo')).toBe('one\ntwo');
  });

  it('leaves an already-unescaped value untouched', () => {
    // Compose resolves \" itself, so the container sees real quotes and real
    // newlines. The same code path must be a no-op for that input.
    const alreadyClean = 'say "hi"\nand "bye"';
    expect(unescapeEnvValue(alreadyClean)).toBe(alreadyClean);
  });

  it('unescapes in a single pass, so a literal backslash-n survives', () => {
    // \\n means "backslash, n" — resolving twice would turn it into a newline.
    expect(unescapeEnvValue('C:\\\\next')).toBe('C:\\next');
  });

  it('agrees across both loaders for the same source text', () => {
    // The real guarantee: dev and container spellings converge on one prompt.
    const asDotenvDelivers = 'Her name means \\"most beautiful\\".';
    const asComposeDelivers = 'Her name means "most beautiful".';
    expect(unescapeEnvValue(asDotenvDelivers)).toBe(unescapeEnvValue(asComposeDelivers));
  });
});

describe('getSystemPrompt', () => {
  it('reads the prompt from the environment and trims it', () => {
    process.env.CALLISTO_SYSTEM_PROMPT = '\nYou are Callisto.\n';
    expect(getSystemPrompt()).toBe('You are Callisto.');
  });

  it('throws an actionable error when unset or blank', () => {
    // A silently empty system instruction would strip Callisto's persona
    // without any other visible symptom, so this must fail loudly.
    delete process.env.CALLISTO_SYSTEM_PROMPT;
    expect(() => getSystemPrompt()).toThrow(/CALLISTO_SYSTEM_PROMPT/);

    process.env.CALLISTO_SYSTEM_PROMPT = '   ';
    expect(() => getSystemPrompt()).toThrow(/\.env\.example/);
  });

  it('reads the environment on each call, not at import time', () => {
    process.env.CALLISTO_SYSTEM_PROMPT = 'First persona.';
    expect(getSystemPrompt()).toBe('First persona.');

    process.env.CALLISTO_SYSTEM_PROMPT = 'Second persona.';
    expect(getSystemPrompt()).toBe('Second persona.');
  });
});

describe('getGreetingPrompt', () => {
  it('falls back to the default when unset', () => {
    // Greeting on connect is the default behaviour: a visitor who has just
    // granted microphone access should hear something without speaking first.
    delete process.env.CALLISTO_GREETING;
    expect(getGreetingPrompt()).toBe(DEFAULT_GREETING);
  });

  it('treats a blank value as "stay silent", not as "use the default"', () => {
    // The one way to switch greeting off. An unset variable must not collapse
    // into the same case, or disabling it would be impossible.
    process.env.CALLISTO_GREETING = '';
    expect(getGreetingPrompt()).toBe('');

    process.env.CALLISTO_GREETING = '   ';
    expect(getGreetingPrompt()).toBe('');
  });

  it('reads an override from the environment, unescaped and trimmed', () => {
    process.env.CALLISTO_GREETING = '\n  Say \\"hello\\" and stop.  \n';
    expect(getGreetingPrompt()).toBe('Say "hello" and stop.');
  });

  it('instructs rather than scripts, so the persona owns the wording', () => {
    // A literal line here would be spoken verbatim by every persona this repo
    // is ever repurposed for — including ones not named Callisto.
    expect(DEFAULT_GREETING).not.toMatch(/Callisto/i);
    expect(DEFAULT_GREETING).toMatch(/do not mention/i);
  });
});
