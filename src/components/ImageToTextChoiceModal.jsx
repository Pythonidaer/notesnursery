import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Camera, FileUp } from 'lucide-react';
import styles from './ImageToTextChoiceModal.module.css';

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onPickFile: (file: File) => void,
 *   canvasDark?: boolean,
 *   loading?: boolean,
 *   error?: string | null,
 * }} props
 */
export default function ImageToTextChoiceModal({
  open,
  onClose,
  onPickFile,
  canvasDark = false,
  loading = false,
  error = null,
}) {
  const cameraRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const fileRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, loading]);

  if (!open) return null;

  const forwardFile = (/** @type {File | undefined} */ f) => {
    if (!f) return;
    onPickFile(f);
  };

  return createPortal(
    <div
      className={styles.backdrop}
      data-nn-dismiss-shield
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className={styles.dialog}
        data-theme={canvasDark ? 'dark' : 'light'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-to-text-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="image-to-text-title" className={styles.title}>
            Image to text
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className={styles.lead}>Add text from a photo using OCR.</p>
        <input
          ref={cameraRef}
          type="file"
          className={styles.hiddenInput}
          accept="image/*"
          capture="environment"
          tabIndex={-1}
          aria-hidden
          disabled={loading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            forwardFile(f);
          }}
        />
        <input
          ref={fileRef}
          type="file"
          className={styles.hiddenInput}
          accept="image/*"
          tabIndex={-1}
          aria-hidden
          disabled={loading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            forwardFile(f);
          }}
        />
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.actionBtn}
            disabled={loading}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className={styles.actionIcon} strokeWidth={2} aria-hidden />
            Take photo
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            disabled={loading}
            onClick={() => fileRef.current?.click()}
          >
            <FileUp className={styles.actionIcon} strokeWidth={2} aria-hidden />
            Choose photo
          </button>
        </div>
        {loading ? <p className={styles.status}>Reading text…</p> : null}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
