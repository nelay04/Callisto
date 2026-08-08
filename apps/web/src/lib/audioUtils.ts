/**
 * Encode a Float32Array of audio samples (from the Web Audio API) to a
 * base64-encoded PCM16 string at 16 kHz, suitable for sending to the backend.
 */
export function createPcmBase64(float32: Float32Array): string {
  const bytes = new Uint8Array(float32.length * 2);
  const view = new DataView(bytes.buffer);

  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    // Asymmetric scaling: PCM16 spans -32768..32767, so the negative side has
    // one more step than the positive side.
    const sample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    // Gemini expects little-endian; write it explicitly rather than relying on
    // the host's byte order.
    view.setInt16(i * 2, sample, true);
  }

  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode a base64-encoded PCM16 payload from the server into a Web Audio
 * AudioBuffer, ready to be scheduled for playback.
 *
 * @param base64     Base64-encoded PCM16 data from the server.
 * @param ctx        The AudioContext to create the buffer on (should be 24 kHz).
 * @param sampleRate The sample rate encoded in the PCM data (Gemini returns 24 kHz).
 */
export function decodeBase64ToPCM(
  base64: string,
  ctx: AudioContext,
  sampleRate: number,
): AudioBuffer {
  const samples = decodePcm16Base64(base64);
  const buffer = ctx.createBuffer(1, samples.length, sampleRate);
  buffer.getChannelData(0).set(samples);
  return buffer;
}

/**
 * Decode base64 PCM16 into normalised float samples in [-1, 1).
 *
 * Split out from {@link decodeBase64ToPCM} so the format conversion — the part
 * that can silently produce noise if it's wrong — is testable without a
 * browser AudioContext.
 */
export function decodePcm16Base64(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  // A trailing odd byte cannot form a sample; drop it rather than letting the
  // Int16Array constructor throw on a non-multiple-of-2 length.
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    // Gemini sends little-endian PCM16; read it explicitly rather than relying
    // on the host's byte order.
    samples[i] = view.getInt16(i * 2, true) / 32768;
  }
  return samples;
}
