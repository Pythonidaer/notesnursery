import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Grip } from 'lucide-react';
import { useNoteEditFloatingAudio } from './NoteEditFloatingAudioContext.jsx';
import { isAudioBlockUsableInline } from '../utils/noteAudioAnchorVisibility.js';
import styles from './NoteEditFloatingAudioDock.module.css';

/** If at least this fraction of the audio block intersects the viewport, hide the floating player. */
const MIN_INLINE_AREA_RATIO = 0.08;

/** Dense thresholds so IntersectionObserver fires when visibility crosses ~8% (not only 0%/100%). */
const INTERSECTION_THRESHOLDS = Array.from({ length: 101 }, (_, i) => i / 100);

/**
 * Shell fixed to bottom-right when the inline block is off-screen. The actual `<audio controls>`
 * element is portaled here from `NoteAudioNodeView` so it is identical to the in-editor player.
 */
export default function NoteEditFloatingAudioDock() {
  const ctx = useNoteEditFloatingAudio();
  const active = ctx?.active ?? null;
  const audioEl = active?.audioEl ?? null;
  const anchorEl = active?.anchorEl ?? null;
  const label = active?.label ?? 'Audio';
  const registerDockAudioMount = ctx?.registerDockAudioMount;
  const setDockUiVisible = ctx?.setDockUiVisible;

  const [inlineUsable, setInlineUsable] = useState(true);
  const rafRef = useRef(0);
  const prevShowDockRef = useRef(/** @type {boolean | null} */ (null));
  const [dragOffset, setDragOffset] = useState(/** @type {{ x: number; y: number }} */ ({ x: 0, y: 0 }));
  const dragStartRef = useRef(/** @type {{ clientX: number; clientY: number; ox: number; oy: number } | null} */ (null));

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

  useEffect(() => {
    if (!showDock) {
      setDragOffset({ x: 0, y: 0 });
    }
  }, [showDock]);

  const bindDockMount = useCallback(
    (el) => {
      if (registerDockAudioMount) registerDockAudioMount(el);
    },
    [registerDockAudioMount]
  );

  const onDockGripPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const start = {
        clientX: e.clientX,
        clientY: e.clientY,
        ox: dragOffset.x,
        oy: dragOffset.y,
      };
      dragStartRef.current = start;

      const onMove = (ev) => {
        const s = dragStartRef.current;
        if (!s) return;
        setDragOffset({
          x: s.ox + (ev.clientX - s.clientX),
          y: s.oy + (ev.clientY - s.clientY),
        });
      };
      const onUp = () => {
        dragStartRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [dragOffset.x, dragOffset.y]
  );

  if (!active || !audioEl) {
    return null;
  }

  if (!showDock) {
    return null;
  }

  return createPortal(
    <div
      className={styles.dock}
      style={{
        transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
      }}
      role="region"
      aria-label="Now playing"
    >
      <div className={styles.fileLine} title={label}>
        {label}
      </div>
      <div className={styles.chromeRow}>
        <button
          type="button"
          className={styles.dockGrip}
          aria-label="Move player"
          title="Move"
          onPointerDown={onDockGripPointerDown}
        >
          <Grip className={styles.gripIcon} strokeWidth={2} aria-hidden />
        </button>
        <div className={styles.playerPill}>
          <div className={styles.nativeAudioSlot} ref={bindDockMount} />
        </div>
      </div>
    </div>,
    document.body
  );
}
