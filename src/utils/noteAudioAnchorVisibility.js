/**
 * Whether the audio block is visible enough in the viewport to use the inline player directly.
 * If this returns false, the block is off-screen or only a sliver is visible — show the floating control.
 *
 * @param {HTMLElement | null} el
 * @param {number} [minAreaRatio=0.08] Minimum fraction of the element's bounding box that must intersect the viewport.
 * @returns {boolean}
 */
export function isAudioBlockUsableInline(el, minAreaRatio = 0.08) {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;

  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;

  const interTop = Math.max(r.top, 0);
  const interBottom = Math.min(r.bottom, vh);
  const interLeft = Math.max(r.left, 0);
  const interRight = Math.min(r.right, vw);

  const ih = Math.max(0, interBottom - interTop);
  const iw = Math.max(0, interRight - interLeft);
  const visibleArea = ih * iw;
  const elArea = r.width * r.height;
  const ratio = visibleArea / elArea;
  return ratio >= minAreaRatio;
}

/**
 * @deprecated use isAudioBlockUsableInline; kept for any stray imports
 */
export function isAnchorSubstantiallyVisibleInViewport(el, minRatio = 0.08) {
  return isAudioBlockUsableInline(el, minRatio);
}
