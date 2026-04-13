import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeLabel } from '../utils/noteLabels.js';
import styles from './LabelPicker.module.css';

function ChevronIcon({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={open ? styles.chevronOpen : undefined}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Searchable label combobox + chips for selected labels.
 *
 * @param {{
 *   availableLabels: string[],
 *   selectedLabels: string[],
 *   onChange: (next: string[]) => void,
 *   idPrefix?: string,
 *   placeholder?: string,
 *   align?: 'end' | 'stretch',
 *   variant?: 'default' | 'compact',
 *   layout?: 'stacked' | 'split' | 'noteHeader',
 *   For `noteHeader`, pass one child: the title row (e.g. title + info button) beside the label combo.
 *   Chips render below.
 *   chipsRowEnd?: import('react').ReactNode — optional trailing content in the chips row (e.g. comedy stars), right-aligned.
 *   children?: import('react').ReactNode,
 * }} props
 */
export default function LabelPicker({
  availableLabels,
  selectedLabels,
  onChange,
  idPrefix = 'label-picker',
  placeholder = 'Add label…',
  align = 'end',
  variant = 'default',
  layout = 'stacked',
  children = null,
  chipsRowEnd = null,
}) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const trimmed = normalizeLabel(query);

  const pool = useMemo(
    () =>
      availableLabels.filter(
        (a) => !selectedLabels.some((s) => s.toLowerCase() === a.toLowerCase())
      ),
    [availableLabels, selectedLabels]
  );

  const filtered = useMemo(() => {
    if (!trimmed) return pool;
    const q = trimmed.toLowerCase();
    return pool.filter((l) => l.toLowerCase().includes(q));
  }, [pool, trimmed]);

  const canCreate =
    Boolean(trimmed) &&
    !selectedLabels.some((s) => s.toLowerCase() === trimmed.toLowerCase()) &&
    !pool.some((p) => p.toLowerCase() === trimmed.toLowerCase());

  const showEmptyNoMatch = Boolean(trimmed) && filtered.length === 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(/** @type {Node} */ (e.target))) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const addLabel = (label) => {
    const t = normalizeLabel(label);
    if (!t) return;
    if (selectedLabels.some((s) => s.toLowerCase() === t.toLowerCase())) return;
    onChange([...selectedLabels, t]);
    setQuery('');
    setOpen(false);
  };

  const removeAt = (idx) => {
    onChange(selectedLabels.filter((_, i) => i !== idx));
  };

  const chipsEl = (
    <div className={styles.chips} role="list">
      {selectedLabels.map((l, i) => (
        <span key={`${l}-${i}`} className={styles.chip} role="listitem">
          <span className={styles.chipText}>{l}</span>
          <button
            type="button"
            className={styles.chipRemove}
            onClick={() => removeAt(i)}
            aria-label={`Remove label ${l}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );

  const comboEl = (
    <div className={styles.comboWrap}>
        <label className={styles.srOnly} htmlFor={`${idPrefix}-input`}>
          Search or add labels
        </label>
        <div className={styles.combo}>
          <input
            ref={inputRef}
            id={`${idPrefix}-input`}
            type="text"
            className={styles.input}
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                if (filtered.length > 0) {
                  addLabel(filtered[0]);
                } else if (canCreate) {
                  addLabel(trimmed);
                } else if (trimmed && pool.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
                  const exact = pool.find((p) => p.toLowerCase() === trimmed.toLowerCase());
                  if (exact) addLabel(exact);
                }
              }
            }}
          />
          <button
            type="button"
            className={styles.toggleBtn}
            aria-label={open ? 'Close label list' : 'Open label list'}
            aria-expanded={open}
            onClick={() => {
              setOpen((o) => !o);
              inputRef.current?.focus();
            }}
          >
            <ChevronIcon open={open} />
          </button>
        </div>

        {open ? (
          <div className={styles.dropdown} role="listbox">
            {!trimmed && pool.length === 0 ? (
              <div className={styles.hint}>No other labels yet. Type to add one.</div>
            ) : null}

            {filtered.map((label) => (
              <button
                key={label}
                type="button"
                role="option"
                className={styles.option}
                onClick={() => addLabel(label)}
              >
                {label}
              </button>
            ))}

            {showEmptyNoMatch ? (
              <div className={styles.noMatchBlock}>
                <div className={styles.noMatchText}>No option found</div>
                {canCreate ? (
                  <button
                    type="button"
                    className={styles.addNewBtn}
                    onClick={() => addLabel(trimmed)}
                  >
                    <PlusIcon />
                    <span>Add &quot;{trimmed}&quot;</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
  );

  const isSplit = layout === 'split';
  const isNoteHeader = layout === 'noteHeader';

  if (isNoteHeader) {
    return (
      <div
        className={`${styles.rootNoteHeader} ${variant === 'compact' ? styles.rootCompact : ''}`}
        ref={rootRef}
      >
        <div className={styles.noteHeaderMain}>
          <div className={styles.noteHeaderTopRow}>
            <div className={styles.titleInfoCluster}>{children}</div>
            <div className={styles.noteHeaderRight}>{comboEl}</div>
          </div>
          <div className={styles.noteHeaderChipsRow}>
            {chipsEl}
            {chipsRowEnd}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${
        isSplit ? styles.rootSplit : styles.root
      } ${!isSplit && align === 'stretch' ? styles.rootStretch : ''} ${
        variant === 'compact' ? styles.rootCompact : ''
      }`}
      ref={rootRef}
    >
      {isSplit ? (
        <>
          <div className={styles.splitChipsCol}>{chipsEl}</div>
          <div className={styles.splitComboCol}>{comboEl}</div>
        </>
      ) : (
        <>
          {chipsEl}
          {comboEl}
        </>
      )}
    </div>
  );
}
