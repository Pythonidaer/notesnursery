/**
 * Convert OCR plain text into a small, safe HTML fragment for TipTap `insertContent`.
 * Paragraphs are split on double newlines; single newlines become <br> inside a <p>.
 *
 * @param {string} plain
 * @returns {string} HTML or '' if nothing to insert
 */
export function ocrPlainTextToTipTapHtml(plain) {
  const t = typeof plain === 'string' ? plain.trim() : '';
  if (!t) {
    return '';
  }

  const esc = (s) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  return t
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split('\n');
      return `<p>${lines.map(esc).join('<br>')}</p>`;
    })
    .join('');
}
