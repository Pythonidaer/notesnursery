import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './NoteInfoModal.module.css';
import linkStyles from './InsertLinkModal.module.css';

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   initialUrl: string,
 *   canRemoveLink: boolean,
 *   onApply: (url: string) => void,
 *   onRemoveLink: () => void,
 * }} props
 */
export default function InsertLinkModal({ open, onClose, initialUrl, canRemoveLink, onApply, onRemoveLink }) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  useEffect(() => {
    if (!open) return;
    setDraft(initialUrl);
  }, [open, initialUrl]);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    onApply(draft);
    onClose();
  };

  const remove = () => {
    onRemoveLink();
    onClose();
  };

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="insert-link-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="insert-link-title" className={styles.title}>
            Insert link
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
        <div className={linkStyles.body}>
          <label className={linkStyles.label} htmlFor="insert-link-url">
            URL
          </label>
          <input
            ref={inputRef}
            id="insert-link-url"
            type="text"
            inputMode="url"
            className={linkStyles.input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://…"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className={linkStyles.actions}>
            {canRemoveLink ? (
              <button type="button" className={linkStyles.removeBtn} onClick={remove}>
                Remove link
              </button>
            ) : null}
            <div className={linkStyles.actionsRight}>
              <button type="button" className={linkStyles.cancelBtn} onClick={onClose}>
                Cancel
              </button>
              <button type="button" className={linkStyles.applyBtn} onClick={submit}>
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
