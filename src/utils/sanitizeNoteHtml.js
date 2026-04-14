import DOMPurify from 'dompurify';

/**
 * Shared DOMPurify config for note HTML (editor save + read view).
 * Allows inline `style` on spans so TipTap text color (`<span style="color: …">`) round-trips safely.
 */
const NOTE_HTML_PURIFY = {
  USE_PROFILES: { html: true },
  /** `target` on `<a>` so `target="_blank"` round-trips (read view + editor). */
  ADD_ATTR: ['style', 'target'],
};

/**
 * Sanitize HTML before persisting or rendering from the rich text editor.
 * @param {string} html
 * @returns {string}
 */
export function sanitizeNoteHtml(html) {
  return DOMPurify.sanitize(html ?? '', NOTE_HTML_PURIFY);
}
