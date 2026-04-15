/**
 * Update `fileName` on every noteAudio node that shares the same storage path (embed references stay valid).
 * @param {import('@tiptap/core').Editor} editor
 * @param {string} storagePath
 * @param {string} newFileName
 */
export function updateNoteAudioFileNameByStoragePath(editor, storagePath, newFileName) {
  if (!editor || !storagePath) return;
  const { state } = editor;
  const tr = state.tr;
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'noteAudio' && node.attrs.storagePath === storagePath) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, fileName: newFileName });
    }
  });
  if (tr.docChanged) editor.view.dispatch(tr);
}
