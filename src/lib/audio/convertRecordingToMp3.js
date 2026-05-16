/** LAME frame size (samples per channel per encode call). */
const MP3_SAMPLE_BLOCK = 1152;

/** Default MP3 bitrate (kbps) — balances size and speech clarity. */
export const RECORDING_MP3_KBPS = 128;

/**
 * @param {unknown} err
 */
export function friendlyRecordingDecodeError(err) {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/object can not be found|cannot be found here|not found here/i.test(msg)) {
    return (
      'This recording could not be read on this device (incomplete or unsupported capture). ' +
      'Discard it, then record again and wait for Stop to finish before uploading.'
    );
  }
  if (/EncodingError|decode|decoding failed/i.test(msg)) {
    return `Could not decode this recording (${msg}). Try discarding and recording again.`;
  }
  return msg || 'Decode failed';
}

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
 * @param {AudioContext} ctx
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<AudioBuffer>}
 */
function decodeAudioDataCompat(ctx, arrayBuffer) {
  const copy = arrayBuffer.slice(0);
  try {
    const result = ctx.decodeAudioData(copy);
    if (result && typeof result.then === 'function') {
      return result;
    }
  } catch {
    /* fall back to callback API (older WebKit) */
  }
  return new Promise((resolve, reject) => {
    ctx.decodeAudioData(copy, resolve, reject);
  });
}

/**
 * @param {Blob} sourceBlob
 * @returns {Promise<Blob>}
 */
export async function convertRecordingBlobToMp3(sourceBlob) {
  if (typeof window === 'undefined') {
    throw new Error('MP3 conversion is only available in the browser.');
  }
  if (!sourceBlob.size) {
    throw new Error('Recording is empty. Discard and record again.');
  }

  const AudioCtx =
    window.AudioContext ||
    /** @type {typeof AudioContext | undefined} */ (window.webkitAudioContext);
  if (!AudioCtx) {
    throw new Error('This browser cannot decode audio for MP3 conversion.');
  }

  const arrayBuffer = await sourceBlob.arrayBuffer();
  const ctx = new AudioCtx();
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const audioBuffer = await decodeAudioDataCompat(ctx, arrayBuffer);
    if (!audioBuffer.length) {
      throw new Error('Recording has no audio frames.');
    }
    return await audioBufferToMp3Blob(audioBuffer);
  } catch (e) {
    throw new Error(friendlyRecordingDecodeError(e));
  } finally {
    await ctx.close().catch(() => {});
  }
}
