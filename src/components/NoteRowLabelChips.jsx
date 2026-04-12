import labelPickerStyles from './LabelPicker.module.css';
import styles from './NoteRowLabelChips.module.css';

/**
 * Read-only label pills for library rows (matches note-detail chip look).
 * @param {{ labels?: string[] }} props
 */
export default function NoteRowLabelChips({ labels }) {
  const list = labels ?? [];
  if (list.length === 0) return null;

  return (
    <span className={styles.wrap} aria-label={`Labels: ${list.join(', ')}`}>
      {list.map((name) => (
        <span key={name} className={labelPickerStyles.chip}>
          <span className={labelPickerStyles.chipText}>{name}</span>
        </span>
      ))}
    </span>
  );
}
