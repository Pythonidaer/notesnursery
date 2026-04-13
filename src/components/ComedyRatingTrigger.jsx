import { useCallback, useState } from 'react';
import { useSupabaseBackend } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotes } from '../context/NotesContext.jsx';
import {
  isValidComedyRatingValue,
  parseComedyRating,
  shouldShowComedyRating,
} from '../utils/comedyRating.js';
import ComedyRatingModal from './ComedyRatingModal.jsx';
import ComedyStarRow from './ComedyStarRow.jsx';
import styles from './ComedyRatingTrigger.module.css';

/**
 * Shared comedy rating button + modal (Cards, Library, note detail). Renders nothing when gated off.
 *
 * @param {{
 *   note: { id: string, title: string, comedyRating?: number | null, labels?: string[] },
 *   variant: 'card' | 'library' | 'detail',
 * }} props
 */
export default function ComedyRatingTrigger({ note, variant }) {
  const { user } = useAuth();
  const { updateNote } = useNotes();
  const useRemote = useSupabaseBackend();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(/** @type {string | null} */ (null));

  const show = shouldShowComedyRating({ useRemote, user, note });
  const starVariant = variant === 'card' ? 'card' : 'compact';

  const handleOpen = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setSaveError(null);
    setModalOpen(true);
  }, []);

  const handleSave = useCallback(
    async (/** @type {number | null} */ rating) => {
      if (!isValidComedyRatingValue(rating)) return;
      setSaving(true);
      setSaveError(null);
      try {
        await updateNote(note.id, { comedyRating: rating });
        setModalOpen(false);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Could not save rating');
      } finally {
        setSaving(false);
      }
    },
    [note.id, updateNote]
  );

  if (!show) return null;

  const btnClass =
    variant === 'card' ? styles.btnCard : variant === 'library' ? styles.btnLibrary : styles.btnDetail;

  const triggerBtn = (
    <button
      type="button"
      className={btnClass}
      onClick={handleOpen}
      aria-label="Open comedy rating"
    >
      <ComedyStarRow rating={note.comedyRating} variant={starVariant} />
    </button>
  );

  return (
    <>
      {variant === 'detail' ? <span className={styles.detailSlot}>{triggerBtn}</span> : triggerBtn}
      <ComedyRatingModal
        open={modalOpen}
        heading="Comedy performance"
        noteTitle={note.title || 'Untitled'}
        initialRating={parseComedyRating(note.comedyRating)}
        onClose={() => {
          if (!saving) {
            setSaveError(null);
            setModalOpen(false);
          }
        }}
        onSave={handleSave}
        saving={saving}
        errorMessage={saveError}
      />
    </>
  );
}
