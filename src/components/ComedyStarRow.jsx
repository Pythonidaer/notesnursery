import { useId } from 'react';
import { ratingToFiveStarDisplay } from '../utils/comedyRating.js';
import styles from './ComedyStarRow.module.css';

const STAR_PATH =
  'M12 2.2 15.1 8.6 22 9.5 17 14.3 18.2 21.2 12 17.8 5.8 21.2 7 14.3 2 9.5 8.9 8.6 12 2.2z';

/**
 * @param {{
 *   rating: number | null | undefined,
 *   variant?: 'card' | 'modal' | 'compact',
 *   interactive?: boolean,
 *   onStarHalfClick?: (starIndex: number, half: 'left' | 'right') => void,
 * }} props
 */
export default function ComedyStarRow({
  rating,
  variant = 'card',
  interactive = false,
  onStarHalfClick,
}) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const states = ratingToFiveStarDisplay(rating);

  return (
    <div
      className={`${styles.row} ${
        variant === 'modal' ? styles.rowModal : variant === 'compact' ? styles.rowCompact : styles.rowCard
      }`}
      role={interactive ? 'group' : undefined}
      aria-label={interactive ? 'Comedy performance rating' : undefined}
    >
      {states.map((state, i) => (
        <span key={i} className={styles.starWrap}>
          {interactive && onStarHalfClick ? (
            <>
              <button
                type="button"
                className={styles.halfBtn}
                aria-label={`${i + 1} star, left half`}
                onClick={() => onStarHalfClick(i, 'left')}
              />
              <button
                type="button"
                className={`${styles.halfBtn} ${styles.halfBtnRight}`}
                aria-label={`${i + 1} star, right half`}
                onClick={() => onStarHalfClick(i, 'right')}
              />
            </>
          ) : null}
          <svg
            className={styles.starSvg}
            viewBox="0 0 24 24"
            aria-hidden={interactive ? true : undefined}
          >
            <defs>
              <clipPath id={`${uid}-clip-${i}`}>
                <rect x="0" y="0" width="12" height="24" />
              </clipPath>
            </defs>
            <path className={styles.starOutline} d={STAR_PATH} />
            {state === 'full' ? (
              <path className={styles.starFill} d={STAR_PATH} />
            ) : state === 'half' ? (
              <path className={styles.starFill} d={STAR_PATH} clipPath={`url(#${uid}-clip-${i})`} />
            ) : null}
          </svg>
        </span>
      ))}
    </div>
  );
}
