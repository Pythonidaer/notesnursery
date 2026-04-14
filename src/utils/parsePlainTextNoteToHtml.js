import { normalizeAppleNotesHtml } from './normalizeAppleNotesHtml.js';

/**
 * Lines that look like Markdown / Apple plain-text bullets: optional indent, "- ", content.
 * @type {RegExp}
 */
const LIST_LINE = /^\s*-\s+(.*)$/;

/**
 * True when the string appears to already be HTML (tag-like markup), so we should not
 * run plain-text paragraph/list parsing on it.
 * @param {string} s
 * @returns {boolean}
 */
export function isLikelyHtmlString(s) {
  if (typeof s !== 'string' || !s.trim()) return false;
  return /<[a-zA-Z][\s\S]*?>/.test(s.trim());
}

/**
 * Escape text for HTML body (no linkify yet).
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Markdown inline links: `[label](url)` (label may be empty).
 * Parsed before raw URL detection so bracketed URLs are not half–auto-linked.
 * @type {RegExp}
 */
const MARKDOWN_LINK = /\[([^\]]*)\]\(\s*([^)]+?)\s*\)/g;

/**
 * Turn raw URLs in already-escaped text into anchor tags.
 * Only use on segments that are not already markdown or HTML links.
 * @param {string} escaped
 * @returns {string}
 */
function linkifyEscaped(escaped) {
  const urlRe = /(https?:\/\/[^\s<]+)|(www\.[^\s<]+)/gi;
  return escaped.replace(urlRe, (match) => {
    const href = match.startsWith('www.') ? `https://${match}` : match;
    const safeHref = escapeHtml(href);
    return `<a href="${safeHref}" rel="noopener noreferrer" target="_blank">${match}</a>`;
  });
}

/**
 * Escape + raw-URL linkify (no markdown parsing).
 * @param {string} segment
 * @returns {string}
 */
function linkifyPlainSegment(segment) {
  return linkifyEscaped(escapeHtml(segment));
}

/**
 * `[label](url)` → one `<a>`; other text gets escape + raw URL linkify only.
 * Avoids matching `https://…` inside markdown link syntax or duplicating hrefs.
 * @param {string} raw
 * @returns {string}
 */
function markdownLinksThenRawLinkify(raw) {
  if (!raw) return '';
  const parts = [];
  let lastIndex = 0;
  let m;
  const re = new RegExp(MARKDOWN_LINK.source, 'g');
  while ((m = re.exec(raw)) !== null) {
    const before = raw.slice(lastIndex, m.index);
    if (before) parts.push(linkifyPlainSegment(before));
    const label = m[1];
    const url = m[2].trim();
    parts.push(
      `<a href="${escapeHtml(url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(label)}</a>`
    );
    lastIndex = m.index + m[0].length;
  }
  const tail = raw.slice(lastIndex);
  if (tail) parts.push(linkifyPlainSegment(tail));
  return parts.join('');
}

/**
 * @param {string[]} lines
 * @returns {string}
 */
function formatParagraphLines(lines) {
  const joined = lines.join('\n');
  return markdownLinksThenRawLinkify(joined).replace(/\n/g, '<br>');
}

/**
 * Within one double-newline "block", alternate between paragraph runs and list runs.
 * @param {string} block
 * @returns {{ type: 'p' | 'ul', lines?: string[], items?: string[] }[]}
 */
function parseBlockSegments(block) {
  const lines = block.split('\n');
  /** @type {{ type: 'p' | 'ul', lines?: string[], items?: string[] }[]} */
  const segments = [];
  /** @type {string[]} */
  let paraLines = [];
  /** @type {string[]} */
  let listItems = [];

  const flushPara = () => {
    if (paraLines.length) {
      segments.push({ type: 'p', lines: [...paraLines] });
      paraLines = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      segments.push({ type: 'ul', items: [...listItems] });
      listItems = [];
    }
  };

  for (const line of lines) {
    const m = line.match(LIST_LINE);
    if (m) {
      flushPara();
      listItems.push(m[1].trim());
    } else {
      flushList();
      paraLines.push(line);
    }
  }
  flushPara();
  flushList();
  return segments;
}

/**
 * Convert plain-text note bodies (newlines, double newlines, "- " lists) into semantic HTML.
 * Does not collapse whitespace into spaces: paragraphs use `<p>`, soft breaks use `<br>`.
 *
 * **Before** (plain text):
 * ```
 * First paragraph line one
 * line two
 *
 * Second block
 *
 * - alpha
 * - beta
 *
 * See https://example.com
 *
 * [label](https://example.com/page)
 * ```
 *
 * **After** (HTML):
 * ```html
 * <p>First paragraph line one<br>line two</p><p>Second block</p><ul><li>alpha</li><li>beta</li></ul><p>See <a href="https://example.com" rel="noopener noreferrer" target="_blank">https://example.com</a></p><p><a href="https://example.com/page" rel="noopener noreferrer" target="_blank">label</a></p>
 * ```
 *
 * Markdown-style `[label](url)` is parsed before raw URL auto-linking so bracketed links become a single anchor (no duplicated or truncated hrefs).
 *
 * @param {string} text
 * @returns {string}
 */
export function parsePlainTextNoteToHtml(text) {
  if (typeof text !== 'string' || !text.trim()) return '';
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\n+/);
  /** @type {string[]} */
  const parts = [];

  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    if (!block) continue;
    const segments = parseBlockSegments(block);
    for (const seg of segments) {
      if (seg.type === 'p' && seg.lines) {
        parts.push(`<p>${formatParagraphLines(seg.lines)}</p>`);
      } else if (seg.type === 'ul' && seg.items) {
        const lis = seg.items.map((item) => {
          return `<li>${markdownLinksThenRawLinkify(item)}</li>`;
        });
        parts.push(`<ul>${lis.join('')}</ul>`);
      }
    }
  }

  return parts.join('');
}

/**
 * Apple Notes exports may be HTML-heavy or plain text. Choose the right path:
 * - Likely HTML → {@link normalizeAppleNotesHtml}
 * - Plain text → {@link parsePlainTextNoteToHtml}
 *
 * Use before sanitize + DB save on **import**, and before **read / editor init** when
 * `body_html` may still be plain text. Editor save output is usually HTML; passing it
 * here still works because `isLikelyHtmlString` is true.
 *
 * @param {string} raw
 * @returns {string}
 */
export function prepareNoteBodyHtml(raw) {
  if (typeof raw !== 'string') return '';
  const t = raw.trim();
  if (!t) return '';
  if (isLikelyHtmlString(t)) return normalizeAppleNotesHtml(t);
  return parsePlainTextNoteToHtml(t);
}
