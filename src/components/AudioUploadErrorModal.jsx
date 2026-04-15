import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatBytes } from '../utils/formatBytes.js';
import styles from './NoteInfoModal.module.css';

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   fileName: string,
 *   fileSizeBytes: number,
 *   maxUploadBytes: number,
 *   reason: string,
 *   isLikelySizeLimit: boolean,
 * }} props
 */
export default function AudioUploadErrorModal({
  open,
  onClose,
  fileName,
  fileSizeBytes,
  maxUploadBytes,
  reason,
  isLikelySizeLimit,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.dialog} ${styles.dialogWide}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="audio-upload-err-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="audio-upload-err-title" className={styles.title}>
            Audio upload failed
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>
        <dl className={styles.list}>
          <div className={styles.row}>
            <dt>File</dt>
            <dd>{fileName || '—'}</dd>
          </div>
          <div className={styles.row}>
            <dt>Size</dt>
            <dd>{formatBytes(fileSizeBytes)}</dd>
          </div>
          <div className={styles.row}>
            <dt>Upload limit (app check)</dt>
            <dd>{formatBytes(maxUploadBytes)}</dd>
          </div>
          <div className={styles.row}>
            <dt>What went wrong</dt>
            <dd>{reason}</dd>
          </div>
          {isLikelySizeLimit ? (
            <div className={styles.row}>
              <dt>What you can try</dt>
              <dd>
                <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.15rem' }}>
                  <li>Compress or export a smaller audio file, then try again.</li>
                  <li>Split long recordings into shorter clips.</li>
                  <li>
                    If your project uses a lower Storage limit, reduce file size to fit (
                    <a href="#audio-compression-help" style={{ color: 'var(--accent)' }}>
                      compression help
                    </a>{' '}
                    — placeholder for future guidance).
                  </li>
                </ul>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>,
    document.body
  );
}
