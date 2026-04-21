import { getNoteBodyPlain } from './noteContentModel.js';

/**
 * Build the plain-text blob we send to the embedding model (title + labels + body, no raw HTML).
 *
 * @param {{ title?: string, bodyHtml?: string, bodyMarkdown?: string, contentType?: string, labels?: string[] }} note
 * @returns {string}
 */
export function buildNoteEmbeddingSourceText(note) {
  const title = (note?.title ?? '').trim() || 'Untitled';
  const labels = Array.isArray(note?.labels) ? [...new Set(note.labels.map((s) => String(s).trim()).filter(Boolean))] : [];
  const body = getNoteBodyPlain(note).trim();

  const labelLine = labels.length ? labels.join(', ') : '(none)';

  return [`Title: ${title}`, `Labels: ${labelLine}`, `Body: ${body || '(empty)'}`].join('\n');
}
