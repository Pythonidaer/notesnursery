import { useEffect, useId, useState } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import styles from './NoteFiltersToolbar.module.css';

/**
 * @param {{
 *   idPrefix: string,
 *   labelFilter: string,
 *   setLabelFilter: (v: string) => void,
 *   dateFilter: string,
 *   setDateFilter: (v: string) => void,
 *   dateOptions: { value: string, label: string }[],
 *   labelSelectOptions: string[],
 *   defaultLabelName: string | null,
 *   defaultLabelId: string | null,
 *   defaultLabelSaving: boolean,
 *   useRemote: boolean,
 *   user: { id?: string } | null,
 *   filtersActive: boolean,
 *   onSetDefault: () => void | Promise<void>,
 *   onClearDefault: () => void | Promise<void>,
 *   onResetFilters: () => void,
 * }} props
 */
export default function NoteFiltersToolbar({
  idPrefix,
  labelFilter,
  setLabelFilter,
  dateFilter,
  setDateFilter,
  dateOptions,
  labelSelectOptions,
  defaultLabelName,
  defaultLabelId,
  defaultLabelSaving,
  useRemote,
  user,
  filtersActive,
  onSetDefault,
  onClearDefault,
  onResetFilters,
}) {
  const isMobile = useMediaQuery('(max-width: 639px)');
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobile, mobileOpen]);

  const panelOpen = !isMobile || mobileOpen;

  return (
    <div className={styles.filterBlock}>
      <div className={styles.filterMobileBar} aria-hidden={!isMobile}>
        <button
          type="button"
          className={styles.mobileBarBtn}
          aria-expanded={mobileOpen}
          aria-controls={panelId}
          aria-label={mobileOpen ? 'Hide filters' : 'Show filters'}
          onClick={() => setMobileOpen((v) => !v)}
        >
          Filters
        </button>
        {filtersActive ? (
          <button type="button" className={styles.mobileBarBtn} onClick={onResetFilters}>
            Reset
          </button>
        ) : null}
      </div>

      <div
        id={panelId}
        className={styles.filterToolbarSlide}
        data-open={panelOpen}
        inert={isMobile && !mobileOpen ? true : undefined}
        aria-hidden={isMobile && !mobileOpen}
      >
        <div className={styles.filterToolbar} role="toolbar" aria-label="Filter notes">
        <div className={styles.filterField}>
          <label className={styles.filterLabel} htmlFor={`${idPrefix}-label-filter`}>
            Label
          </label>
          <select
            id={`${idPrefix}-label-filter`}
            className={styles.filterSelect}
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
          >
            <option value="all">All notes</option>
            <option value="unlabeled">Unlabeled</option>
            {labelSelectOptions.map((l) => (
              <option key={l} value={l}>
                {l}
                {defaultLabelName === l ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterField}>
          <label className={styles.filterLabel} htmlFor={`${idPrefix}-date-filter`}>
            Date
          </label>
          <select
            id={`${idPrefix}-date-filter`}
            className={styles.filterSelect}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            {dateOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {useRemote && user ? (
          <div className={styles.defaultPrefs}>
            <button
              type="button"
              className={styles.toolbarBtn}
              disabled={
                defaultLabelSaving || labelFilter === 'all' || labelFilter === 'unlabeled'
              }
              onClick={() => void onSetDefault()}
            >
              Set default
            </button>
            <button
              type="button"
              className={styles.toolbarBtn}
              disabled={defaultLabelSaving || !defaultLabelId}
              onClick={() => void onClearDefault()}
            >
              Remove default
            </button>
          </div>
        ) : null}
        {filtersActive && !isMobile ? (
          <button type="button" className={styles.toolbarBtn} onClick={onResetFilters}>
            Reset filters
          </button>
        ) : null}
        </div>
      </div>
    </div>
  );
}
