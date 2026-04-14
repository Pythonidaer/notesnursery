import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import PlusIcon from '../components/PlusIcon.jsx';
import ComedyRatingTrigger from '../components/ComedyRatingTrigger.jsx';
import DeleteNoteModal from '../components/DeleteNoteModal.jsx';
import NoteBodyContent from '../components/NoteBodyContent.jsx';
import NoteRichTextEditor from '../components/NoteRichTextEditor.jsx';
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
import {
  CONTENT_TYPE_HTML,
  CONTENT_TYPE_MARKDOWN,
  normalizeContentType,
} from '../utils/noteContentModel.js';
import { markdownToHtmlForEditor } from '../utils/markdownToHtmlForEditor.js';
import { sanitizeNoteHtml } from '../utils/sanitizeNoteHtml.js';
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

/** Browser back when possible; else `location.state.from` from list links; else `/library`. */
function BackNav({ className }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    const from = location.state?.from;
    if (typeof from === 'string' && from.startsWith('/')) {
      navigate(from);
      return;
    }
    navigate('/library');
  }, [navigate, location.state]);

  return (
    <button type="button" className={className ?? styles.back} onClick={handleBack} aria-label="Go back">
      ← Back
    </button>
  );
}

function NoteDetailSkeleton() {
  return (
    <div className={styles.article} aria-busy="true" aria-live="polite">
      <div className={styles.topBar}>
        <BackNav />
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
  const [draftHtml, setDraftHtml] = useState('');
  /** Bumps when entering edit so TipTap remounts with fresh HTML. */
  const [editSessionKey, setEditSessionKey] = useState(0);
  /** True when this edit session started from a markdown-stored note (hint only). */
  const [editStartedFromMarkdown, setEditStartedFromMarkdown] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCreatedAt, setDraftCreatedAt] = useState('');
  const originalBodyRef = useRef('');
  const originalMarkdownRef = useRef('');
  /** Snapshot of `content_type` when edit began (for discard). */
  const originalContentTypeRef = useRef(/** @type {string} */ (CONTENT_TYPE_HTML));
  const originalTitleRef = useRef('');
  const originalCreatedRef = useRef('');
  const originalModifiedRef = useRef('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(/** @type {string | null} */ (null));
  const [actionError, setActionError] = useState(/** @type {string | null} */ (null));
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSnippet, setTransferSnippet] = useState('');
  const tiptapRef = useRef(/** @type {import('@tiptap/core').Editor | null} */ (null));

  const labelSuggestions = useMemo(() => collectAllLabels(notes), [notes]);

  const handleEditorReady = useCallback((ed) => {
    tiptapRef.current = ed;
  }, []);

  const openTransferWithEditorSelection = useCallback(() => {
    const ed = tiptapRef.current;
    if (!ed) return;
    const { from, to } = ed.state.selection;
    const snippet = ed.state.doc.textBetween(from, to, '\n\n').trim();
    if (!snippet) {
      setToastMessage('Select text in the note body first');
      return;
    }
    setTransferSnippet(snippet);
    setTransferOpen(true);
  }, []);

  useEffect(() => {
    setIsEditing(false);
    setComposerOpen(false);
    setDeleteModalOpen(false);
    setTransferOpen(false);
    setTransferSnippet('');
    setDraftHtml('');
    setEditStartedFromMarkdown(false);
    setDraftTitle('');
    setDraftCreatedAt('');
    originalBodyRef.current = '';
    originalMarkdownRef.current = '';
    originalContentTypeRef.current = CONTENT_TYPE_HTML;
    originalTitleRef.current = '';
    originalCreatedRef.current = '';
    originalModifiedRef.current = '';
  }, [noteId]);

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
        <BackNav className={styles.backLink} />
      </div>
    );
  }

  const startEdit = () => {
    setActionError(null);
    originalTitleRef.current = note.title;
    originalCreatedRef.current = note.createdAtSource ?? '';
    originalModifiedRef.current = note.modifiedAtSource ?? '';
    originalBodyRef.current = note.bodyHtml ?? '';
    originalMarkdownRef.current = note.bodyMarkdown ?? '';
    const ct = normalizeContentType(note.contentType);
    originalContentTypeRef.current = ct;
    const fromMd = ct === CONTENT_TYPE_MARKDOWN;
    setEditStartedFromMarkdown(fromMd);
    const html = fromMd
      ? markdownToHtmlForEditor(note.bodyMarkdown ?? '')
      : sanitizeNoteHtml(note.bodyHtml ?? '') || '<p></p>';
    setDraftHtml(html);
    setEditSessionKey((k) => k + 1);
    setDraftTitle(note.title);
    setDraftCreatedAt(note.createdAtSource ?? '');
    setIsEditing(true);
  };

  /** Discards in-progress edits (title, dates, body). Label edits stay applied. */
  const exitEditMode = async () => {
    setActionError(null);
    try {
      const base = {
        title: originalTitleRef.current,
        createdAtSource: originalCreatedRef.current,
        modifiedAtSource: originalModifiedRef.current,
      };
      if (originalContentTypeRef.current === CONTENT_TYPE_MARKDOWN) {
        await updateNote(note.id, {
          ...base,
          bodyHtml: originalBodyRef.current,
          bodyMarkdown: originalMarkdownRef.current,
          contentType: CONTENT_TYPE_MARKDOWN,
        });
      } else {
        await updateNote(note.id, {
          ...base,
          bodyHtml: originalBodyRef.current,
          bodyMarkdown: null,
          contentType: CONTENT_TYPE_HTML,
        });
      }
      setDraftTitle(originalTitleRef.current);
      setDraftCreatedAt(originalCreatedRef.current);
      setEditStartedFromMarkdown(false);
      setIsEditing(false);
    } catch (e) {
      console.error('[notes] discard edit failed', e);
      setActionError(e instanceof Error ? e.message : 'Could not revert changes');
    }
  };

  const handleSave = async () => {
    setActionError(null);
    if (!isEditing) return;
    if (requiresAuthForPersistence() && !user) {
      navigate('/login');
      return;
    }
    setSaving(true);
    const createdNorm = normalizeNoteSourceDateInput(draftCreatedAt);
    const modifiedNorm = normalizeNoteSourceDateInput(originalModifiedRef.current);
    const titleSaved = draftTitle.trim() || 'Untitled';
    const bodySaved = sanitizeNoteHtml(draftHtml);
    try {
      await updateNote(note.id, {
        title: titleSaved,
        bodyHtml: bodySaved,
        bodyMarkdown: null,
        contentType: CONTENT_TYPE_HTML,
        createdAtSource: createdNorm,
        modifiedAtSource: modifiedNorm,
      });
      originalTitleRef.current = titleSaved;
      originalCreatedRef.current = createdNorm;
      originalMarkdownRef.current = '';
      originalBodyRef.current = bodySaved;
      originalContentTypeRef.current = CONTENT_TYPE_HTML;
      setEditStartedFromMarkdown(false);
      setIsEditing(false);
      setToastMessage('Note saved');
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
    setDeleteInProgress(true);
    try {
      await deleteNote(note.id);
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
        <BackNav />
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
            title="Delete"
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
          chipsRowEnd={<ComedyRatingTrigger note={note} variant="detail" />}
        >
          <div className={styles.titleInfoRow}>
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
          </div>
        </LabelPicker>
      </header>

      {isEditing ? (
        <div className={styles.metaEdit}>
          <div className={styles.metaEditField}>
            <label className={styles.metaEditLabel} htmlFor="note-source-created">
              Source created
            </label>
            <div className={styles.metaEditControlRow}>
              <input
                id="note-source-created"
                className={styles.metaEditInput}
                value={draftCreatedAt}
                onChange={(e) => setDraftCreatedAt(e.target.value)}
                placeholder="YYYY-MM-DD or paste text"
                autoComplete="off"
              />
              <button
                type="button"
                className={styles.addToExistingNoteBtn}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => openTransferWithEditorSelection()}
                aria-label="Add selected text to another note"
              >
                Add to Existing Note
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <NoteInfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        sourceFileName={note.sourceFileName}
        createdAtSource={note.createdAtSource}
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
          <NoteRichTextEditor
            key={`${note.id}-${editSessionKey}`}
            initialHtml={draftHtml}
            onChange={setDraftHtml}
            onEditorReady={handleEditorReady}
            placeholder="Write your note…"
            aria-label="Note body"
          />
          {editStartedFromMarkdown ? (
            <p className={styles.convertHint}>
              This note was stored as Markdown. It has been opened in the rich editor; saving stores HTML as the
              source from here on.
            </p>
          ) : null}
          <p className={styles.markdownHint}>
            Edit with the toolbar for bold, lists, headings, links, and quotes. Content is saved as HTML.
          </p>
        </div>
      ) : (
        <NoteBodyContent
          className={styles.body}
          contentType={note.contentType}
          bodyHtml={note.bodyHtml}
          bodyMarkdown={note.bodyMarkdown}
        />
      )}

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
