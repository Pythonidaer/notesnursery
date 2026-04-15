/**
 * Walks resolved position ancestors for list item nodes.
 *
 * @param {import('@tiptap/pm/model').ResolvedPos} $pos
 */
function isPosInsideListItem($pos) {
  for (let d = $pos.depth; d > 0; d--) {
    const name = $pos.node(d).type.name;
    if (name === 'listItem' || name === 'taskItem') return true;
  }
  return false;
}

/**
 * True when the selection is in a bullet, ordered, or task list context.
 * Uses document ancestors first, then TipTap `isActive` so we still catch cases where
 * focus/selection timing would otherwise miss a list (e.g. after toolbar interaction).
 *
 * @param {import('@tiptap/core').Editor} editor
 */
export function isSelectionInsideListItem(editor) {
  if (!editor?.state?.selection) return false;

  const { $from, $to } = editor.state.selection;
  if (isPosInsideListItem($from) || isPosInsideListItem($to)) return true;

  return (
    editor.isActive('bulletList') ||
    editor.isActive('orderedList') ||
    editor.isActive('taskList')
  );
}

/**
 * Focus the editor and return whether audio may be inserted at the current selection.
 * Call this immediately before opening the file picker or running upload so the selection
 * reflects the caret, not the toolbar/modal.
 *
 * @param {import('@tiptap/core').Editor} editor
 * @returns {boolean} true if insertion is allowed (not inside a list item)
 */
export function focusEditorAndCanInsertNoteAudio(editor) {
  editor.commands.focus();
  return !isSelectionInsideListItem(editor);
}

/**
 * Inserts a `noteAudio` block at the current selection when allowed.
 * Refuses when the selection is inside a list item (no upload is triggered here).
 *
 * @param {import('@tiptap/core').Editor} editor
 * @param {Record<string, unknown>} attrs
 * @returns {boolean} whether the block was inserted
 */
export function insertNoteAudioBlock(editor, attrs) {
  if (!focusEditorAndCanInsertNoteAudio(editor)) return false;

  const noteAudioType = editor.state.schema.nodes.noteAudio;
  if (!noteAudioType) return false;

  editor.chain().focus().insertContent({ type: 'noteAudio', attrs }).run();
  return true;
}
