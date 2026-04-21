/**
 * Strip HTML to plain text. Uses DOMParser in the browser; regex fallback in Node (e.g. backfill scripts).
 * @param {string} html
 * @returns {string}
 */
export function htmlToPlain(html) {
  if (!html) return '';
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(`<div class="notePlainRoot">${html}</div>`, 'text/html');
    const root = doc.querySelector('.notePlainRoot');
    return root ? root.textContent || '' : '';
  }
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * MVP: plain text edited in textarea → simple escaped HTML for display.
 * @param {string} plain
 * @returns {string}
 */
export function plainTextToHtmlBody(plain) {
  return `<div class="notePlainBody" style="white-space:pre-wrap">${escapeHtml(plain)}</div>`;
}
