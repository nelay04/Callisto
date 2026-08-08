import { describe, expect, it } from 'vitest';
import { buildMailtoUrl } from './mailto.tool';

const ADDRESS = 'owner@example.com';

describe('buildMailtoUrl', () => {
  it('returns a bare mailto when the model supplies nothing', () => {
    expect(buildMailtoUrl(undefined, undefined, ADDRESS)).toBe(`mailto:${ADDRESS}`);
  });

  it('includes only the parameters that were provided', () => {
    expect(buildMailtoUrl('Hello', undefined, ADDRESS)).toBe(
      `mailto:${ADDRESS}?subject=Hello`,
    );
    expect(buildMailtoUrl(undefined, 'Body text', ADDRESS)).toBe(
      `mailto:${ADDRESS}?body=Body%20text`,
    );
  });

  it('joins subject and body with an ampersand', () => {
    expect(buildMailtoUrl('Hi', 'There', ADDRESS)).toBe(
      `mailto:${ADDRESS}?subject=Hi&body=There`,
    );
  });

  it('percent-encodes characters that would otherwise break the URL', () => {
    // An unencoded & or # would truncate the body in the user's mail client.
    const url = buildMailtoUrl('R&D #1', 'a=b&c=d', ADDRESS);
    expect(url).toBe(`mailto:${ADDRESS}?subject=R%26D%20%231&body=a%3Db%26c%3Dd`);
  });

  it('preserves newlines in the body as encoded characters', () => {
    expect(buildMailtoUrl(undefined, 'line one\nline two', ADDRESS)).toBe(
      `mailto:${ADDRESS}?body=line%20one%0Aline%20two`,
    );
  });

  it('treats empty strings as absent rather than emitting blank params', () => {
    expect(buildMailtoUrl('', '', ADDRESS)).toBe(`mailto:${ADDRESS}`);
  });
});
