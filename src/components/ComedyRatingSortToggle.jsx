import styles from './ComedyRatingSortToggle.module.css';

/** Shared 5-point star path — always filled; color from `className`. */
function StarIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 2.4l2.6 6.6 7 .6-5.3 4.6 1.6 6.8L12 17.6 6.1 21l1.6-6.8L2.4 9.6l7-.6L12 2.4z"
      />
    </svg>
  );
}

/** Neutral up+down (inactive sort direction). */
function ArrowUpDown({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="15"
      height="15"
      aria-hidden
      focusable="false"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m7 15 5 5 5-5M7 9l5-5 5 5"
      />
    </svg>
  );
}

function ArrowUpIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="15"
      height="15"
      aria-hidden
      focusable="false"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 19V5M5 12l7-7 7 7"
      />
    </svg>
  );
}

function ArrowDownIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="15"
      height="15"
      aria-hidden
      focusable="false"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 5v14M5 12l7 7 7-7"
      />
    </svg>
  );
}

/**
 * Third segment for Cards/Library: rating sort cycle (off → high → low).
 *
 * @param {{
 *   mode: 'off' | 'high' | 'low',
 *   onCycle: () => void,
 *   className: string,
 * }} props
 */
export default function ComedyRatingSortToggle({ mode, onCycle, className }) {
  const label =
    mode === 'off'
      ? 'Sort by rating (inactive)'
      : mode === 'high'
        ? 'Sort by rating, highest first'
        : 'Sort by rating, lowest first';

  const arrowNeutral = mode === 'off';
  const arrowHigh = mode === 'high';

  return (
    <button
      type="button"
      className={`${className} ${styles.ratingSegmentBtn}`}
      onClick={onCycle}
      aria-label={label}
      aria-pressed={mode !== 'off'}
      title={label}
    >
      <span className={styles.pair} aria-hidden>
        <StarIcon className={mode === 'off' ? styles.starInactive : styles.starActive} />
        {arrowNeutral ? (
          <ArrowUpDown className={styles.arrowNeutral} />
        ) : arrowHigh ? (
          <ArrowUpIcon className={styles.arrowStrong} />
        ) : (
          <ArrowDownIcon className={styles.arrowStrong} />
        )}
      </span>
    </button>
  );
}
