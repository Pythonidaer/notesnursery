import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './TextColorModal.module.css';

const PRESETS = [
  { label: 'Gray', value: '#6b7280' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Violet', value: '#7c3aed' },
  { label: 'Pink', value: '#db2777' },
];

function colorToHex(/** @type {string | null} */ c) {
  if (!c || !c.trim()) return '#2563eb';
  const s = c.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(s)) {
    if (s.length === 4) {
      const r = s[1];
      const g = s[2];
      const b = s[3];
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return s.slice(0, 7);
  }
  const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const n = (x) => Math.max(0, Math.min(255, parseInt(x, 10))).toString(16).padStart(2, '0');
    return `#${n(m[1])}${n(m[2])}${n(m[3])}`;
  }
  return '#2563eb';
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   initialColor: string | null,
 *   canvasDark?: boolean,
 *   onApply: (hexOrNull: string | null) => void,
 * }} props
 */
export default function TextColorModal({
  open,
  onClose,
  initialColor,
  canvasDark = false,
  onApply,
}) {
  const [hex, setHex] = useState('#2563eb');
  const colorInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  useEffect(() => {
    if (!open) return;
    setHex(colorToHex(initialColor));
  }, [open, initialColor]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const applyHex = () => {
    onApply(hex);
    onClose();
  };

  const clearColor = () => {
    onApply(null);
    onClose();
  };

  return createPortal(
    <div
      className={styles.backdrop}
      data-nn-dismiss-shield
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        data-theme={canvasDark ? 'dark' : 'light'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="text-color-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="text-color-title" className={styles.title}>
            Text color
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={styles.body}>
          <label className={styles.wheelLabel} htmlFor="nn-text-color-wheel">
            Color wheel
          </label>
          <div className={styles.wheelRow}>
            <input
              ref={colorInputRef}
              id="nn-text-color-wheel"
              type="color"
              className={styles.colorWheel}
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              aria-label="Choose color"
            />
            <span className={styles.hexPreview} aria-hidden>
              {hex}
            </span>
          </div>
          <p className={styles.presetsLabel}>Presets</p>
          <div className={styles.presets}>
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={styles.presetBtn}
                style={{ backgroundColor: p.value }}
                title={p.label}
                aria-label={p.label}
                onClick={() => setHex(p.value)}
              />
            ))}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={clearColor}>
              Default
            </button>
            <button type="button" className={styles.primaryBtn} onClick={applyHex}>
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
