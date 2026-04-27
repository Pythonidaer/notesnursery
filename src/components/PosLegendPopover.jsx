import { posLegendRows } from '../lib/posAbbrevLegend.js';
import styles from './PosLegendPopover.module.css';

/**
 * @param {{
 *   abbreviations: string[],
 *   onClose: () => void,
 * }} props
 */
export default function PosLegendPopover({ abbreviations, onClose }) {
  const rows = posLegendRows(abbreviations);

  return (
    <div
      className={styles.popover}
      role="dialog"
      aria-label="Word tag key"
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>Tag key</h2>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className={styles.body}>
        {rows.length === 0 ? (
          <p className={styles.empty}>No tags in this note yet — add some text to analyze.</p>
        ) : (
          <ul className={styles.list}>
            {rows.map(({ abbrev, meaning }) => (
              <li key={abbrev} className={styles.row}>
                <code className={styles.abbr}>{abbrev}</code>
                <span className={styles.meaning}>{meaning}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
