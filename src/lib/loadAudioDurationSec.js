/**
 * Reads duration from remote audio via a temporary audio element (metadata only).
 * @param {string} url
 * @returns {Promise<number | null>} seconds, or null if unavailable
 */
export function loadAudioDurationSec(url) {
  if (!url?.trim()) return Promise.resolve(null);

  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';

    const finish = (value) => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('error', onErr);
      audio.src = '';
      resolve(value);
    };

    const onMeta = () => {
      const d = audio.duration;
      finish(Number.isFinite(d) && d > 0 ? d : null);
    };

    const onErr = () => finish(null);

    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('error', onErr);
    audio.src = url;
  });
}
