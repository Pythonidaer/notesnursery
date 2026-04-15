import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import NoteAudioNodeView from '../components/NoteAudioNodeView.jsx';

export const noteAudioExtension = Node.create({
  name: 'noteAudio',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      storagePath: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-nn-storage-path'),
        renderHTML: (attrs) =>
          attrs.storagePath ? { 'data-nn-storage-path': attrs.storagePath } : {},
      },
      fileName: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-nn-file-name') ?? '',
        renderHTML: (attrs) =>
          attrs.fileName ? { 'data-nn-file-name': attrs.fileName } : {},
      },
      mimeType: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-nn-mime-type') ?? '',
        renderHTML: (attrs) =>
          attrs.mimeType ? { 'data-nn-mime-type': attrs.mimeType } : {},
      },
      sizeBytes: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute('data-nn-size-bytes');
          if (v == null || v === '') return null;
          const n = Number.parseInt(v, 10);
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: (attrs) =>
          attrs.sizeBytes != null ? { 'data-nn-size-bytes': String(attrs.sizeBytes) } : {},
      },
      uploadedAt: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-nn-uploaded-at') ?? '',
        renderHTML: (attrs) =>
          attrs.uploadedAt ? { 'data-nn-uploaded-at': attrs.uploadedAt } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure.nn-audio-embed',
        getAttrs: (el) => {
          if (!el.getAttribute('data-nn-storage-path')) return false;
          return {};
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = (node.attrs.fileName && String(node.attrs.fileName).trim()) || 'Audio clip';
    return [
      'figure',
      mergeAttributes(HTMLAttributes, { class: 'nn-audio-embed' }),
      ['figcaption', { class: 'nn-audio-caption nn-audio-sr-only' }, label],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteAudioNodeView);
  },
});
