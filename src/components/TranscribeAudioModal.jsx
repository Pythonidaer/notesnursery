import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './NoteInfoModal.module.css';

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   title: string,
 *   message: string,
 *   detail?: string | null,
 *   busy?: boolean,
 *   canvasDark?: boolean,
 * }} props
 */
export default function TranscribeAudioModal({
  open,
  onClose,
  title,
  message,
  detail,
  busy = false,
  canvasDark: canvasDarkProp,
}) {
  const [canvasDarkDetected, setCanvasDarkDetected] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  useEffect(() => {
    if (!open) return;
    const el = document.querySelector('[data-notes-canvas]');
    setCanvasDarkDetected(el?.getAttribute('data-notes-canvas') === 'dark');
  }, [open]);

  if (!open) return null;

  const canvasDark = canvasDarkProp ?? canvasDarkDetected;
  const theme = canvasDark ? 'dark' : undefined;

  return createPortal(
    <div
      className={styles.backdrop}
      data-nn-dismiss-shield
      data-theme={theme}
      role="presentation"
      onClick={(e) => {
        if (busy) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.dialog} ${styles.dialogWide}`}
        data-theme={theme}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transcribe-audio-title"
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="transcribe-audio-title" className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>
        <dl className={styles.list}>
          <div className={styles.row}>
            <dt>Status</dt>
            <dd>{message}</dd>
          </div>
          {detail ? (
            <div className={styles.row}>
              <dt>Detail</dt>
              <dd>{detail}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>,
    document.body
  );
}
