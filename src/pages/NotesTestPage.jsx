import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AudioLines,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  ListChecks,
  Moon,
  MoreHorizontal,
  Paperclip,
  ScanLine,
  SquarePen,
  Sun,
  Tag,
  Trash2,
} from 'lucide-react';
import AppHeaderNav from '../components/AppHeaderNav.jsx';
import ComedyRatingTrigger from '../components/ComedyRatingTrigger.jsx';
import DeleteNoteModal from '../components/DeleteNoteModal.jsx';
import FloatingNewNoteComposer from '../components/FloatingNewNoteComposer.jsx';
import NoteBodyContent from '../components/NoteBodyContent.jsx';
import NoteInfoCircleIcon from '../components/NoteInfoCircleIcon.jsx';
import NoteInfoModal from '../components/NoteInfoModal.jsx';
import NoteRichTextEditor from '../components/NoteRichTextEditor.jsx';
import NoteTransferPanel from '../components/NoteTransferPanel.jsx';
import PosLegendPopover from '../components/PosLegendPopover.jsx';
import Toast from '../components/Toast.jsx';
import { NoteEditFloatingAudioProvider } from '../components/NoteEditFloatingAudioContext.jsx';
import NoteEditFloatingAudioDock from '../components/NoteEditFloatingAudioDock.jsx';
import PageContentWrap from '../components/PageContentWrap.jsx';
import { requiresAuthForPersistence, useSupabaseBackend } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotes } from '../context/NotesContext.jsx';
import { collectAllLabels, normalizeLabel } from '../utils/noteLabels.js';
import { normalizeNoteSourceDateInput } from '../utils/parseAppleNoteDate.js';
import {
  CONTENT_TYPE_HTML,
  CONTENT_TYPE_MARKDOWN,
  normalizeContentType,
} from '../utils/noteContentModel.js';
import { getNoteHtmlForRichEditor } from '../utils/noteEditorHtml.js';
import { prepareNoteBodyHtml } from '../utils/parsePlainTextNoteToHtml.js';
import { sanitizeNoteHtml } from '../utils/sanitizeNoteHtml.js';
import labelPickerStyles from '../components/LabelPicker.module.css';
import styles from './NotesTestPage.module.css';

const NOTES_TEST_DARK_BG_KEY = 'notesNursery_notesTestUseDarkBg';

/** @param {{ className?: string }} props */
function BackChevronButton({ className, ...rest }) {
  return (
    <button type="button" className={className ?? styles.iconCircleBtn} {...rest}>
      <ChevronLeft className={styles.backIcon} strokeWidth={2.25} aria-hidden />
    </button>
  );
}

function NotesTestHub() {
  return (
    <PageContentWrap>
      <div className={styles.hub}>
        <h1 className={styles.hubTitle}>Notes test</h1>
        <p className={styles.hubLead}>
          Open a note from the Library or Cards, then change the URL to <code>/notes-test/&lt;id&gt;</code>, or use a
          bookmarked link. This area is for the new mobile-first note layout.
        </p>
        <p className={styles.hubLead}>
          <Link className={styles.hubLink} to="/library">
            Go to Library
          </Link>
          {' · '}
          <Link className={styles.hubLink} to="/cards">
            Cards
          </Link>
        </p>
      </div>
    </PageContentWrap>
  );
}

function NotesTestDetail() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, authInitializing } = useAuth();
  const remote = useSupabaseBackend();
  const { notes, updateNote, deleteNote, noteListReady } = useNotes();
  const note = notes.find((n) => n.id === noteId);
  const lastModifiedLine =
    note?.modifiedAtSource?.trim() || note?.createdAtSource?.trim() || '—';

  const isLoadingNote = remote && (authInitializing || (Boolean(user) && !noteListReady));

  const [isEditing, setIsEditing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftHtml, setDraftHtml] = useState('');
  const [editSessionKey, setEditSessionKey] = useState(0);
  const [editStartedFromMarkdown, setEditStartedFromMarkdown] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const originalBodyRef = useRef('');
  const originalMarkdownRef = useRef('');
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
  const [posAnalysisOn, setPosAnalysisOn] = useState(false);
  const [posLegendOpen, setPosLegendOpen] = useState(false);
  const posUsedAbbreviationsRef = useRef(/** @type {string[]} */ ([]));
  const posToolbarClusterRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const tiptapRef = useRef(/** @type {import('@tiptap/core').Editor | null} */ (null));
  const pendingEditorActionRef = useRef(/** @type {null | 'task'} */ (null));
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [moreMenuLabelsOpen, setMoreMenuLabelsOpen] = useState(false);
  const [labelsSheetQuery, setLabelsSheetQuery] = useState('');
  const [bottomAttachOpen, setBottomAttachOpen] = useState(false);
  const [attachAudioOpenRequest, setAttachAudioOpenRequest] = useState(0);
  const [useDarkBg, setUseDarkBg] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(NOTES_TEST_DARK_BG_KEY) === '1';
    } catch {
      return false;
    }
  });
  const scrollRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const metaRevealRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const readSurfaceRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const tapRef = useRef(/** @type {{ x: number, y: number } | null} */ (null));

  const labelSuggestions = useMemo(() => collectAllLabels(notes), [notes]);

  const allLabelsCatalog = useMemo(() => {
    const set = new Set([...labelSuggestions, ...(note?.labels ?? [])]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [labelSuggestions, note?.labels]);

  const handleEditorReady = useCallback((ed) => {
    tiptapRef.current = ed;
    if (!ed) return;
    const p = pendingEditorActionRef.current;
    if (!p) return;
    queueMicrotask(() => {
      if (p === 'task') ed.chain().focus().toggleTaskList().run();
      pendingEditorActionRef.current = null;
    });
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
    setPosAnalysisOn(false);
    setPosLegendOpen(false);
    setMoreMenuOpen(false);
    setMoreMenuLabelsOpen(false);
    setLabelsSheetQuery('');
    setBottomAttachOpen(false);
    setAttachAudioOpenRequest(0);
    posUsedAbbreviationsRef.current = [];
    originalBodyRef.current = '';
    originalMarkdownRef.current = '';
    originalContentTypeRef.current = CONTENT_TYPE_HTML;
    originalTitleRef.current = '';
    originalCreatedRef.current = '';
    originalModifiedRef.current = '';
    pendingEditorActionRef.current = null;
  }, [noteId]);

  const dismissToast = useCallback(() => setToastMessage(null), []);

  const toggleNotesTestDarkBg = useCallback(() => {
    setUseDarkBg((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(NOTES_TEST_DARK_BG_KEY, next ? '1' : '0');
      } catch {
        /* ignore quota / private mode */
      }
      return next;
    });
  }, []);

  const handlePosUsedAbbreviationsChange = useCallback((abbrs) => {
    posUsedAbbreviationsRef.current = Array.isArray(abbrs) ? abbrs : [];
  }, []);

  useEffect(() => {
    if (!posAnalysisOn) {
      setPosLegendOpen(false);
      posUsedAbbreviationsRef.current = [];
    }
  }, [posAnalysisOn]);

  useEffect(() => {
    if (!posLegendOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setPosLegendOpen(false);
    };
    const onDown = (e) => {
      const el = posToolbarClusterRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setPosLegendOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown, true);
    };
  }, [posLegendOpen]);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (moreMenuLabelsOpen) {
        setMoreMenuLabelsOpen(false);
        return;
      }
      setMoreMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreMenuOpen, moreMenuLabelsOpen]);

  useEffect(() => {
    if (!moreMenuOpen) setMoreMenuLabelsOpen(false);
  }, [moreMenuOpen]);

  useEffect(() => {
    if (!moreMenuLabelsOpen) setLabelsSheetQuery('');
  }, [moreMenuLabelsOpen]);

  useEffect(() => {
    if (!bottomAttachOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setBottomAttachOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bottomAttachOpen]);

  /**
   * Single initial scroll: skip the metadata band so the title/body sit below the sticky header.
   * No ResizeObserver/RAF/fonts — if meta height changes after load (e.g. async chips), user can nudge scroll.
   */
  useLayoutEffect(() => {
    const sc = scrollRef.current;
    const meta = metaRevealRef.current;
    if (!sc || !meta || !note) return;
    const errEl = sc.querySelector('[data-notes-test-scroll-error]');
    const errH = errEl instanceof HTMLElement ? errEl.offsetHeight : 0;
    sc.scrollTop = errH + meta.offsetHeight;
  }, [noteId, isEditing, editSessionKey, note?.id, actionError]);

  if (remote && !authInitializing && !user) {
    return <Navigate to="/login" replace />;
  }

  if (isLoadingNote) {
    return (
      <div
        className={`${styles.shell}${useDarkBg ? ` ${styles.shellDark}` : ''}`}
        data-notes-canvas={useDarkBg ? 'dark' : 'light'}
        aria-busy="true"
      >
        <div className={styles.topBar}>
          <BackChevronButton aria-label="Go back" disabled />
        </div>
        <div className={styles.skelTop} />
        <div className={styles.skelTitle} />
        <div className={styles.skelBody} />
        <p className={styles.loadingHint}>Loading note…</p>
      </div>
    );
  }

  if (!note) {
    return (
      <div
        className={`${styles.shell}${useDarkBg ? ` ${styles.shellDark}` : ''}`}
        data-notes-canvas={useDarkBg ? 'dark' : 'light'}
      >
        <div className={styles.topBar}>
          <BackChevronButton
            aria-label="Go back"
            onClick={() => {
              navigate('/library');
            }}
          />
        </div>
        <div className={styles.notFound}>
          <h1>Note not found</h1>
          <p>
            <Link to="/library">Library</Link>
          </p>
        </div>
      </div>
    );
  }

  const handleBack = async () => {
    if (isEditing && (draftTitle !== originalTitleRef.current || draftHtml !== originalBodyRef.current)) {
      if (!window.confirm('Discard your edits?')) return;
      await exitEditMode();
    }
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
  };

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
    setDraftHtml(getNoteHtmlForRichEditor(note));
    setEditSessionKey((k) => k + 1);
    setDraftTitle(note.title);
    setIsEditing(true);
  };

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
      setEditStartedFromMarkdown(false);
      setIsEditing(false);
    } catch (e) {
      console.error('[notes-test] discard edit failed', e);
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
    const createdNorm = normalizeNoteSourceDateInput(originalCreatedRef.current);
    const modifiedNorm = normalizeNoteSourceDateInput(originalModifiedRef.current);
    const titleSaved = draftTitle.trim() || 'Untitled';
    const bodySaved = sanitizeNoteHtml(prepareNoteBodyHtml(draftHtml));
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
      originalMarkdownRef.current = '';
      originalBodyRef.current = bodySaved;
      originalContentTypeRef.current = CONTENT_TYPE_HTML;
      setEditStartedFromMarkdown(false);
      setIsEditing(false);
      setToastMessage('Note saved');
    } catch (e) {
      console.error('[notes-test] save failed', e);
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
      console.error('[notes-test] delete failed', e);
      setActionError(e instanceof Error ? e.message : 'Could not delete note');
      setDeleteModalOpen(false);
    } finally {
      setDeleteInProgress(false);
    }
  };

  const removeLabelAt = (idx) => {
    const next = (note.labels ?? []).filter((_, i) => i !== idx);
    void updateNote(note.id, { labels: next });
  };

  const onReadPointerDown = (e) => {
    if (e.target instanceof Element && e.target.closest('a,button,input,textarea,select,audio,video')) {
      tapRef.current = null;
      return;
    }
    tapRef.current = { x: e.clientX, y: e.clientY };
  };

  const onReadPointerUp = (e) => {
    const start = tapRef.current;
    tapRef.current = null;
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    if (dx > 12 || dy > 12) return;
    if (e.target instanceof Element && e.target.closest('a,button,input,textarea,select,audio,video')) return;
    startEdit();
  };

  const toggleTaskFromBottom = () => {
    if (!isEditing) {
      pendingEditorActionRef.current = 'task';
      startEdit();
      return;
    }
    tiptapRef.current?.chain().focus().toggleTaskList().run();
  };

  const confirmAttachAudioFromSheet = () => {
    setBottomAttachOpen(false);
    if (requiresAuthForPersistence() && !user) {
      navigate('/login');
      return;
    }
    if (!isEditing) startEdit();
    setAttachAudioOpenRequest((n) => n + 1);
  };

  const currentLabels = note.labels ?? [];
  const labelsSheetTrimmed = normalizeLabel(labelsSheetQuery);
  const labelsFiltered = allLabelsCatalog.filter(
    (l) =>
      !labelsSheetTrimmed || l.toLowerCase().includes(labelsSheetTrimmed.toLowerCase())
  );
  const canCreateLabel =
    Boolean(labelsSheetTrimmed) &&
    !allLabelsCatalog.some((l) => l.toLowerCase() === labelsSheetTrimmed.toLowerCase()) &&
    !currentLabels.some((l) => l.toLowerCase() === labelsSheetTrimmed.toLowerCase());

  const toggleLabelOnNote = (label) => {
    const t = normalizeLabel(label);
    if (!t) return;
    const has = currentLabels.some((l) => l.toLowerCase() === t.toLowerCase());
    if (has) {
      void updateNote(note.id, {
        labels: currentLabels.filter((l) => l.toLowerCase() !== t.toLowerCase()),
      });
    } else {
      void updateNote(note.id, { labels: [...currentLabels, t] });
    }
  };

  const addNewLabelFromSheet = () => {
    const t = normalizeLabel(labelsSheetTrimmed);
    if (!t) return;
    if (currentLabels.some((l) => l.toLowerCase() === t.toLowerCase())) return;
    void updateNote(note.id, { labels: [...currentLabels, t] });
    setLabelsSheetQuery('');
  };

  const moreMenu =
    moreMenuOpen &&
    createPortal(
      <>
        <div
          className={styles.sheetBackdrop}
          role="presentation"
          onClick={() => {
            setMoreMenuOpen(false);
            setMoreMenuLabelsOpen(false);
          }}
        />
        <div
          className={styles.sheetPanel}
          data-theme={useDarkBg ? 'dark' : 'light'}
          role="dialog"
          aria-label="Note menu"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.sheetQuickRow}>
            <button type="button" className={styles.sheetQuickBtn} disabled>
              <ScanLine className={styles.sheetQuickIcon} strokeWidth={2} aria-hidden />
              Scan
            </button>
            <button
              type="button"
              className={`${styles.sheetQuickBtn} ${styles.sheetQuickBtnInteractive}`}
              onClick={() => {
                setMoreMenuOpen(false);
                setMoreMenuLabelsOpen(false);
                setInfoOpen(true);
              }}
            >
              <span className={styles.sheetQuickIconWrap} aria-hidden>
                <NoteInfoCircleIcon />
              </span>
              Info
            </button>
            <div className={styles.sheetQuickReserved} aria-hidden />
          </div>
          <button
            type="button"
            className={`${styles.sheetMenuBtn} ${styles.sheetMenuBtnDisclosure}`}
            onClick={() => setMoreMenuLabelsOpen(true)}
          >
            <Tag className={styles.sheetMenuLeadingIcon} strokeWidth={2} aria-hidden />
            <span className={styles.sheetMenuBtnLabelGrow}>Labels</span>
            <ChevronRight className={styles.sheetMenuChevronTrail} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.sheetMenuBtn}
            onClick={() => toggleNotesTestDarkBg()}
            aria-pressed={useDarkBg}
          >
            {useDarkBg ? (
              <Sun className={styles.sheetMenuLeadingIcon} strokeWidth={2} aria-hidden />
            ) : (
              <Moon className={styles.sheetMenuLeadingIcon} strokeWidth={2} aria-hidden />
            )}
            {useDarkBg ? 'Use Light Background' : 'Use Dark Background'}
          </button>
          <button
            type="button"
            className={`${styles.sheetMenuBtn} ${styles.sheetMenuBtnDanger}`}
            onClick={() => {
              setMoreMenuOpen(false);
              setMoreMenuLabelsOpen(false);
              setDeleteModalOpen(true);
            }}
          >
            <Trash2 className={styles.sheetDeleteIcon} strokeWidth={2} aria-hidden />
            Delete
          </button>
        </div>
        {moreMenuLabelsOpen ? (
          <div
            className={styles.labelsDrillPanel}
            data-theme={useDarkBg ? 'dark' : 'light'}
            role="dialog"
            aria-label="Labels"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.labelsDrillHeader}>
              <Tag className={styles.labelsDrillHeaderIcon} strokeWidth={2} aria-hidden />
              <span className={styles.labelsDrillHeaderTitle}>Labels</span>
              <button
                type="button"
                className={styles.labelsDrillHeaderCollapse}
                aria-label="Back to note menu"
                onClick={() => setMoreMenuLabelsOpen(false)}
              >
                <ChevronDown strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className={styles.labelsDrillBody}>
              <label className={styles.labelsDrillSearchLabel} htmlFor="notes-test-labels-search">
                Search or add a label
              </label>
              <input
                id="notes-test-labels-search"
                type="search"
                className={styles.labelsDrillSearch}
                value={labelsSheetQuery}
                onChange={(e) => setLabelsSheetQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  if (!canCreateLabel) return;
                  e.preventDefault();
                  addNewLabelFromSheet();
                }}
                placeholder="Search labels…"
                autoComplete="off"
                enterKeyHint="search"
              />
              {canCreateLabel ? (
                <button type="button" className={styles.labelsDrillAddNew} onClick={addNewLabelFromSheet}>
                  <span className={styles.labelsDrillAddNewPlus} aria-hidden>
                    +
                  </span>
                  <span>
                    Add &quot;{labelsSheetTrimmed}&quot; to this note
                  </span>
                </button>
              ) : null}
              <ul className={styles.labelsDrillList} role="listbox" aria-label="Labels">
                {labelsFiltered.length === 0 && !canCreateLabel ? (
                  <li className={styles.labelsDrillEmpty}>No matching labels</li>
                ) : null}
                {labelsFiltered.map((label) => {
                  const on = currentLabels.some((l) => l.toLowerCase() === label.toLowerCase());
                  return (
                    <li key={label} className={styles.labelsDrillListItem} role="none">
                      <button
                        type="button"
                        className={styles.labelsDrillRow}
                        role="option"
                        aria-selected={on}
                        onClick={() => toggleLabelOnNote(label)}
                      >
                        <FileText className={styles.labelsDrillRowIcon} strokeWidth={2} aria-hidden />
                        <span className={styles.labelsDrillRowLabel}>{label}</span>
                        {on ? (
                          <Check className={styles.labelsDrillRowCheck} strokeWidth={2.5} aria-hidden />
                        ) : (
                          <span className={styles.labelsDrillRowCheckSpacer} aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ) : null}
      </>,
      document.body
    );

  return (
    <div
      className={`${styles.shell}${useDarkBg ? ` ${styles.shellDark}` : ''}`}
      data-notes-canvas={useDarkBg ? 'dark' : 'light'}
    >
      <div className={styles.scrollMain} ref={scrollRef}>
        <header className={styles.topBar}>
          <BackChevronButton aria-label="Go back" onClick={handleBack} />
          <div className={styles.topBarNavSlot}>
            {!isEditing ? <AppHeaderNav /> : null}
            {isEditing ? (
              <button
                type="button"
                className={`${styles.iconCircleBtn} ${styles.iconCircleBtnAccent}`}
                aria-label="Save note"
                title="Save"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                <Check className={styles.backIcon} strokeWidth={2.5} aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              className={styles.iconCircleBtn}
              aria-label="More actions"
              aria-expanded={moreMenuOpen}
              onClick={() => setMoreMenuOpen((o) => !o)}
            >
              <MoreHorizontal className={styles.backIcon} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </header>

        {actionError ? (
          <p className={styles.actionErrorBanner} data-notes-test-scroll-error>
            {actionError}
          </p>
        ) : null}

        <div className={styles.scrollInner}>
          <div ref={metaRevealRef} className={styles.metaReveal}>
            <p className={styles.dateOnly}>{lastModifiedLine}</p>
            <div className={styles.metaCenterRow}>
              <div className={`${labelPickerStyles.chips} ${styles.chipsCentered}`} role="list">
                {currentLabels.map((l, i) => (
                  <span key={`${l}-${i}`} className={labelPickerStyles.chip} role="listitem">
                    <span className={labelPickerStyles.chipText}>{l}</span>
                    <button
                      type="button"
                      className={labelPickerStyles.chipRemove}
                      onClick={() => removeLabelAt(i)}
                      aria-label={`Remove label ${l}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <ComedyRatingTrigger note={note} variant="detail" detailAlign="center" />
            </div>
          </div>

          {isEditing ? (
          <NoteEditFloatingAudioProvider>
            <NoteEditFloatingAudioDock />
            <div className={styles.editBlock}>
              <input
                className={styles.titleField}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                aria-label="Note title"
                placeholder="Title"
              />
              <NoteRichTextEditor
                key={`${note.id}-${editSessionKey}`}
                className={styles.editorRoot}
                surfaceClassName={styles.editorSurface}
                initialHtml={draftHtml}
                onChange={setDraftHtml}
                onEditorReady={handleEditorReady}
                placeholder="Write your note…"
                aria-label="Note body"
                audioStorageScopeId={note.id}
                toolbarVariant="mobileNotes"
                attachAudioOpenRequest={attachAudioOpenRequest}
                onRequestAttachSheet={() => setBottomAttachOpen(true)}
                onAddToExistingNote={() => openTransferWithEditorSelection()}
              />
              {editStartedFromMarkdown ? (
                <p className={styles.actionError}>
                  This note was stored as Markdown. Saving stores HTML as the source from here on.
                </p>
              ) : null}
            </div>
          </NoteEditFloatingAudioProvider>
        ) : (
          <div
            ref={readSurfaceRef}
            className={styles.readSurface}
            role="presentation"
            onPointerDown={onReadPointerDown}
            onPointerUp={onReadPointerUp}
          >
            <h1 className={styles.readTitle}>{note.title}</h1>
            <NoteBodyContent
              key={note.id}
              contentType={note.contentType}
              bodyHtml={note.bodyHtml}
              bodyMarkdown={note.bodyMarkdown}
              posAnalysisEnabled={posAnalysisOn}
              posLegendOpen={posLegendOpen}
              onPosUsedAbbreviationsChange={handlePosUsedAbbreviationsChange}
            />
          </div>
        )}
        </div>
      </div>

      <footer className={styles.bottomBar}>
        <div className={styles.bottomCluster}>
          <div className={styles.posCluster} ref={posToolbarClusterRef}>
            <div className={styles.posLegendAnchor}>
              <button
                type="button"
                className={styles.infoBtn}
                disabled={!posAnalysisOn}
                aria-expanded={posAnalysisOn ? posLegendOpen : false}
                onClick={() => {
                  if (!posAnalysisOn) return;
                  setPosLegendOpen((o) => !o);
                }}
                aria-label="Word tag abbreviations"
              >
                <NoteInfoCircleIcon />
              </button>
              {posAnalysisOn && posLegendOpen ? (
                <div
                  className={styles.posLegendDropdown}
                  role="presentation"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setPosLegendOpen(false);
                  }}
                >
                  <PosLegendPopover
                    abbreviations={[...posUsedAbbreviationsRef.current]}
                    onClose={() => setPosLegendOpen(false)}
                  />
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.grammarBtn}
              aria-pressed={posAnalysisOn}
              onClick={() => setPosAnalysisOn((on) => !on)}
            >
              Grammar
            </button>
          </div>
          <button
            type="button"
            className={styles.bottomTool}
            aria-label="Checklist"
            title="Checklist"
            onClick={toggleTaskFromBottom}
          >
            <ListChecks className={styles.bottomIcon} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.bottomTool}
            aria-label="Attachments"
            title="Attach"
            aria-expanded={bottomAttachOpen}
            onClick={() => setBottomAttachOpen(true)}
          >
            <Paperclip className={styles.bottomIcon} strokeWidth={2} aria-hidden />
          </button>
        </div>
        {!isEditing ? (
          <button
            type="button"
            className={`${styles.iconCircleBtn} ${styles.iconCircleBtnAccent}`}
            aria-label="New note"
            title="New note"
            onClick={() => setComposerOpen(true)}
          >
            <SquarePen className={styles.backIcon} strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <span style={{ width: '2.5rem' }} aria-hidden />
        )}
      </footer>

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

      <NoteTransferPanel
        visible={transferOpen}
        onRequestClose={() => setTransferOpen(false)}
        currentNoteId={note.id}
        snippetPlain={transferSnippet}
        onSaved={() => setToastMessage('Added to note')}
      />

      <FloatingNewNoteComposer visible={composerOpen} onRequestClose={() => setComposerOpen(false)} />

      <Toast message={toastMessage} onDismiss={dismissToast} />
      {moreMenu}
      {bottomAttachOpen
        ? createPortal(
            <>
              <div
                className={styles.sheetBackdrop}
                role="presentation"
                onClick={() => setBottomAttachOpen(false)}
              />
              <div
                className={styles.attachSheetPanel}
                data-theme={useDarkBg ? 'dark' : 'light'}
                role="dialog"
                aria-label="Attach to note"
                onClick={(e) => e.stopPropagation()}
              >
                <button type="button" className={styles.attachSheetBtn} onClick={confirmAttachAudioFromSheet}>
                  <AudioLines className={styles.attachSheetIcon} strokeWidth={2} aria-hidden />
                  Attach audio
                </button>
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
}

export default function NotesTestPage() {
  const { noteId } = useParams();
  if (!noteId) {
    return <NotesTestHub />;
  }
  return <NotesTestDetail />;
}
