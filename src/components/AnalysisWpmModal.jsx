import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './AnalysisWpmModal.module.css';

/**
 * @typedef {{ id: string, title: string, modifiedAtSource?: string }} WpmNoteOption
 */

/**
 * @param {{
 *   open: boolean,
 *   radioGroupName: string,
 *   loadingNotes: boolean,
 *   matchingNotes: WpmNoteOption[],
 *   selectedNoteId: string,
 *   onSelectedNoteIdChange: (id: string) => void,
 *   onCancel: () => void,
 *   onConfirm: () => void,
 *   errorMessage?: string | null,
 * }} props
 */
export default function AnalysisWpmModal({
  open,
  radioGroupName,
  loadingNotes,
  matchingNotes,
  selectedNoteId,
  onSelectedNoteIdChange,
  onCancel,
  onConfirm,
  errorMessage = null,
}) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef(/** @type {HTMLButtonElement | null} */ (null));

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const empty = !loadingNotes && matchingNotes.length === 0;
  const confirmDisabled =
    loadingNotes || empty || !selectedNoteId || matchingNotes.every((n) => n.id !== selectedNoteId);

  const handleConfirm = () => {
    if (confirmDisabled) return;
    onConfirm();
  };

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            Estimate WPM from a note
          </h2>
          <p id={descId} className={styles.subtitle}>
            Choose a note that contains this audio clip and transcript text.
          </p>
        </div>
        <div className={styles.body}>
          {loadingNotes ? <p className={styles.loadingState}>Loading your notes…</p> : null}
          {!loadingNotes && empty ? (
            <p className={styles.emptyState}>No matching transcript notes found for this audio file.</p>
          ) : null}
          {!loadingNotes && !empty ? (
            <>
              <span className={styles.listLabel} id={`${titleId}-list`}>
                Matching notes
              </span>
              <ul className={styles.radioList} role="radiogroup" aria-labelledby={`${titleId}-list`}>
                {matchingNotes.map((n) => {
                  const title = (n.title && n.title.trim()) || 'Untitled';
                  const meta = (n.modifiedAtSource && n.modifiedAtSource.trim()) || '';
                  return (
                    <li key={n.id} className={styles.radioItem}>
                      <label className={styles.radioLabel}>
                        <div className={styles.radioRow}>
                          <input
                            type="radio"
                            name={radioGroupName}
                            className={styles.radioInput}
                            checked={selectedNoteId === n.id}
                            onChange={() => onSelectedNoteIdChange(n.id)}
                          />
                          <span className={styles.radioTitle}>{title}</span>
                        </div>
                        {meta ? <span className={styles.radioMeta}>Modified {meta}</span> : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
          {errorMessage ? (
            <p className={styles.modalError} role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={onCancel}
            ref={cancelRef}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnConfirm}
            onClick={() => void handleConfirm()}
            disabled={confirmDisabled}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
