/** LAME frame size (samples per channel per encode call). */
const MP3_SAMPLE_BLOCK = 1152;

/** Default MP3 bitrate (kbps) — balances size and speech clarity. */
export const RECORDING_MP3_KBPS = 128;

/**
 * @param {Float32Array} floats
 * @returns {Int16Array}
 */
export function float32ToInt16Pcm(floats) {
  const pcm = new Int16Array(floats.length);
  for (let i = 0; i < floats.length; i++) {
    const s = Math.max(-1, Math.min(1, floats[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm;
}

/**
 * Encode a decoded AudioBuffer to MP3 bytes (loaded lazily — ~100KB+ only on upload).
 * @param {AudioBuffer} audioBuffer
 * @param {number} [kbps]
 * @returns {Promise<Blob>}
 */
export async function audioBufferToMp3Blob(audioBuffer, kbps = RECORDING_MP3_KBPS) {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const channels = Math.min(2, audioBuffer.numberOfChannels);
  const sampleRate = audioBuffer.sampleRate;
  const encoder = new Mp3Encoder(channels, sampleRate, kbps);

  const left = audioBuffer.getChannelData(0);
  const right = channels > 1 ? audioBuffer.getChannelData(1) : null;
  const total = audioBuffer.length;
  /** @type {Uint8Array[]} */
  const parts = [];

  for (let offset = 0; offset < total; offset += MP3_SAMPLE_BLOCK) {
    const end = Math.min(offset + MP3_SAMPLE_BLOCK, total);
    const leftPcm = float32ToInt16Pcm(left.subarray(offset, end));
    let chunk;
    if (channels === 1) {
      chunk = encoder.encodeBuffer(leftPcm);
    } else {
      const rightPcm = float32ToInt16Pcm(/** @type {Float32Array} */ (right).subarray(offset, end));
      chunk = encoder.encodeBuffer(leftPcm, rightPcm);
    }
    if (chunk.length > 0) parts.push(chunk);
  }

  const flush = encoder.flush();
  if (flush.length > 0) parts.push(flush);

  return new Blob(parts, { type: 'audio/mpeg' });
}

/**
 * Decode any browser-captured blob (webm, m4a, wav, …) and return MP3 bytes for Storage.
 * Preview can keep using the original blob; call this only when uploading.
 *
 * @param {Blob} sourceBlob
 * @returns {Promise<Blob>}
 */
export async function convertRecordingBlobToMp3(sourceBlob) {
  if (typeof window === 'undefined') {
    throw new Error('MP3 conversion is only available in the browser.');
  }
  const AudioCtx = window.AudioContext || /** @type {typeof AudioContext | undefined} */ (window.webkitAudioContext);
  if (!AudioCtx) {
    throw new Error('This browser cannot decode audio for MP3 conversion.');
  }

  const arrayBuffer = await sourceBlob.arrayBuffer();
  const ctx = new AudioCtx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    return await audioBufferToMp3Blob(audioBuffer);
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Decode failed';
    throw new Error(
      `Could not convert this recording to MP3 (${detail}). Try a shorter clip, or upload an MP3 from your device instead.`
    );
  } finally {
    await ctx.close().catch(() => {});
  }
}
