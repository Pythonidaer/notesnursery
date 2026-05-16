import { createNoteAudioSignedUrl } from './noteAudioSignedUrl.js';
import { loadAudioDurationSec } from './loadAudioDurationSec.js';

const PREFETCH_CONCURRENCY = 3;

/**
 * @param {string} path
 * @returns {Promise<number | null>}
 */
async function fetchDurationForPath(path) {
  const signed = await createNoteAudioSignedUrl(path);
  if (!signed.url) return null;
  return loadAudioDurationSec(signed.url);
}

/**
 * Loads clip lengths for storage paths (signed URL + audio metadata).
 * @param {string[]} paths
 * @returns {Promise<Record<string, number | null>>}
 */
export async function prefetchNoteAudioDurations(paths) {
  const unique = [...new Set(paths.filter((p) => typeof p === 'string' && p.trim()))];
  if (unique.length === 0) return {};

  /** @type {Record<string, number | null>} */
  const result = {};
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < unique.length) {
      const index = nextIndex;
      nextIndex += 1;
      const path = unique[index];
      result[path] = await fetchDurationForPath(path);
    }
  };

  const workers = Math.min(PREFETCH_CONCURRENCY, unique.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return result;
}
