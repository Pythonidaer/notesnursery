/**
 * Read persisted `figure.nn-audio-embed` attributes from the DOM element.
 * @param {Element} fig
 */
export function readNoteAudioAttrsFromFigureEl(fig) {
  const storagePath = fig.getAttribute('data-nn-storage-path') || '';
  const sizeRaw = fig.getAttribute('data-nn-size-bytes');
  let sizeBytes = null;
  if (sizeRaw != null && sizeRaw !== '') {
    const n = Number.parseInt(sizeRaw, 10);
    sizeBytes = Number.isFinite(n) ? n : null;
  }
  return {
    storagePath,
    fileName: fig.getAttribute('data-nn-file-name') || '',
    mimeType: fig.getAttribute('data-nn-mime-type') || '',
    sizeBytes,
    uploadedAt: fig.getAttribute('data-nn-uploaded-at') || '',
  };
}

/**
 * Split sanitized note HTML into alternating static HTML chunks and audio embeds
 * so read mode can render audio with React (stable; not wiped by parent re-renders).
 *
 * @param {string} safeHtml
 * @returns {Array<{ type: 'html', html: string } | { type: 'audio', attrs: ReturnType<typeof readNoteAudioAttrsFromFigureEl> }>}
 */
export function splitNoteHtmlForAudioRead(safeHtml) {
  if (typeof safeHtml !== 'string' || !safeHtml.trim()) {
    return [{ type: 'html', html: safeHtml || '' }];
  }
  if (typeof DOMParser === 'undefined') {
    return [{ type: 'html', html: safeHtml }];
  }

  const doc = new DOMParser().parseFromString(
    `<div data-nn-read-root="1">${safeHtml}</div>`,
    'text/html'
  );
  const root = doc.querySelector('[data-nn-read-root]');
  if (!root) {
    return [{ type: 'html', html: safeHtml }];
  }

  /** @type {Array<{ type: 'html', html: string } | { type: 'audio', attrs: ReturnType<typeof readNoteAudioAttrsFromFigureEl> }>} */
  const segments = [];
  /** @type {ChildNode[]} */
  const buf = [];

  const flushBuf = () => {
    if (buf.length === 0) return;
    const wrap = doc.createElement('div');
    for (const n of buf) {
      wrap.appendChild(n.cloneNode(true));
    }
    segments.push({ type: 'html', html: wrap.innerHTML });
    buf.length = 0;
  };

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === 1) {
      const el = /** @type {Element} */ (node);
      if (el.matches('figure.nn-audio-embed')) {
        flushBuf();
        segments.push({ type: 'audio', attrs: readNoteAudioAttrsFromFigureEl(el) });
        continue;
      }
    }
    buf.push(node);
  }
  flushBuf();

  return segments.length > 0 ? segments : [{ type: 'html', html: safeHtml }];
}
