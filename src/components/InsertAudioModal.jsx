import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listUserNoteAudioFiles } from '../lib/noteAudioList.js';
import { uploadNoteAudioFile } from '../lib/noteAudioUpload.js';
import { NOTE_AUDIO_MAX_UPLOAD_BYTES } from '../constants/noteAudio.js';
import { describeNoteAudioUploadFailure } from '../utils/noteAudioUploadErrors.js';
import { validateNoteAudioFile } from '../utils/noteAudioValidation.js';
import { formatBytes } from '../utils/formatBytes.js';
import styles from './NoteInfoModal.module.css';
import insertStyles from './InsertAudioModal.module.css';

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   userId: string,
 *   audioStorageScopeId: string,
 *   editor: import('@tiptap/core').Editor | null,
 *   onUploadFailure: (detail: {
 *     fileName: string,
 *     fileSizeBytes: number,
 *     maxBytes: number,
 *     reason: string,
 *     isLikelySizeLimit: boolean,
 *   }) => void,
 * }} props
 */
export default function InsertAudioModal({
  open,
  onClose,
  userId,
  audioStorageScopeId,
  editor,
  onUploadFailure,
}) {
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [library, setLibrary] = useState(/** @type {Awaited<ReturnType<typeof listUserNoteAudioFiles>>} */ ([]));
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState(/** @type {string | null} */ (null));
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLibraryError(null);
    setLibraryLoading(true);
    listUserNoteAudioFiles(userId)
      .then((rows) => {
        if (!cancelled) setLibrary(rows);
      })
      .catch((e) => {
        if (!cancelled) setLibraryError(e instanceof Error ? e.message : 'Could not list files');
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  if (!open) return null;

  const insertAttrs = (attrs) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'noteAudio',
        attrs,
      })
      .run();
    onClose();
  };

  const onPickExisting = (row) => {
    insertAttrs({
      storagePath: row.path,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      uploadedAt: row.updatedAt || new Date().toISOString(),
    });
  };

  /** @param {import('react').ChangeEvent<HTMLInputElement>} e */
  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editor) return;

    const check = validateNoteAudioFile(file);
    if (!check.ok) {
      onUploadFailure({
        fileName: file.name,
        fileSizeBytes: file.size,
        maxBytes: NOTE_AUDIO_MAX_UPLOAD_BYTES,
        reason: check.message ?? 'Invalid file',
        isLikelySizeLimit: false,
      });
      onClose();
      return;
    }

    if (file.size > NOTE_AUDIO_MAX_UPLOAD_BYTES) {
      onUploadFailure({
        fileName: file.name,
        fileSizeBytes: file.size,
        maxBytes: NOTE_AUDIO_MAX_UPLOAD_BYTES,
        reason: `This file (${formatBytes(file.size)}) exceeds the current upload limit (${formatBytes(NOTE_AUDIO_MAX_UPLOAD_BYTES)}).`,
        isLikelySizeLimit: true,
      });
      onClose();
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadNoteAudioFile(userId, audioStorageScopeId, file);
      insertAttrs({
        storagePath: uploaded.path,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        uploadedAt: new Date().toISOString(),
      });
    } catch (err) {
      const { reason, isLikelySizeLimit } = describeNoteAudioUploadFailure(err, {
        fileName: file.name,
        fileSizeBytes: file.size,
        maxBytes: NOTE_AUDIO_MAX_UPLOAD_BYTES,
      });
      onUploadFailure({
        fileName: file.name,
        fileSizeBytes: file.size,
        maxBytes: NOTE_AUDIO_MAX_UPLOAD_BYTES,
        reason,
        isLikelySizeLimit,
      });
      onClose();
    } finally {
      setUploading(false);
    }
  };

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="insert-audio-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="insert-audio-title" className={styles.title}>
            Insert audio
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
        <div className={insertStyles.body}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,audio/wav,audio/wave,audio/x-wav,audio/mpeg,audio/mp3"
            className={insertStyles.hiddenInput}
            aria-hidden
            tabIndex={-1}
            onChange={(ev) => void onFileChange(ev)}
          />
          <button
            type="button"
            className={insertStyles.primaryBtn}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Upload new file'}
          </button>
          <p className={insertStyles.hint}>
            .wav or .mp3 — max {formatBytes(NOTE_AUDIO_MAX_UPLOAD_BYTES)} per file (client check; your project may
            enforce a different limit).
          </p>

          <h3 className={insertStyles.subheading}>Your uploaded audio</h3>
          {libraryLoading ? <p className={insertStyles.muted}>Loading…</p> : null}
          {libraryError ? <p className={insertStyles.error}>{libraryError}</p> : null}
          {!libraryLoading && !libraryError && library.length === 0 ? (
            <p className={insertStyles.muted}>No audio in storage yet. Upload a file first.</p>
          ) : null}
          {!libraryLoading && library.length > 0 ? (
            <ul className={insertStyles.list} role="listbox" aria-label="Previously uploaded audio">
              {library.map((row) => (
                <li key={row.path}>
                  <button
                    type="button"
                    className={insertStyles.rowBtn}
                    onClick={() => onPickExisting(row)}
                  >
                    <span className={insertStyles.rowName}>{row.fileName}</span>
                    <span className={insertStyles.rowMeta}>
                      {formatBytes(row.sizeBytes)} · {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
