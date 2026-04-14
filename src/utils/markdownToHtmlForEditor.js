import { marked } from 'marked';
import { sanitizeNoteHtml } from './sanitizeNoteHtml.js';

marked.setOptions({ gfm: true, breaks: true });

/**
 * Convert legacy Markdown note bodies to HTML for TipTap initialization.
 * @param {string} markdown
 * @returns {string}
 */
export function markdownToHtmlForEditor(markdown) {
  const raw = String(markdown ?? '').trim();
  if (!raw) return '<p></p>';
  const html = marked.parse(raw, { async: false });
  return sanitizeNoteHtml(String(html));
}
