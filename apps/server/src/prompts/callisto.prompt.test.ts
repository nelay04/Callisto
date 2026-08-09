import { afterEach, describe, expect, it } from 'vitest';
import { getSystemPrompt, unescapeEnvValue } from './callisto.prompt';

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
