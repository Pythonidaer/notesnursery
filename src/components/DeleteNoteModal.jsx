import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './DeleteNoteModal.module.css';

/**
 * @param {{
 *   open: boolean,
 *   title: string,
 *   message: string,
 *   onCancel: () => void,
 *   onConfirm: () => void,
 *   deleting?: boolean,
 * }} props
 */
export default function DeleteNoteModal({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  deleting = false,
}) {
  const cancelRef = useRef(/** @type {HTMLButtonElement | null} */ (null));

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !deleting) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, deleting]);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onCancel();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-note-title"
        aria-describedby="delete-note-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="delete-note-title" className={styles.title}>
            {title}
          </h2>
        </div>
        <p id="delete-note-desc" className={styles.body}>
          {message}
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={onCancel}
            disabled={deleting}
            ref={cancelRef}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnDelete}
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
