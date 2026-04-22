/**
 * True when the note body HTML contains an embedded audio block (editor / storage).
 * @param {{ bodyHtml?: string } | null | undefined} note
 * @returns {boolean}
 */
export function noteHasEmbeddedAudio(note) {
  const h = note?.bodyHtml;
  if (typeof h !== 'string' || h.length === 0) return false;
  return h.includes('nn-audio-embed');
}
