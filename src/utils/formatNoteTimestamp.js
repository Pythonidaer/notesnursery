/**
 * Human-readable timestamp for in-memory note metadata (Apple-ish).
 * @param {Date} d
 */
export function formatNoteTimestamp(d) {
  try {
    return d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'medium' });
  } catch {
    return d.toISOString();
  }
}
