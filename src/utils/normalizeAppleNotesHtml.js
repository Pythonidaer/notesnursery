/**
 * Normalize Apple Notes / AppleScript-exported HTML into semantic HTML that
 * TipTap (ProseMirror) can parse: Paragraph nodes only recognize `<p>` by default,
 * so `<div>`-wrapped blocks collapse into a single paragraph or inline runs.
 *
 * This runs in the browser (DOMParser). When `DOMParser` is unavailable, input
 * is returned trimmed unchanged.
 *
 * @param {string} html
 * @returns {string}
 */
export function normalizeAppleNotesHtml(html) {
  if (typeof html !== 'string' || !html.trim()) return '';
  if (typeof DOMParser === 'undefined') return html.trim();

  const doc = new DOMParser().parseFromString(
    `<div class="nn-apple-normalize-root">${html}</div>`,
    'text/html'
  );
  const root = doc.body?.querySelector('.nn-apple-normalize-root');
  if (!root) return html.trim();

  const blockChildTags = new Set([
    'P',
    'DIV',
    'UL',
    'OL',
    'LI',
    'BLOCKQUOTE',
    'PRE',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'TABLE',
    'HR',
    'FIGURE',
    'SECTION',
    'ARTICLE',
    'ASIDE',
    'HEADER',
    'FOOTER',
    'NAV',
    'MAIN',
    'FORM',
    'FIELDSET',
    'ADDRESS',
    'DL',
    'DT',
    'DD',
  ]);

  const singleBlockUnwrapTags = new Set([
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'UL',
    'OL',
    'BLOCKQUOTE',
    'P',
    'PRE',
    'TABLE',
    'HR',
    'FIGURE',
  ]);

  /**
   * @param {Element} el
   * @returns {boolean}
   */
  function hasBlockChildElement(el) {
    for (const child of el.children) {
      if (blockChildTags.has(child.tagName)) return true;
    }
    return false;
  }

  let changed = true;
  let guard = 0;
  while (changed && guard < 500) {
    guard += 1;
    changed = false;
    const divs = root.querySelectorAll('div');
    for (const div of divs) {
      if (div.children.length === 1) {
        const only = div.children[0];
        if (singleBlockUnwrapTags.has(only.tagName)) {
          div.replaceWith(only);
          changed = true;
          break;
        }
        if (only.tagName === 'DIV') {
          div.replaceWith(only);
          changed = true;
          break;
        }
      }
      if (div.children.length >= 2) {
        const kids = [...div.children];
        if (kids.length > 0 && kids.every((k) => blockChildTags.has(k.tagName))) {
          const parent = div.parentNode;
          if (parent) {
            for (const k of kids) {
              parent.insertBefore(k, div);
            }
            parent.removeChild(div);
            changed = true;
            break;
          }
        }
      }
    }
  }

  const leafDivs = [...root.querySelectorAll('div')].sort((a, b) => {
    const depth = (el) => {
      let d = 0;
      let n = el;
      while (n && n !== root) {
        d += 1;
        n = n.parentElement;
      }
      return d;
    };
    return depth(b) - depth(a);
  });

  for (const div of leafDivs) {
    if (!hasBlockChildElement(div)) {
      const p = doc.createElement('p');
      p.innerHTML = div.innerHTML;
      div.replaceWith(p);
    }
  }

  return root.innerHTML.trim();
}
