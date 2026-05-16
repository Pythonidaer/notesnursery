/**
 * @param {number | null | undefined} sec
 * @returns {string}
 */
export function formatAudioDuration(sec) {
  if (!Number.isFinite(sec) || sec == null || sec < 0) return '—';
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
