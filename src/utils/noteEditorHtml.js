import { markdownToHtmlForEditor } from './markdownToHtmlForEditor.js';
import { CONTENT_TYPE_MARKDOWN, normalizeContentType } from './noteContentModel.js';
import { prepareNoteBodyHtml } from './parsePlainTextNoteToHtml.js';
import { sanitizeNoteHtml } from './sanitizeNoteHtml.js';

/**
 * HTML for TipTap / {@link NoteRichTextEditor}, matching the note detail "start edit" path.
 * @param {{ contentType?: string, bodyHtml?: string, bodyMarkdown?: string } | null | undefined} note
 * @returns {string}
 */
export function getNoteHtmlForRichEditor(note) {
  if (!note) return '<p></p>';
  const ct = normalizeContentType(note.contentType);
  if (ct === CONTENT_TYPE_MARKDOWN) {
    const h = markdownToHtmlForEditor(note.bodyMarkdown ?? '');
    return h && h.trim() ? h : '<p></p>';
  }
  const h = sanitizeNoteHtml(prepareNoteBodyHtml(note.bodyHtml ?? ''));
  return h && h.trim() ? h : '<p></p>';
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Plain selected text → HTML fragment for TipTap `insertContent` (append workflow).
 * Splits on blank lines like the legacy textarea append path.
 * @param {string} plain
 * @returns {string}
 */
export function plainTextSnippetToAppendHtml(plain) {
  const s = plain.trim();
  if (!s) return '';
  const blocks = s.split(/\n\n+/);
  return blocks
    .map((block) => {
      const escaped = escapeHtml(block).replace(/\n/g, '<br>');
      return `<p>${escaped}</p>`;
    })
    .join('');
}
