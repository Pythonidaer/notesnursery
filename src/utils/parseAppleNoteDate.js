/**
 * Parse Apple Notes export date strings (e.g. "Sunday, March 29, 2026 at 12:40:05 PM").
 * @param {string | undefined | null} raw
 * @returns {Date | null}
 */
export function parseAppleNoteDateString(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;

  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t);

  const atReplaced = s.replace(/\s+at\s+/i, ' ');
  const t2 = Date.parse(atReplaced);
  if (!Number.isNaN(t2)) return new Date(t2);

  const isoGuess = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoGuess) {
    const d = new Date(Number(isoGuess[1]), Number(isoGuess[2]) - 1, Number(isoGuess[3]));
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}
