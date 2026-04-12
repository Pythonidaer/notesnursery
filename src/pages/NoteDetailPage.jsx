import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import AddToNotePrompt from '../components/AddToNotePrompt.jsx';
import DeleteNoteModal from '../components/DeleteNoteModal.jsx';
import FloatingNewNoteComposer from '../components/FloatingNewNoteComposer.jsx';
import LabelPicker from '../components/LabelPicker.jsx';
import NoteInfoModal from '../components/NoteInfoModal.jsx';
import NoteTransferPanel from '../components/NoteTransferPanel.jsx';
import Toast from '../components/Toast.jsx';
import { requiresAuthForPersistence, useSupabaseBackend } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotes } from '../context/NotesContext.jsx';
import { collectAllLabels } from '../utils/noteLabels.js';
import { normalizeNoteSourceDateInput } from '../utils/parseAppleNoteDate.js';
import { htmlToPlain, plainTextToHtmlBody } from '../utils/noteBodyPlain.js';
import styles from './NoteDetailPage.module.css';

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 16v-5M12 8h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NoteDetailSkeleton() {
  return (
    <div className={styles.article} aria-busy="true" aria-live="polite">
      <div className={styles.topBar}>
        <Link to="/library" className={styles.back}>
          ← Library
        </Link>
        <div className={styles.skeletonToolbar} aria-hidden />
      </div>
      <div className={styles.skeletonHeader}>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonMetaRow}>
          <span className={styles.skeletonChip} />
          <span className={styles.skeletonChip} />
        </div>
      </div>
      <div className={styles.skeletonBody}>
        <div className={`${styles.skeletonLine} ${styles.skeletonLineLong}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonLineLong}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonLineMed}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
      </div>
      <p className={styles.loadingHint}>Loading note…</p>
    </div>
  );
}

export default function NoteDetailPage() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { user, authInitializing } = useAuth();
  const remote = useSupabaseBackend();
  const { notes, updateNote, deleteNote, noteListReady } = useNotes();
  const note = notes.find((n) => n.id === noteId);

  const isLoadingNote =
    remote && (authInitializing || (Boolean(user) && !noteListReady));

  const [isEditing, setIsEditing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftPlain, setDraftPlain] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCreatedAt, setDraftCreatedAt] = useState('');
  const originalBodyRef = useRef('');
  const originalTitleRef = useRef('');
  const originalCreatedRef = useRef('');
  const originalModifiedRef = useRef('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(/** @type {string | null} */ (null));
  const [actionError, setActionError] = useState(/** @type {string | null} */ (null));
  const [selectedText, setSelectedText] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSnippet, setTransferSnippet] = useState('');
  const bodyRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const textareaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const addToNotePromptRef = useRef(/** @type {HTMLButtonElement | null} */ (null));

  const labelSuggestions = useMemo(() => collectAllLabels(notes), [notes]);

  /**
   * @param {MouseEvent | KeyboardEvent | TouchEvent | undefined} [e]
   */
  const syncSelection = useCallback((e) => {
    if (transferOpen) return;
    const t = e && 'target' in e ? e.target : null;
    if (t instanceof Node && addToNotePromptRef.current?.contains(t)) {
      return;
    }
    if (isEditing) {
      const ta = textareaRef.current;
      if (!ta) {
        setSelectedText('');
        return;
      }
      const str = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (str.trim()) {
        setSelectedText(str);
        return;
      }
      if (addToNotePromptRef.current?.contains(document.activeElement)) return;
      setSelectedText('');
      return;
    }
    const host = bodyRef.current;
    if (!host) {
      setSelectedText('');
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      if (addToNotePromptRef.current?.contains(document.activeElement)) return;
      setSelectedText('');
      return;
    }
    const range = sel.getRangeAt(0);
    // Require both endpoints inside the note body so we never accept a stray range.
    // Do not use the host's full innerText/textContent — only the live Range string.
    const startOk = host.contains(range.startContainer);
    const endOk = host.contains(range.endContainer);
    if (!startOk || !endOk) {
      setSelectedText('');
      return;
    }
    const text = range.toString();
    if (text.trim()) setSelectedText(text);
    else setSelectedText('');
  }, [isEditing, transferOpen]);

  useEffect(() => {
    setIsEditing(false);
    setComposerOpen(false);
    setDeleteModalOpen(false);
    setSelectedText('');
    setTransferOpen(false);
    setTransferSnippet('');
    setDraftPlain('');
    setDraftTitle('');
    setDraftCreatedAt('');
    originalBodyRef.current = '';
    originalTitleRef.current = '';
    originalCreatedRef.current = '';
    originalModifiedRef.current = '';
  }, [noteId]);

  useEffect(() => {
    // Avoid document "selectionchange" for read mode: it fires mid-drag with unstable
    // ranges (often wrong "from start of block" text). Sync after the browser finalizes
    // the selection on mouse/touch release or keyboard moves.
    document.addEventListener('mouseup', syncSelection);
    document.addEventListener('keyup', syncSelection);
    document.addEventListener('touchend', syncSelection, { passive: true });
    return () => {
      document.removeEventListener('mouseup', syncSelection);
      document.removeEventListener('keyup', syncSelection);
      document.removeEventListener('touchend', syncSelection);
    };
  }, [syncSelection]);

  const dismissToast = useCallback(() => setToastMessage(null), []);

  if (remote && !authInitializing && !user) {
    return <Navigate to="/login" replace />;
  }

  if (isLoadingNote) {
    return <NoteDetailSkeleton />;
  }

  if (!note) {
    return (
      <div className={styles.notFound}>
        <h1 className={styles.heading}>Note not found</h1>
        <p className={styles.lead}>
          It may have been cleared when you refreshed, or the link is invalid.
        </p>
        <Link to="/library" className={styles.backLink}>
          Back to library
        </Link>
      </div>
    );
  }

  const startEdit = () => {
    setActionError(null);
    originalTitleRef.current = note.title;
    originalCreatedRef.current = note.createdAtSource ?? '';
    originalModifiedRef.current = note.modifiedAtSource ?? '';
    originalBodyRef.current = note.bodyHtml;
    setDraftTitle(note.title);
    setDraftCreatedAt(note.createdAtSource ?? '');
    setDraftPlain(htmlToPlain(note.bodyHtml));
    setIsEditing(true);
  };

  /** Discards in-progress edits (title, dates, body). Label edits stay applied. */
  const exitEditMode = async () => {
    setActionError(null);
    try {
      await updateNote(note.id, {
        title: originalTitleRef.current,
        bodyHtml: originalBodyRef.current,
        createdAtSource: originalCreatedRef.current,
        modifiedAtSource: originalModifiedRef.current,
      });
      setDraftTitle(originalTitleRef.current);
      setDraftCreatedAt(originalCreatedRef.current);
      setDraftPlain(htmlToPlain(originalBodyRef.current));
      setIsEditing(false);
    } catch (e) {
      console.error('[notes] discard edit failed', e);
      setActionError(e instanceof Error ? e.message : 'Could not revert changes');
    }
  };

  const onDraftChange = (value) => {
    setDraftPlain(value);
  };

  const handleSave = async () => {
    setActionError(null);
    if (!isEditing) return;
    if (requiresAuthForPersistence() && !user) {
      navigate('/login');
      return;
    }
    setSaving(true);
    const html = plainTextToHtmlBody(draftPlain);
    const createdNorm = normalizeNoteSourceDateInput(draftCreatedAt);
    const modifiedNorm = normalizeNoteSourceDateInput(originalModifiedRef.current);
    const titleSaved = draftTitle.trim() || 'Untitled';
    console.log('[notes] save from detail start', { noteId: note.id });
    try {
      await updateNote(note.id, {
        title: titleSaved,
        bodyHtml: html,
        createdAtSource: createdNorm,
        modifiedAtSource: modifiedNorm,
      });
      originalTitleRef.current = titleSaved;
      originalCreatedRef.current = createdNorm;
      originalBodyRef.current = html;
      setIsEditing(false);
      setToastMessage('Note saved');
      console.log('[notes] save from detail ok', { noteId: note.id });
    } catch (e) {
      console.error('[notes] save from detail failed', e);
      setActionError(e instanceof Error ? e.message : 'Could not save note');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setActionError(null);
    if (requiresAuthForPersistence() && !user) {
      setDeleteModalOpen(false);
      navigate('/login');
      return;
    }
    console.log('[notes] delete from detail start', { noteId: note.id });
    setDeleteInProgress(true);
    try {
      await deleteNote(note.id);
      console.log('[notes] delete from detail ok', { noteId: note.id });
      setDeleteModalOpen(false);
      navigate('/library', { replace: true, state: { flashToast: 'Note deleted' } });
    } catch (e) {
      console.error('[notes] delete from detail failed', e);
      setActionError(e instanceof Error ? e.message : 'Could not delete note');
      setDeleteModalOpen(false);
    } finally {
      setDeleteInProgress(false);
    }
  };

  const currentLabels = note.labels ?? [];

  return (
    <article className={styles.article}>
      <div className={styles.topBar}>
        <Link to="/library" className={styles.back}>
          ← Library
        </Link>
        <div className={styles.topActions} role="toolbar" aria-label="Note actions">
          <button
            type="button"
            className={styles.iconBtn}
            onClick={startEdit}
            disabled={isEditing || saving}
            aria-label="Edit note"
            title="Edit"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => void handleSave()}
            disabled={!isEditing || saving}
            aria-label="Save note"
            title="Save"
          >
            <SaveIcon />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setComposerOpen(true)}
            disabled={saving}
            aria-label="Add new note"
            title="Add note"
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setDeleteModalOpen(true)}
            disabled={saving}
            aria-label="Delete note"
            title="Delete note"
          >
            <TrashIcon />
          </button>
          {isEditing ? (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => void exitEditMode()}
              disabled={saving}
              aria-label="Exit edit mode"
              title="Discard changes and exit edit"
            >
              <XIcon />
            </button>
          ) : null}
        </div>
      </div>

      {actionError ? <p className={styles.actionError}>{actionError}</p> : null}

      <header className={styles.header}>
        <LabelPicker
          idPrefix="detail"
          availableLabels={labelSuggestions}
          selectedLabels={currentLabels}
          onChange={(next) => void updateNote(note.id, { labels: next })}
          placeholder="Add label…"
          layout="noteHeader"
          variant="compact"
        >
          {isEditing ? (
            <input
              id="note-detail-title"
              className={styles.titleInput}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              aria-label="Note title"
              placeholder="Title"
            />
          ) : (
            <h1 className={styles.title}>{note.title}</h1>
          )}
          <button
            type="button"
            className={styles.infoBtn}
            onClick={() => setInfoOpen(true)}
            aria-label="Note info"
            title="Get info"
          >
            <InfoIcon />
          </button>
        </LabelPicker>
      </header>

      {isEditing ? (
        <div className={styles.metaEdit}>
          <div className={styles.metaEditField}>
            <label className={styles.metaEditLabel} htmlFor="note-source-created">
              Source created
            </label>
            <input
              id="note-source-created"
              className={styles.metaEditInput}
              value={draftCreatedAt}
              onChange={(e) => setDraftCreatedAt(e.target.value)}
              placeholder="YYYY-MM-DD or paste text"
              autoComplete="off"
            />
          </div>
        </div>
      ) : null}

      <NoteInfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        sourceFileName={note.sourceFileName}
        createdAtSource={note.createdAtSource}
        modifiedAtSource={note.modifiedAtSource}
      />

      <DeleteNoteModal
        open={deleteModalOpen}
        title="Delete note?"
        message="This cannot be undone."
        onCancel={() => {
          if (!deleteInProgress) setDeleteModalOpen(false);
        }}
        onConfirm={() => void handleConfirmDelete()}
        deleting={deleteInProgress}
      />

      {isEditing ? (
        <div className={styles.editWrap}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={draftPlain}
            onChange={(e) => void onDraftChange(e.target.value)}
            onMouseUp={syncSelection}
            onKeyUp={syncSelection}
            rows={16}
            spellCheck
          />
        </div>
      ) : (
        <div
          ref={bodyRef}
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: note.bodyHtml }}
        />
      )}

      <AddToNotePrompt
        ref={addToNotePromptRef}
        visible={Boolean(selectedText.trim()) && !transferOpen}
        onClick={() => {
          const snippet = selectedText.trim();
          if (!snippet) return;
          setTransferSnippet(snippet);
          setTransferOpen(true);
        }}
      />

      <NoteTransferPanel
        visible={transferOpen}
        onRequestClose={() => setTransferOpen(false)}
        currentNoteId={note.id}
        snippetPlain={transferSnippet}
        onSaved={() => setToastMessage('Added to note')}
      />

      <FloatingNewNoteComposer visible={composerOpen} onRequestClose={() => setComposerOpen(false)} />

      <Toast message={toastMessage} onDismiss={dismissToast} />
    </article>
  );
}
