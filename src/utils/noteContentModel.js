import { htmlToPlain } from './noteBodyPlain.js';

/** @typedef {'html' | 'markdown'} NoteContentType */

export const CONTENT_TYPE_HTML = 'html';
export const CONTENT_TYPE_MARKDOWN = 'markdown';

/**
 * @param {unknown} v
 * @returns {NoteContentType}
 */
export function normalizeContentType(v) {
  return v === CONTENT_TYPE_MARKDOWN ? CONTENT_TYPE_MARKDOWN : CONTENT_TYPE_HTML;
}

/**
 * Plain text for previews and HTML note editing (not for rich-editor hydration).
 * @param {{ contentType?: string, bodyHtml?: string, bodyMarkdown?: string }} note
 * @returns {string}
 */
export function getNoteBodyPlain(note) {
  if (!note) return '';
  if (normalizeContentType(note.contentType) === CONTENT_TYPE_MARKDOWN) {
    return note.bodyMarkdown ?? '';
  }
  return htmlToPlain(note.bodyHtml ?? '');
}
