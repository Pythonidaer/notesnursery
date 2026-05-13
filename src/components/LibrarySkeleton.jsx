import { useSupabaseBackend } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import PageContentWrap from './PageContentWrap.jsx';
import styles from './LibrarySkeleton.module.css';

/*
 * Intentionally mirrors the Library page layout: search panel, top-bar
 * (heading + segment controls + plus button), filters toolbar, and note rows.
 *
 * Update this skeleton whenever the Library layout changes so the
 * loading → loaded transition remains visually seamless.
 */

// Variable title widths to make the skeleton look natural rather than uniform.
const ROW_WIDTHS = [68, 45, 82, 55, 72, 38, 60, 51];
// Show a label chip on roughly half the rows (indexes 0, 2, 4, 6).
const ROW_HAS_CHIP = [true, false, true, false, true, false, true, false];

export default function LibrarySkeleton() {
  const useRemote = useSupabaseBackend();
  const { user } = useAuth();
  const showSearch = useRemote && !!user;

  return (
    <PageContentWrap>
      <div role="status" aria-busy="true" aria-label="Loading library">
        {/* Screen-reader announcement; skeleton bones are aria-hidden */}
        <span className={styles.srOnly}>Loading your library…</span>

        {/* ── Semantic Search panel ──────────────────────────────────── */}
        {showSearch && (
          <div className={styles.searchPanel} aria-hidden="true">
            <div className={styles.searchHeader}>
              <span className={`${styles.bone} ${styles.searchIcon}`} />
              <span className={`${styles.bone} ${styles.searchTitle}`} />
            </div>
            <div className={styles.searchRow}>
              <span className={`${styles.bone} ${styles.searchInput}`} />
              <span className={`${styles.bone} ${styles.searchBtn}`} />
            </div>
          </div>
        )}

        {/* ── Top bar: heading + controls ───────────────────────────── */}
        <div className={styles.topBar} aria-hidden="true">
          <span className={`${styles.bone} ${styles.headingBone}`} />
          <div className={styles.topBarEnd}>
            <span className={`${styles.bone} ${styles.segmentBone}`} />
            <span className={`${styles.bone} ${styles.iconBone}`} />
          </div>
        </div>

        {/* ── Filters toolbar ───────────────────────────────────────── */}
        {/*
         * On mobile (≤639px) the real toolbar only shows a single "Filters"
         * toggle button; the full panel starts collapsed. Mirror that here.
         * On desktop all 5 controls are visible inline.
         */}
        <div className={styles.filtersBar} aria-hidden="true">
          {/* Mobile-only: "Filters" pill button bone */}
          <span className={`${styles.bone} ${styles.filterMobileBtn}`} />

          {/* Desktop-only: full filter controls */}
          <span className={`${styles.bone} ${styles.filterFieldLabel} ${styles.desktopFilter}`} />
          <span className={`${styles.bone} ${styles.filterFieldDate} ${styles.desktopFilter}`} />
          <span className={`${styles.bone} ${styles.filterBtnMd} ${styles.desktopFilter}`} />
          <span className={`${styles.bone} ${styles.filterBtnLg} ${styles.desktopFilter}`} />
          <span className={`${styles.bone} ${styles.filterBtnMd} ${styles.desktopFilter}`} />
        </div>

        {/* ── Note rows ─────────────────────────────────────────────── */}
        <ul className={styles.list} aria-hidden="true">
          {ROW_WIDTHS.map((pct, i) => (
            <li key={i} className={styles.rowItem}>
              <span
                className={`${styles.bone} ${styles.rowTitle}`}
                style={{ width: `${pct}%` }}
              />
              {ROW_HAS_CHIP[i] && (
                <span className={`${styles.bone} ${styles.rowChip}`} />
              )}
            </li>
          ))}
        </ul>
      </div>
    </PageContentWrap>
  );
}
