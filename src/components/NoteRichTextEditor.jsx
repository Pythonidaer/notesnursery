import { useEffect, useReducer, useRef, useState } from 'react';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { EditorContent, useEditor } from '@tiptap/react';
import { Paragraph } from '@tiptap/extension-paragraph';
import { StarterKit } from '@tiptap/starter-kit';
import {
  AudioLines,
  Bold,
  Code,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Palette,
  Strikethrough,
  TextQuote,
  Underline,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSupabaseBackend } from '../config/appConfig.js';
import { NOTE_AUDIO_MAX_UPLOAD_BYTES } from '../constants/noteAudio.js';
import { noteAudioExtension } from '../tiptap/noteAudioExtension.js';
import { prepareNoteBodyHtml } from '../utils/parsePlainTextNoteToHtml.js';
import { sanitizeNoteHtml } from '../utils/sanitizeNoteHtml.js';
import AudioInsertBlockedModal from './AudioInsertBlockedModal.jsx';
import AudioUploadErrorModal from './AudioUploadErrorModal.jsx';
import InsertAudioModal from './InsertAudioModal.jsx';
import InsertLinkModal from './InsertLinkModal.jsx';
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

/**
 * @param {{
 *   editor: import('@tiptap/core').Editor | null,
 *   audioStorageScopeId: string,
 * }} props
 */
function MenuBar({ editor, audioStorageScopeId }) {
  const [colorOpen, setColorOpen] = useState(false);
  const colorWrapRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkInitialUrl, setLinkInitialUrl] = useState('');
  const [linkCanRemove, setLinkCanRemove] = useState(false);
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

  useToolbarRerender(editor);

  useEffect(() => {
    if (!colorOpen) return;
    const onDown = (/** @type {MouseEvent} */ e) => {
      const el = colorWrapRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setColorOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [colorOpen]);

  if (!editor) return null;

  const focused = Boolean(editor.isFocused);
  const active = (/** @type {string} */ name, /** @type {Record<string, unknown>} */ attrs) =>
    focused && (attrs ? editor.isActive(name, attrs) : editor.isActive(name));

  const textStyleAttrs = editor.getAttributes('textStyle');
  const currentColor = typeof textStyleAttrs.color === 'string' ? textStyleAttrs.color : null;
  const colorControlActive = focused && currentColor != null && currentColor !== '';

  const openLinkModal = () => {
    editor.chain().focus();
    const inLink = editor.isActive('link');
    const href = editor.getAttributes('link').href;
    setLinkInitialUrl(typeof href === 'string' ? href : '');
    setLinkCanRemove(inLink);
    setLinkModalOpen(true);
  };

  const applyLinkFromModal = (urlRaw) => {
    const trimmed = urlRaw.trim();
    if (trimmed === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const { empty } = editor.state.selection;
    if (empty) {
      const h = escapeHtmlAttr(trimmed);
      editor.chain().focus().insertContent(`<a href="${h}">${h}</a>`).run();
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

  return (
    <>
    <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
      <div className={styles.toolbarInner}>
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
            <div className={styles.colorPopover} role="listbox" aria-label="Text color">
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
                  onMouseDown={(e) => e.preventDefault()}
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
    </div>
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
        canRemoveLink={linkCanRemove}
        onApply={(url) => applyLinkFromModal(url)}
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
}) {
  const audioScopeFallbackRef = useRef(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `audio-${Date.now()}`
  );
  const audioStorageScopeId = audioStorageScopeIdProp ?? audioScopeFallbackRef.current;

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
      <MenuBar editor={editor} audioStorageScopeId={audioStorageScopeId} />
      <div className={`${styles.surface} ${surfaceClassName ?? ''}`}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
