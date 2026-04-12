import { forwardRef } from 'react';
import styles from './AddToNotePrompt.module.css';

/**
 * Lower-right compact prompt (toast-shaped) to start “add to note” flow.
 *
 * @param {{ visible: boolean, onClick: () => void }} props
 */
const AddToNotePrompt = forwardRef(function AddToNotePrompt({ visible, onClick }, ref) {
  if (!visible) return null;

  return (
    <button
      ref={ref}
      type="button"
      className={styles.prompt}
      onMouseDown={(e) => {
        // Keep the note’s text selection from collapsing before click runs; state is still the source of truth.
        e.preventDefault();
      }}
      onClick={onClick}
      aria-label="Add to existing note"
    >
      Add to Existing Note
    </button>
  );
});

export default AddToNotePrompt;
