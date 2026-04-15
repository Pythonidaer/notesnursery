import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { listUserNoteAudioFiles } from '../lib/noteAudioList.js';
import { upsertNoteAudioDisplayName } from '../lib/noteAudioDisplayNames.js';
import { uploadNoteAudioFile } from '../lib/noteAudioUpload.js';
import { NOTE_AUDIO_MAX_UPLOAD_BYTES } from '../constants/noteAudio.js';
import { describeNoteAudioUploadFailure } from '../utils/noteAudioUploadErrors.js';
import { validateNoteAudioFile } from '../utils/noteAudioValidation.js';
import { formatBytes } from '../utils/formatBytes.js';
import {
  focusEditorAndCanInsertNoteAudio,
  insertNoteAudioBlock,
} from '../utils/insertNoteAudioBlock.js';
import styles from './NoteInfoModal.module.css';
import insertStyles from './InsertAudioModal.module.css';

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   userId: string,
 *   audioStorageScopeId: string,
 *   editor: import('@tiptap/core').Editor | null,
 *   onBlocked: () => void,
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
  onBlocked,
  onUploadFailure,
}) {
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [library, setLibrary] = useState(/** @type {Awaited<ReturnType<typeof listUserNoteAudioFiles>>} */ ([]));
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState(/** @type {string | null} */ (null));
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const pickerRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setLibraryOpen(false);
  }, [open]);

  useEffect(() => {
    if (!libraryOpen) return;
    const onDown = (/** @type {MouseEvent} */ e) => {
      const el = pickerRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setLibraryOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [libraryOpen]);

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
    if (!insertNoteAudioBlock(editor, attrs)) {
      onBlocked();
      return;
    }
    onClose();
  };

  const onPickExisting = (row) => {
    if (!editor) return;
    if (!focusEditorAndCanInsertNoteAudio(editor)) {
      onBlocked();
      return;
    }
    const label = row.displayName ?? row.fileName;
    insertAttrs({
      storagePath: row.path,
      fileName: label,
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

    if (!focusEditorAndCanInsertNoteAudio(editor)) {
      onBlocked();
      return;
    }

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
      const rec = await upsertNoteAudioDisplayName(userId, uploaded.path, uploaded.fileName);
      if (!rec.ok) console.error('[note-audio] record display name', rec.error);
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

  const onUploadButtonClick = () => {
    if (!editor) return;
    if (!focusEditorAndCanInsertNoteAudio(editor)) {
      onBlocked();
      return;
    }
    fileInputRef.current?.click();
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
            onClick={onUploadButtonClick}
          >
            {uploading ? 'Uploading…' : 'Upload new file'}
          </button>
          <p className={insertStyles.hint}>
            .wav or .mp3 — maximum {formatBytes(NOTE_AUDIO_MAX_UPLOAD_BYTES)} per file.
          </p>

          <span className={insertStyles.subheading} id="insert-audio-library-label">
            Your uploaded audio
          </span>
          {libraryLoading ? <p className={insertStyles.muted}>Loading…</p> : null}
          {libraryError ? <p className={insertStyles.error}>{libraryError}</p> : null}
          {!libraryLoading && !libraryError && library.length === 0 ? (
            <p className={insertStyles.muted}>No audio in storage yet. Upload a file first.</p>
          ) : null}
          {!libraryLoading && library.length > 0 ? (
            <div className={insertStyles.pickerWrap} ref={pickerRef}>
              <button
                type="button"
                id="insert-audio-library-trigger"
                className={`${insertStyles.pickerTrigger} ${libraryOpen ? insertStyles.pickerTriggerOpen : ''}`}
                aria-expanded={libraryOpen}
                aria-haspopup="listbox"
                aria-labelledby="insert-audio-library-label insert-audio-library-trigger"
                disabled={library.length === 0}
                onClick={() => setLibraryOpen((o) => !o)}
              >
                <span className={insertStyles.pickerTriggerLabel}>
                  {libraryOpen ? 'Choose a file…' : 'Choose from your library…'}
                </span>
                <ChevronDown className={insertStyles.pickerChevron} strokeWidth={2} aria-hidden />
              </button>
              {libraryOpen ? (
                <div
                  className={insertStyles.pickerPanel}
                  role="listbox"
                  aria-label="Previously uploaded audio"
                >
                  {library.map((row) => (
                    <button
                      key={row.path}
                      type="button"
                      role="option"
                      className={insertStyles.pickerOption}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setLibraryOpen(false);
                        onPickExisting(row);
                      }}
                    >
                      <span className={insertStyles.pickerOptionTitle}>{row.displayName ?? row.fileName}</span>
                      <span className={insertStyles.pickerOptionMeta}>
                        {formatBytes(row.sizeBytes)} ·{' '}
                        {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
