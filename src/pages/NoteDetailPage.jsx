import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import FloatingNewNoteComposer from '../components/FloatingNewNoteComposer.jsx';
import LabelPicker from '../components/LabelPicker.jsx';
import NoteInfoModal from '../components/NoteInfoModal.jsx';
import Toast from '../components/Toast.jsx';
import { requiresAuthForPersistence, useSupabaseBackend } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotes } from '../context/NotesContext.jsx';
import { formatNoteTimestamp } from '../utils/formatNoteTimestamp.js';
import { collectAllLabels } from '../utils/noteLabels.js';
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

export default function NoteDetailPage() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { user, authInitializing } = useAuth();
  const remote = useSupabaseBackend();
  const { notes, updateNote, deleteNote } = useNotes();
  const note = notes.find((n) => n.id === noteId);

  const [isEditing, setIsEditing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftPlain, setDraftPlain] = useState('');
  const originalBodyRef = useRef('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(/** @type {string | null} */ (null));
  const [actionError, setActionError] = useState(/** @type {string | null} */ (null));

  const labelSuggestions = useMemo(() => collectAllLabels(notes), [notes]);

  useEffect(() => {
    setIsEditing(false);
    setComposerOpen(false);
    setDraftPlain('');
    originalBodyRef.current = '';
  }, [noteId]);

  const dismissToast = useCallback(() => setToastMessage(null), []);

  if (remote && !authInitializing && !user) {
    return <Navigate to="/login" replace />;
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
    originalBodyRef.current = note.bodyHtml;
    setDraftPlain(htmlToPlain(note.bodyHtml));
    setIsEditing(true);
  };

  /** Discards in-progress body edits (restores saved body). Label edits stay applied. */
  const exitEditMode = async () => {
    setActionError(null);
    try {
      await updateNote(note.id, { bodyHtml: originalBodyRef.current });
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
    const modifiedAtSource = formatNoteTimestamp(new Date());
    console.log('[notes] save from detail start', { noteId: note.id });
    try {
      await updateNote(note.id, { bodyHtml: html, modifiedAtSource });
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

  const handleDelete = async () => {
    setActionError(null);
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    if (requiresAuthForPersistence() && !user) {
      navigate('/login');
      return;
    }
    console.log('[notes] delete from detail start', { noteId: note.id });
    try {
      await deleteNote(note.id);
      console.log('[notes] delete from detail ok', { noteId: note.id });
      navigate('/library', { replace: true });
    } catch (e) {
      console.error('[notes] delete from detail failed', e);
      setActionError(e instanceof Error ? e.message : 'Could not delete note');
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
            onClick={() => void handleDelete()}
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
              title="Discard body changes and exit edit"
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
          <h1 className={styles.title}>{note.title}</h1>
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

      <NoteInfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        sourceFileName={note.sourceFileName}
        createdAtSource={note.createdAtSource}
        modifiedAtSource={note.modifiedAtSource}
      />

      {isEditing ? (
        <div className={styles.editWrap}>
          <textarea
            className={styles.textarea}
            value={draftPlain}
            onChange={(e) => void onDraftChange(e.target.value)}
            rows={16}
            spellCheck
          />
        </div>
      ) : (
        <div
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: note.bodyHtml }}
        />
      )}

      <FloatingNewNoteComposer visible={composerOpen} onRequestClose={() => setComposerOpen(false)} />

      <Toast message={toastMessage} onDismiss={dismissToast} />
    </article>
  );
}
