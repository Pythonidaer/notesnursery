import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { EditorContent, useEditor } from '@tiptap/react';
import { Paragraph } from '@tiptap/extension-paragraph';
import { StarterKit } from '@tiptap/starter-kit';
import {
  ALargeSmall,
  AudioLines,
  Bold,
  Camera,
  Code,
  FileCode,
  FileUp,
  Heading1,
  Heading2,
  Heading3,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Minus,
  Outdent,
  Palette,
  Paperclip,
  ScanText,
  Strikethrough,
  TextQuote,
  Underline,
} from 'lucide-react';
import { useSupabaseBackend } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { isOcrImageToTextUser } from '../utils/ocrImageToTextGate.js';
import { ocrImageFileToText } from '../lib/ocrImageToText.js';
import { getSupabase } from '../lib/supabaseClient.js';
import { appendOcrPlainTextToTipTap } from '../utils/appendOcrPlainTextToTipTap.js';
import { NOTE_AUDIO_MAX_UPLOAD_BYTES } from '../constants/noteAudio.js';
import { noteAudioExtension } from '../tiptap/noteAudioExtension.js';
import { prepareNoteBodyHtml } from '../utils/parsePlainTextNoteToHtml.js';
import { sanitizeNoteHtml } from '../utils/sanitizeNoteHtml.js';
import AudioInsertBlockedModal from './AudioInsertBlockedModal.jsx';
import AudioUploadErrorModal from './AudioUploadErrorModal.jsx';
import InsertAudioModal from './InsertAudioModal.jsx';
import InsertLinkModal from './InsertLinkModal.jsx';
import NoteFormatBottomSheet from './NoteFormatBottomSheet.jsx';
import { escapeHtmlAttr } from '../utils/escapeHtmlAttr.js';
import { isSelectionInsideListItem } from '../utils/insertNoteAudioBlock.js';
import styles from './NoteRichTextEditor.module.css';

/** Block elements: if a <div> contains any of these, TipTap must not treat the div as a paragraph. */
const DIV_PARAGRAPH_BLOCK_CHILD = new Set([
  'P',
  'DIV',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'PRE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'TABLE',
  'HR',
  'FIGURE',
  'SECTION',
  'ARTICLE',
  'ASIDE',
  'HEADER',
  'FOOTER',
  'NAV',
  'MAIN',
  'FORM',
  'FIELDSET',
  'ADDRESS',
  'DL',
  'DT',
  'DD',
]);

const ParagraphWithAppleDiv = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      dataNnTranscriptFor: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-nn-transcript-for'),
        renderHTML: (attributes) => {
          if (!attributes.dataNnTranscriptFor) return {};
          return { 'data-nn-transcript-for': attributes.dataNnTranscriptFor };
        },
      },
    };
  },
  parseHTML() {
    return [
      { tag: 'p' },
      {
        tag: 'div',
        getAttrs: (element) => {
          const el = /** @type {HTMLElement} */ (element);
          for (const child of el.children) {
            if (DIV_PARAGRAPH_BLOCK_CHILD.has(child.tagName)) return false;
          }
          return {};
        },
      },
    ];
  },
});

/** Compact palette: default + common hues for annotation. */
const TEXT_COLOR_SWATCHES = [
  { label: 'Default', value: null },
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

/**
 * Re-render toolbar when focus, selection, or document changes so active marks stay accurate.
 */
function useToolbarRerender(editor) {
  const [, bump] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    if (!editor) return;
    const refresh = () => bump();
    editor.on('focus', refresh);
    editor.on('blur', refresh);
    editor.on('transaction', refresh);
    return () => {
      editor.off('focus', refresh);
      editor.off('blur', refresh);
      editor.off('transaction', refresh);
    };
  }, [editor]);
}

/** Space from layout viewport bottom to visual viewport bottom (keyboard / accessory). */
function useVisualViewportKeyboardInset() {
  const [bottom, setBottom] = useState(0);
  useLayoutEffect(() => {
    const vv = window.visualViewport;
    const update = () => {
      if (!vv) {
        setBottom(0);
        return;
      }
      setBottom(Math.max(0, window.innerHeight - (vv.offsetTop + vv.height)));
    };
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return bottom;
}

/**
 * @param {{
 *   editor: import('@tiptap/core').Editor | null,
 *   audioStorageScopeId: string,
 *   toolbarVariant?: 'default' | 'mobileNotes',
 *   onOpenFormatSheet?: () => void,
 *   onAddToExistingNote?: () => void,
 *   attachAudioOpenRequest?: number,
 *   onRequestAttachSheet?: () => void,
 * }} props
 */
function MenuBar({
  editor,
  audioStorageScopeId,
  toolbarVariant = 'default',
  onOpenFormatSheet,
  onAddToExistingNote,
  attachAudioOpenRequest = 0,
  onRequestAttachSheet,
}) {
  const [colorOpen, setColorOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState(/** @type {string | null} */ (null));
  const colorWrapRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const ocrWrapRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const attachWrapRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const ocrCameraInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const ocrFileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkInitialUrl, setLinkInitialUrl] = useState('');
  const [linkInitialDisplay, setLinkInitialDisplay] = useState('');
  const [linkCanRemove, setLinkCanRemove] = useState(false);
  const colorBtnRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const colorPopoverRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [colorPopoverStyle, setColorPopoverStyle] = useState(
    /** @type {import('react').CSSProperties | null} */ (null)
  );
  const [insertAudioOpen, setInsertAudioOpen] = useState(false);
  const [audioInsertBlockedOpen, setAudioInsertBlockedOpen] = useState(false);
  const [uploadErr, setUploadErr] = useState(
    /** @type {null | { fileName: string, fileSizeBytes: number, maxBytes: number, reason: string, isLikelySizeLimit: boolean }} */ (
      null
    )
  );
  const { user } = useAuth();
  const remote = useSupabaseBackend();
  const canUploadAudio = Boolean(remote && user?.id);
  const canOcr = Boolean(remote && user?.id && isOcrImageToTextUser(user));

  useToolbarRerender(editor);
  const vvInset = useVisualViewportKeyboardInset();
  const lastAttachAudioReqRef = useRef(0);

  useEffect(() => {
    if (attachAudioOpenRequest <= 0) {
      lastAttachAudioReqRef.current = 0;
      return;
    }
    if (!editor) return;
    if (attachAudioOpenRequest === lastAttachAudioReqRef.current) return;
    lastAttachAudioReqRef.current = attachAudioOpenRequest;
    if (!canUploadAudio) return;
    editor.chain().focus().run();
    queueMicrotask(() => {
      if (isSelectionInsideListItem(editor)) {
        setAudioInsertBlockedOpen(true);
        return;
      }
      setInsertAudioOpen(true);
    });
  }, [attachAudioOpenRequest, editor, canUploadAudio]);

  useLayoutEffect(() => {
    if (!colorOpen || toolbarVariant !== 'mobileNotes' || !colorBtnRef.current) {
      setColorPopoverStyle(null);
      return;
    }
    const update = () => {
      const el = colorBtnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const popoverMax = 12 * 16;
      setColorPopoverStyle({
        position: 'fixed',
        top: r.bottom + 6,
        left: Math.max(8, Math.min(r.left, window.innerWidth - 8 - popoverMax)),
        zIndex: 950,
      });
    };
    update();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('scroll', update, true);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [colorOpen, toolbarVariant]);

  useEffect(() => {
    if (!colorOpen) return;
    const onDown = (/** @type {PointerEvent} */ e) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (colorWrapRef.current?.contains(t)) return;
      if (colorPopoverRef.current?.contains(t)) return;
      setColorOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [colorOpen]);

  useEffect(() => {
    if (!ocrOpen) return;
    const onDown = (/** @type {MouseEvent} */ e) => {
      const el = ocrWrapRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setOcrOpen(false);
    };
    const onKey = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === 'Escape') setOcrOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [ocrOpen]);

  useEffect(() => {
    if (!attachOpen) return;
    const onDown = (/** @type {MouseEvent} */ e) => {
      const el = attachWrapRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setAttachOpen(false);
    };
    const onKey = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === 'Escape') setAttachOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [attachOpen]);

  const runOcrOnFile = async (/** @type {File | undefined} */ file) => {
    if (!file || !editor) return;
    if (!isOcrImageToTextUser(user)) return;
    const supabase = getSupabase();
    if (!supabase) {
      setOcrError('Sign in to import text from images');
      return;
    }
    setOcrError(null);
    setOcrLoading(true);
    setOcrOpen(false);
    setAttachOpen(false);
    try {
      const text = await ocrImageFileToText(supabase, file);
      appendOcrPlainTextToTipTap(editor, text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not read text from image';
      setOcrError(msg);
    } finally {
      setOcrLoading(false);
    }
  };

  if (!editor) return null;

  const isMobile = toolbarVariant === 'mobileNotes';
  const toolbarInnerClass = isMobile
    ? `${styles.toolbarInner} ${styles.toolbarInnerScroll} ${styles.toolbarInnerMobile}`
    : styles.toolbarInner;

  const listItemKind = () => (editor.isActive('taskItem') ? 'taskItem' : 'listItem');

  const focused = Boolean(editor.isFocused);
  const active = (/** @type {string} */ name, /** @type {Record<string, unknown>} */ attrs) =>
    focused && (attrs ? editor.isActive(name, attrs) : editor.isActive(name));

  const textStyleAttrs = editor.getAttributes('textStyle');
  const currentColor = typeof textStyleAttrs.color === 'string' ? textStyleAttrs.color : null;
  const colorControlActive = focused && currentColor != null && currentColor !== '';

  const openLinkModal = () => {
    editor.chain().focus();
    const inLink = editor.isActive('link');
    if (inLink) {
      editor.chain().extendMarkRange('link').run();
    }
    const href = editor.getAttributes('link').href;
    setLinkInitialUrl(typeof href === 'string' ? href : '');
    const { from, to } = editor.state.selection;
    setLinkInitialDisplay(editor.state.doc.textBetween(from, to, ''));
    setLinkCanRemove(inLink);
    setLinkModalOpen(true);
  };

  const applyLinkFromModal = (urlRaw, displayNameRaw) => {
    const trimmed = urlRaw.trim();
    if (trimmed === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const label = (displayNameRaw ?? '').trim();
    const { empty } = editor.state.selection;
    if (empty) {
      const text = label || trimmed;
      const h = escapeHtmlAttr(trimmed);
      const t = escapeHtmlAttr(text);
      editor.chain().focus().insertContent(`<a href="${h}">${t}</a>`).run();
    } else if (label) {
      const h = escapeHtmlAttr(trimmed);
      const t = escapeHtmlAttr(label);
      editor.chain().focus().insertContent(`<a href="${h}">${t}</a>`).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
    }
  };

  const removeLinkFromModal = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
  };

  const applyColor = (/** @type {string | null} */ value) => {
    setColorOpen(false);
    if (value == null) {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().setColor(value).run();
    }
  };

  const toggleCodeBlockSafe = () => {
    editor.chain().focus().toggleCodeBlock().run();
  };

  const openInsertAudio = () => {
    if (!canUploadAudio) return;
    editor.commands.focus();
    queueMicrotask(() => {
      if (isSelectionInsideListItem(editor)) {
        setAudioInsertBlockedOpen(true);
        return;
      }
      setInsertAudioOpen(true);
    });
  };

  const attachMenuEl =
    isMobile && onRequestAttachSheet ? (
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => {
          setColorOpen(false);
          setOcrOpen(false);
          setAttachOpen(false);
          onRequestAttachSheet();
        }}
        aria-label="Attachments"
        title="Attach"
      >
        <Paperclip className={styles.icon} strokeWidth={2} aria-hidden />
      </button>
    ) : isMobile && (canOcr || canUploadAudio || onAddToExistingNote) ? (
      <div className={styles.attachWrap} ref={attachWrapRef}>
        {canOcr ? (
          <>
            <input
              ref={ocrCameraInputRef}
              type="file"
              className={styles.hiddenFileInput}
              accept="image/*"
              capture="environment"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void runOcrOnFile(f);
              }}
            />
            <input
              ref={ocrFileInputRef}
              type="file"
              className={styles.hiddenFileInput}
              accept="image/*"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void runOcrOnFile(f);
              }}
            />
          </>
        ) : null}
        <button
          type="button"
          className={`${styles.toolBtn} ${attachOpen ? styles.toolBtnActive : ''}`}
          onClick={() => {
            setOcrOpen(false);
            setAttachOpen((o) => !o);
          }}
          aria-expanded={attachOpen}
          aria-haspopup="menu"
          aria-label="Attachments"
          title="Attach"
        >
          <Paperclip className={styles.icon} strokeWidth={2} aria-hidden />
        </button>
        {attachOpen ? (
          <div className={styles.attachPopover} role="menu" aria-label="Attach to note">
            {canOcr ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.attachMenuItem}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setAttachOpen(false);
                    if (!ocrLoading) ocrCameraInputRef.current?.click();
                  }}
                >
                  <Camera className={styles.attachMenuIcon} strokeWidth={2} aria-hidden />
                  <span>Take photo</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.attachMenuItem}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setAttachOpen(false);
                    if (!ocrLoading) ocrFileInputRef.current?.click();
                  }}
                >
                  <FileUp className={styles.attachMenuIcon} strokeWidth={2} aria-hidden />
                  <span>Choose photo</span>
                </button>
                <div className={styles.attachSep} aria-hidden />
              </>
            ) : null}
            {canUploadAudio ? (
              <button
                type="button"
                role="menuitem"
                className={styles.attachMenuItem}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setAttachOpen(false);
                  openInsertAudio();
                }}
              >
                <AudioLines className={styles.attachMenuIcon} strokeWidth={2} aria-hidden />
                <span>Insert audio</span>
              </button>
            ) : null}
            {onAddToExistingNote ? (
              <button
                type="button"
                role="menuitem"
                className={styles.attachMenuItem}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setAttachOpen(false);
                  onAddToExistingNote();
                }}
              >
                <FileCode className={styles.attachMenuIcon} strokeWidth={2} aria-hidden />
                <span>Add to existing note</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : null;

  const toolbarInner = (
      <div className={toolbarInnerClass}>
        {isMobile && onOpenFormatSheet ? (
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => {
              setAttachOpen(false);
              onOpenFormatSheet();
            }}
            aria-label="Text format"
            title="Format"
          >
            <ALargeSmall className={styles.icon} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        {isMobile ? (
          <button
            type="button"
            className={`${styles.toolBtn} ${active('taskList') ? styles.toolBtnActive : ''}`}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            aria-pressed={active('taskList')}
            aria-label="Task list"
            title="Task list"
          >
            <ListChecks className={styles.icon} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        {attachMenuEl}
        <button
          type="button"
          className={`${styles.toolBtn} ${active('bold') ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-pressed={active('bold')}
          aria-label="Bold"
          title="Bold (⌘B)"
        >
          <Bold className={styles.icon} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${active('italic') ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-pressed={active('italic')}
          aria-label="Italic"
          title="Italic (⌘I)"
        >
          <Italic className={styles.icon} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${active('underline') ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          aria-pressed={active('underline')}
          aria-label="Underline"
          title="Underline (⌘U)"
        >
          <Underline className={styles.icon} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${active('strike') ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          aria-pressed={active('strike')}
          aria-label="Strikethrough"
          title="Strikethrough (Shift+⌘+X)"
        >
          <Strikethrough className={styles.icon} strokeWidth={2} aria-hidden />
        </button>
        {!isMobile ? (
          <>
            <span className={styles.toolbarSep} aria-hidden />
            <button
              type="button"
              className={`${styles.toolBtn} ${active('heading', { level: 1 }) ? styles.toolBtnActive : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              aria-pressed={active('heading', { level: 1 })}
              aria-label="Heading 1"
              title="Heading 1"
            >
              <Heading1 className={styles.icon} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.toolBtn} ${active('heading', { level: 2 }) ? styles.toolBtnActive : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              aria-pressed={active('heading', { level: 2 })}
              aria-label="Heading 2"
              title="Heading 2"
            >
              <Heading2 className={styles.icon} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.toolBtn} ${active('heading', { level: 3 }) ? styles.toolBtnActive : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              aria-pressed={active('heading', { level: 3 })}
              aria-label="Heading 3"
              title="Heading 3"
            >
              <Heading3 className={styles.icon} strokeWidth={2} aria-hidden />
            </button>
          </>
        ) : null}
        <span className={styles.toolbarSep} aria-hidden />
        <button
          type="button"
          className={`${styles.toolBtn} ${active('bulletList') ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-pressed={active('bulletList')}
          aria-label="Bulleted list"
          title="Bulleted list"
        >
          <List className={styles.icon} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${active('orderedList') ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-pressed={active('orderedList')}
          aria-label="Numbered list"
          title="Numbered list"
        >
          <ListOrdered className={styles.icon} strokeWidth={2} aria-hidden />
        </button>
        {!isMobile ? (
          <button
            type="button"
            className={`${styles.toolBtn} ${active('taskList') ? styles.toolBtnActive : ''}`}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            aria-pressed={active('taskList')}
            aria-label="Task list"
            title="Task list"
          >
            <ListChecks className={styles.icon} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        <span className={styles.toolbarSep} aria-hidden />
        <button
          type="button"
          className={`${styles.toolBtn} ${active('blockquote') ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          aria-pressed={active('blockquote')}
          aria-label="Blockquote"
          title="Blockquote"
        >
          <TextQuote className={styles.icon} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${active('code') ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleCode().run()}
          aria-pressed={active('code')}
          aria-label="Inline code"
          title="Inline code"
        >
          <Code className={styles.icon} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${active('codeBlock') ? styles.toolBtnActive : ''}`}
          onClick={toggleCodeBlockSafe}
          aria-pressed={active('codeBlock')}
          aria-label="Code block"
          title="Code block"
        >
          <FileCode className={styles.icon} strokeWidth={2} aria-hidden />
        </button>
        <span className={styles.toolbarSep} aria-hidden />
        <div className={styles.colorWrap} ref={colorWrapRef}>
          <button
            ref={colorBtnRef}
            type="button"
            className={`${styles.toolBtn} ${colorControlActive ? styles.toolBtnActive : ''}`}
            onClick={() => setColorOpen((o) => !o)}
            aria-expanded={colorOpen}
            aria-haspopup="listbox"
            aria-label="Text color"
            title="Text color"
          >
            <Palette className={styles.icon} strokeWidth={2} aria-hidden />
          </button>
          {colorOpen ? (
            isMobile ? (
              createPortal(
                <div
                  ref={colorPopoverRef}
                  className={styles.colorPopover}
                  style={
                    colorPopoverStyle ?? {
                      position: 'fixed',
                      left: 8,
                      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)',
                      zIndex: 950,
                    }
                  }
                  role="listbox"
                  aria-label="Text color"
                >
                  {TEXT_COLOR_SWATCHES.map((sw) => (
                    <button
                      key={sw.label}
                      type="button"
                      role="option"
                      className={styles.colorSwatchBtn}
                      title={sw.label}
                      aria-label={sw.label}
                      aria-selected={
                        sw.value == null
                          ? !currentColor
                          : currentColor != null &&
                            currentColor.replace(/\s/g, '').toLowerCase() ===
                              sw.value.replace(/\s/g, '').toLowerCase()
                      }
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => applyColor(sw.value)}
                    >
                      {sw.value == null ? (
                        <span className={styles.colorSwatchDefault}>A</span>
                      ) : (
                        <span className={styles.colorSwatch} style={{ backgroundColor: sw.value }} />
                      )}
                    </button>
                  ))}
                </div>,
                document.body
              )
            ) : (
              <div ref={colorPopoverRef} className={styles.colorPopover} role="listbox" aria-label="Text color">
                {TEXT_COLOR_SWATCHES.map((sw) => (
                  <button
                    key={sw.label}
                    type="button"
                    role="option"
                    className={styles.colorSwatchBtn}
                    title={sw.label}
                    aria-label={sw.label}
                    aria-selected={
                      sw.value == null
                        ? !currentColor
                        : currentColor != null &&
                          currentColor.replace(/\s/g, '').toLowerCase() ===
                            sw.value.replace(/\s/g, '').toLowerCase()
                    }
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => applyColor(sw.value)}
                  >
                    {sw.value == null ? (
                      <span className={styles.colorSwatchDefault}>A</span>
                    ) : (
                      <span className={styles.colorSwatch} style={{ backgroundColor: sw.value }} />
                    )}
                  </button>
                ))}
              </div>
            )
          ) : null}
        </div>
        <button
          type="button"
          className={`${styles.toolBtn} ${active('link') ? styles.toolBtnActive : ''}`}
          onClick={openLinkModal}
          aria-pressed={active('link')}
          aria-label="Link"
          aria-haspopup="dialog"
          title="Link"
        >
          <Link2 className={styles.icon} strokeWidth={2} aria-hidden />
        </button>
        {isMobile ? (
          <>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => editor.chain().focus().liftListItem(listItemKind()).run()}
              aria-label="Outdent list"
              title="Outdent"
            >
              <Outdent className={styles.icon} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => editor.chain().focus().sinkListItem(listItemKind()).run()}
              aria-label="Indent list"
              title="Indent"
            >
              <IndentIncrease className={styles.icon} strokeWidth={2} aria-hidden />
            </button>
          </>
        ) : null}
        {!isMobile ? (
          <button
            type="button"
            className={`${styles.toolBtn} ${!canUploadAudio ? styles.toolBtnDisabled : ''}`}
            onClick={openInsertAudio}
            disabled={!canUploadAudio}
            aria-label="Insert audio"
            aria-haspopup="dialog"
            title={canUploadAudio ? 'Insert audio (upload or choose existing)' : 'Sign in (Supabase) to insert audio'}
          >
            <AudioLines className={styles.icon} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        {!isMobile && canOcr ? (
          <>
            <span className={styles.toolbarSep} aria-hidden />
            <div className={styles.ocrWrap} ref={ocrWrapRef}>
              <input
                ref={ocrCameraInputRef}
                type="file"
                className={styles.hiddenFileInput}
                accept="image/*"
                capture="environment"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void runOcrOnFile(f);
                }}
              />
              <input
                ref={ocrFileInputRef}
                type="file"
                className={styles.hiddenFileInput}
                accept="image/*"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void runOcrOnFile(f);
                }}
              />
              <button
                type="button"
                className={`${styles.toolBtn} ${ocrLoading ? styles.toolBtnDisabled : ''} ${ocrOpen ? styles.toolBtnActive : ''}`}
                disabled={ocrLoading}
                onClick={() => {
                  if (ocrLoading) return;
                  setOcrError(null);
                  setOcrOpen((o) => !o);
                }}
                aria-label="Add text from image"
                title="Add text from image (scan or upload)"
                aria-expanded={ocrOpen}
                aria-haspopup="menu"
                aria-controls="note-ocr-image-menu"
              >
                {ocrLoading ? (
                  <Loader2 className={`${styles.icon} ${styles.iconSpin}`} strokeWidth={2} aria-hidden />
                ) : (
                  <ScanText className={styles.icon} strokeWidth={2} aria-hidden />
                )}
              </button>
              {ocrOpen && !ocrLoading ? (
                <div
                  id="note-ocr-image-menu"
                  className={styles.ocrPopover}
                  role="menu"
                  aria-label="Image to text"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.ocrMenuItem}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOcrOpen(false);
                      ocrCameraInputRef.current?.click();
                    }}
                  >
                    <Camera className={styles.ocrMenuIcon} strokeWidth={2} aria-hidden />
                    <span>Take image</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.ocrMenuItem}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOcrOpen(false);
                      ocrFileInputRef.current?.click();
                    }}
                  >
                    <FileUp className={styles.ocrMenuIcon} strokeWidth={2} aria-hidden />
                    <span>Upload image</span>
                  </button>
                </div>
              ) : null}
              {ocrError ? (
                <p className={styles.ocrError} role="status" aria-live="polite">
                  {ocrError}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          aria-label="Horizontal rule"
          title="Horizontal rule"
        >
          <Minus className={styles.icon} strokeWidth={2} aria-hidden />
        </button>
      </div>
  );

  return (
    <>
      {isMobile
        ? createPortal(
            <div className={styles.toolbarMobileFixed} style={{ bottom: vvInset }}>
              <div className={styles.toolbarMobilePill} role="toolbar" aria-label="Formatting">
                {toolbarInner}
              </div>
            </div>,
            document.body
          )
        : (
            <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
              {toolbarInner}
            </div>
          )}
      {canUploadAudio && user?.id ? (
        <InsertAudioModal
          open={insertAudioOpen}
          onClose={() => setInsertAudioOpen(false)}
          userId={user.id}
          audioStorageScopeId={audioStorageScopeId}
          editor={editor}
          onBlocked={() => setAudioInsertBlockedOpen(true)}
          onUploadFailure={(detail) => {
            setUploadErr(detail);
            setInsertAudioOpen(false);
          }}
        />
      ) : null}
      <AudioInsertBlockedModal
        open={audioInsertBlockedOpen}
        onClose={() => setAudioInsertBlockedOpen(false)}
      />
      <AudioUploadErrorModal
        open={uploadErr != null}
        onClose={() => setUploadErr(null)}
        fileName={uploadErr?.fileName ?? ''}
        fileSizeBytes={uploadErr?.fileSizeBytes ?? 0}
        maxUploadBytes={uploadErr?.maxBytes ?? NOTE_AUDIO_MAX_UPLOAD_BYTES}
        reason={uploadErr?.reason ?? ''}
        isLikelySizeLimit={uploadErr?.isLikelySizeLimit ?? false}
      />
      <InsertLinkModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        initialUrl={linkInitialUrl}
        initialDisplayName={linkInitialDisplay}
        canRemoveLink={linkCanRemove}
        onApply={(url, displayName) => applyLinkFromModal(url, displayName)}
        onRemoveLink={removeLinkFromModal}
      />
    </>
  );
}

/**
 * @param {{
 *   initialHtml: string,
 *   onChange: (html: string) => void,
 *   onEditorReady?: (editor: import('@tiptap/core').Editor | null) => void,
 *   placeholder?: string,
 *   className?: string,
 *   surfaceClassName?: string,
 *   'aria-label'?: string,
 *   'aria-labelledby'?: string,
 *   audioStorageScopeId?: string,
 *   toolbarVariant?: 'default' | 'mobileNotes',
 *   onAddToExistingNote?: () => void,
 *   attachAudioOpenRequest?: number,
 *   onRequestAttachSheet?: () => void,
 * }} props
 */
export default function NoteRichTextEditor({
  initialHtml,
  onChange,
  onEditorReady,
  placeholder = 'Write…',
  className,
  surfaceClassName,
  'aria-label': ariaLabel = 'Note body',
  'aria-labelledby': ariaLabelledBy,
  audioStorageScopeId: audioStorageScopeIdProp,
  toolbarVariant = 'default',
  onAddToExistingNote,
  attachAudioOpenRequest = 0,
  onRequestAttachSheet,
}) {
  const audioScopeFallbackRef = useRef(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `audio-${Date.now()}`
  );
  const audioStorageScopeId = audioStorageScopeIdProp ?? audioScopeFallbackRef.current;
  const [formatSheetOpen, setFormatSheetOpen] = useState(false);

  /** One snapshot per mount so parent `draftHtml` updates do not reset the editor. */
  const [initialSnapshot] = useState(() => {
    const raw = initialHtml && initialHtml.trim() ? initialHtml : '<p></p>';
    const n = prepareNoteBodyHtml(raw);
    return n && n.trim() ? n : '<p></p>';
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: false,
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'nn-code-block',
          },
        },
      }),
      ParagraphWithAppleDiv,
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      noteAudioExtension,
    ],
    content: initialSnapshot,
    editorProps: {
      attributes: {
        class: styles.prose,
        ...(ariaLabelledBy
          ? { 'aria-labelledby': ariaLabelledBy }
          : { 'aria-label': ariaLabel }),
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(sanitizeNoteHtml(ed.getHTML()));
    },
  });

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      <MenuBar
        editor={editor}
        audioStorageScopeId={audioStorageScopeId}
        toolbarVariant={toolbarVariant}
        onOpenFormatSheet={toolbarVariant === 'mobileNotes' ? () => setFormatSheetOpen(true) : undefined}
        onAddToExistingNote={onAddToExistingNote}
        attachAudioOpenRequest={attachAudioOpenRequest}
        onRequestAttachSheet={onRequestAttachSheet}
      />
      {toolbarVariant === 'mobileNotes' ? (
        <NoteFormatBottomSheet
          editor={editor}
          open={formatSheetOpen}
          onClose={() => setFormatSheetOpen(false)}
        />
      ) : null}
      <div
        className={`${styles.surface} ${surfaceClassName ?? ''}${
          toolbarVariant === 'mobileNotes' ? ` ${styles.surfaceMobileNotes}` : ''
        }`.trim()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
