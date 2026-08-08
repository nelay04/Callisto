import { describe, expect, it } from 'vitest';
import { createPcmBase64, decodePcm16Base64 } from './audioUtils';

describe('PCM16 encode/decode', () => {
  it('round-trips samples within one quantisation step', () => {
    // A wrong scale factor or byte order here produces audible noise rather
    // than an exception, so the round-trip is the only cheap way to catch it.
    const input = Float32Array.from([0, 0.5, -0.5, 0.25, -0.25, 0.999, -0.999]);
    const decoded = decodePcm16Base64(createPcmBase64(input));

    expect(decoded).toHaveLength(input.length);
    for (let i = 0; i < input.length; i++) {
      expect(decoded[i]).toBeCloseTo(input[i], 4);
    }
  });

  it('writes little-endian, two bytes per sample', () => {
    // 0.5 scales by 0x7fff to 16383.5, which truncates to 0x3fff — low byte
    // first in little-endian.
    const encoded = createPcmBase64(Float32Array.from([0.5]));
    const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));

    expect(bytes).toHaveLength(2);
    expect(Array.from(bytes)).toEqual([0xff, 0x3f]);
  });

  it('clamps samples outside [-1, 1] instead of wrapping', () => {
    // Wrapping would turn a loud passage into a burst of static.
    const decoded = decodePcm16Base64(createPcmBase64(Float32Array.from([2, -2])));

    expect(decoded[0]).toBeCloseTo(0.99997, 4);
    expect(decoded[1]).toBeCloseTo(-1, 5);
  });

  it('encodes full scale without overflowing into the opposite sign', () => {
    const decoded = decodePcm16Base64(createPcmBase64(Float32Array.from([1, -1])));

    expect(decoded[0]).toBeGreaterThan(0);
    expect(decoded[1]).toBe(-1);
  });

  it('handles an empty buffer', () => {
    expect(createPcmBase64(new Float32Array(0))).toBe('');
    expect(decodePcm16Base64('')).toHaveLength(0);
  });

  it('drops a trailing odd byte rather than throwing', () => {
    // A truncated chunk from the network must degrade to a dropped sample,
    // not take down the message handler.
    const threeBytes = btoa('\x00\x40\x11');

    expect(() => decodePcm16Base64(threeBytes)).not.toThrow();
    expect(decodePcm16Base64(threeBytes)).toHaveLength(1);
  });
});
