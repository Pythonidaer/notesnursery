import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './NoteInfoModal.module.css';

/**
 * @param {{ open: boolean, onClose: () => void, sourceFileName: string, createdAtSource: string }} props
 */
export default function NoteInfoModal({
  open,
  onClose,
  sourceFileName,
  createdAtSource,
}) {
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
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-info-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="note-info-title" className={styles.title}>
            Note Info
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
        <dl className={styles.list}>
          <div className={styles.row}>
            <dt>Source file</dt>
            <dd>{sourceFileName || '—'}</dd>
          </div>
          <div className={styles.row}>
            <dt>Created</dt>
            <dd>{createdAtSource || '—'}</dd>
          </div>
        </dl>
      </div>
    </div>,
    document.body
  );
}
