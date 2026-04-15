/**
 * Minimal escaping for use inside double-quoted HTML attribute values.
 * @param {string} s
 * @returns {string}
 */
export function escapeHtmlAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
