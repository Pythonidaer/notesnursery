import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNoteEditFloatingAudio } from './NoteEditFloatingAudioContext.jsx';
import { isAudioBlockUsableInline } from '../utils/noteAudioAnchorVisibility.js';

/** If at least this fraction of the audio block intersects the viewport, hide the floating player. */
const MIN_INLINE_AREA_RATIO = 0.08;

/** Dense thresholds so IntersectionObserver fires when visibility crosses ~8% (not only 0%/100%). */
const INTERSECTION_THRESHOLDS = Array.from({ length: 101 }, (_, i) => i / 100);

/**
 * Drives `dockUiVisible` from IntersectionObserver + resize. The floating shell is rendered in
 * `NoteAudioNodeView` with `position: fixed` on the same `<audio>` node — no portal reparenting.
 */
export default function NoteEditFloatingAudioDock() {
  const ctx = useNoteEditFloatingAudio();
  const active = ctx?.active ?? null;
  const audioEl = active?.audioEl ?? null;
  const anchorEl = active?.anchorEl ?? null;
  const setDockUiVisible = ctx?.setDockUiVisible;

  const [inlineUsable, setInlineUsable] = useState(true);
  const rafRef = useRef(0);
  const prevShowDockRef = useRef(/** @type {boolean | null} */ (null));

  const runVisibilityCheck = useCallback(() => {
    if (!anchorEl || !anchorEl.isConnected) {
      setInlineUsable(true);
      return;
    }
    const usable = isAudioBlockUsableInline(anchorEl, MIN_INLINE_AREA_RATIO);
    setInlineUsable((prev) => {
      if (import.meta.env.DEV && prev !== usable) {
        const r = anchorEl.getBoundingClientRect();
        console.debug('[floating-audio] inline usability', {
          inlineUsable: usable,
          rectTop: Math.round(r.top),
          rectBottom: Math.round(r.bottom),
        });
      }
      return usable;
    });
  }, [anchorEl]);

  const scheduleVisibility = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      runVisibilityCheck();
    });
  }, [runVisibilityCheck]);

  useLayoutEffect(() => {
    if (!anchorEl) {
      setInlineUsable(true);
      return;
    }

    runVisibilityCheck();

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e?.target.isConnected) {
          setInlineUsable(true);
          return;
        }
        const usable = e.intersectionRatio >= MIN_INLINE_AREA_RATIO;
        setInlineUsable((prev) => {
          if (import.meta.env.DEV && prev !== usable) {
            console.debug('[floating-audio] IO inline usability', {
              inlineUsable: usable,
              intersectionRatio: e.intersectionRatio,
            });
          }
          return usable;
        });
      },
      { root: null, threshold: INTERSECTION_THRESHOLDS }
    );
    io.observe(anchorEl);

    return () => io.disconnect();
  }, [anchorEl, runVisibilityCheck]);

  useEffect(() => {
    if (!anchorEl) return;
    const onResize = () => scheduleVisibility();
    window.addEventListener('resize', onResize);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', onResize);
      vv.addEventListener('scroll', onResize);
    }
    return () => {
      window.removeEventListener('resize', onResize);
      if (vv) {
        vv.removeEventListener('resize', onResize);
        vv.removeEventListener('scroll', onResize);
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [anchorEl, scheduleVisibility]);

  const showDock = Boolean(active && audioEl && !audioEl.ended && !inlineUsable);

  useLayoutEffect(() => {
    if (!setDockUiVisible) return;
    setDockUiVisible(showDock);
  }, [showDock, setDockUiVisible]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (prevShowDockRef.current === showDock) return;
    prevShowDockRef.current = showDock;
    console.debug('[floating-audio] showDock', { showDock, inlineUsable, hasActive: !!active });
  }, [showDock, inlineUsable, active]);

  return null;
}
