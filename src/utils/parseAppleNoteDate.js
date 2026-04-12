/**
 * Parse Apple Notes export date strings (e.g. "Sunday, March 29, 2026 at 12:40:05 PM")
 * and ISO 8601 strings (e.g. from import fallbacks). Uses Date.parse first.
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

/**
 * Normalize user input for stored source dates (YYYY-MM-DD when possible, else trimmed text).
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeNoteSourceDateInput(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';

  const isoDay = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) {
    return `${isoDay[1]}-${isoDay[2]}-${isoDay[3]}`;
  }

  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return d.toISOString().slice(0, 10);
  }

  return s;
}
