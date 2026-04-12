import { useEffect, useMemo, useRef, useState } from 'react';
import lpStyles from './LabelPicker.module.css';
import styles from './NotePicker.module.css';

function ChevronIcon({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={open ? lpStyles.chevronOpen : undefined}
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

/**
 * Searchable single-select combobox for picking a note by title (LabelPicker-style UX).
 *
 * @param {{
 *   idPrefix?: string,
 *   notes: { id: string, title: string }[],
 *   excludeId?: string | null,
 *   selectedId: string | null,
 *   onSelect: (id: string | null) => void,
 *   placeholder?: string,
 * }} props
 */
export default function NotePicker({
  idPrefix = 'note-picker',
  notes,
  excludeId = null,
  selectedId,
  onSelect,
  placeholder = 'Search notes…',
}) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const pool = useMemo(
    () => notes.filter((n) => n.id !== excludeId),
    [notes, excludeId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((n) => n.title.toLowerCase().includes(q));
  }, [pool, query]);

  useEffect(() => {
    if (!selectedId) return;
    const n = notes.find((x) => x.id === selectedId);
    if (n) setQuery(n.title);
  }, [selectedId, notes]);

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

  const pick = (id) => {
    onSelect(id);
    setOpen(false);
  };

  const clear = () => {
    onSelect(null);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={lpStyles.comboWrap} style={{ width: '100%', alignSelf: 'stretch' }}>
      <label className={lpStyles.srOnly} htmlFor={`${idPrefix}-input`}>
        Choose destination note
      </label>
      <div className={lpStyles.combo}>
        <input
          ref={inputRef}
          id={`${idPrefix}-input`}
          type="text"
          className={lpStyles.input}
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setOpen(true);
            if (selectedId) {
              const n = notes.find((x) => x.id === selectedId);
              if (n && n.title !== next) onSelect(null);
            }
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
              if (filtered.length > 0) pick(filtered[0].id);
            }
          }}
        />
        <button
          type="button"
          className={lpStyles.toggleBtn}
          aria-label={open ? 'Close note list' : 'Open note list'}
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
        <div className={lpStyles.dropdown} role="listbox">
          {pool.length === 0 ? (
            <div className={lpStyles.hint}>No other notes available.</div>
          ) : filtered.length === 0 ? (
            <div className={lpStyles.hint}>No matching notes.</div>
          ) : (
            filtered.map((n) => (
              <button
                key={n.id}
                type="button"
                role="option"
                className={lpStyles.option}
                onClick={() => pick(n.id)}
              >
                {n.title || 'Untitled'}
              </button>
            ))
          )}
        </div>
      ) : null}

      {selectedId ? (
        <button type="button" className={styles.clearBtn} onClick={clear}>
          Clear selection
        </button>
      ) : null}
    </div>
  );
}
