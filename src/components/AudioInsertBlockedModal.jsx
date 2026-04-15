import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './NoteInfoModal.module.css';
import insertStyles from './InsertAudioModal.module.css';

const BODY_TEXT =
  "Audio clips can't be inserted inside a list. Move the cursor outside the list or press Enter twice to start a normal paragraph, then try again.";

/**
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function AudioInsertBlockedModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.dialog} ${styles.dialogWide}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="audio-insert-blocked-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="audio-insert-blocked-title" className={styles.title}>
            Can't insert audio here
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>
        <div className={insertStyles.body}>
          <p className={insertStyles.muted}>{BODY_TEXT}</p>
          <button type="button" className={insertStyles.primaryBtn} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
