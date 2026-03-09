/**
 * Encode a Float32Array of audio samples (from the Web Audio API) to a
 * base64-encoded PCM16 string at 16 kHz, suitable for sending to the backend.
 */
export function createPcmBase64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  const bytes = new Uint8Array(int16.buffer);
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
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const int16 = new Int16Array(bytes.buffer);
  const buffer = ctx.createBuffer(1, int16.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < int16.length; i++) {
    channelData[i] = int16[i] / 32768.0;
  }
  return buffer;
}
