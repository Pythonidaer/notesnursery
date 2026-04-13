import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  isValidComedyRatingValue,
  parseComedyRating,
  ratingValueFromStarHalf,
} from '../utils/comedyRating.js';
import ComedyStarRow from './ComedyStarRow.jsx';
import styles from './ComedyRatingModal.module.css';

/**
 * @param {{
 *   open: boolean,
 *   heading: string,
 *   noteTitle: string,
 *   initialRating: number | null | undefined,
 *   onClose: () => void,
 *   onSave: (rating: number | null) => void | Promise<void>,
 *   saving?: boolean,
 *   errorMessage?: string | null,
 * }} props
 */
export default function ComedyRatingModal({
  open,
  heading,
  noteTitle,
  initialRating,
  onClose,
  onSave,
  saving = false,
  errorMessage = null,
}) {
  const cancelRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const [draft, setDraft] = useState(/** @type {number | null} */ (null));

  useEffect(() => {
    if (!open) return;
    setDraft(parseComedyRating(initialRating));
  }, [open, initialRating]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, saving]);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const handleStarHalf = (starIndex, half) => {
    const v = ratingValueFromStarHalf(starIndex, half);
    if (!isValidComedyRatingValue(v)) return;
    setDraft(v);
  };

  const handleClear = () => setDraft(null);

  const handleSave = () => {
    if (!isValidComedyRatingValue(draft)) return;
    void onSave(draft);
  };

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="comedy-rating-title"
        aria-describedby="comedy-rating-hint"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="comedy-rating-title" className={styles.title}>
            {heading}
          </h2>
          <p className={styles.noteTitle}>{noteTitle}</p>
        </div>
        <p id="comedy-rating-hint" className={styles.hint}>
          Tap the left or right half of a star to set half or full steps.
        </p>
        <div className={styles.stars}>
          <ComedyStarRow
            rating={draft}
            variant="modal"
            interactive
            onStarHalfClick={handleStarHalf}
          />
        </div>
        {errorMessage ? (
          <p className={styles.saveError} role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={onClose}
            disabled={saving}
            ref={cancelRef}
          >
            Cancel
          </button>
          <button type="button" className={styles.btnClear} onClick={handleClear} disabled={saving}>
            Clear rating
          </button>
          <button type="button" className={styles.btnSave} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
