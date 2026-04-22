import { getSupabase } from './supabaseClient.js';
import { buildNoteEmbeddingSourceText } from '../utils/noteEmbeddingSourceText.js';

/**
 * Keeps one `note_embeddings` row per note in sync for semantic search.
 * Uses the signed-in session (RLS + Edge Function `auth.getUser()`).
 * Best-effort: does not throw; logs failures so note saves still succeed.
 *
 * @param {string} userId
 * @param {{ id: string, title?: string, bodyHtml?: string, bodyMarkdown?: string, contentType?: string, labels?: string[] }} note
 * @returns {Promise<'embedded' | 're_embedded' | 'unchanged' | 'failed' | 'skipped_no_client'>}
 */
export async function syncNoteEmbeddingForUserNote(userId, note) {
  const supabase = getSupabase();
  if (!supabase) {
    return 'skipped_no_client';
  }

  const noteId = note.id;
  const text = buildNoteEmbeddingSourceText(note);

  try {
    const { data: existing, error: selErr } = await supabase
      .from('note_embeddings')
      .select('source_text')
      .eq('user_id', userId)
      .eq('note_id', noteId)
      .maybeSingle();

    if (selErr) {
      console.error('[embed] read note_embeddings', selErr);
      return 'failed';
    }

    if (existing?.source_text === text) {
      return 'unchanged';
    }

    const { data: fnData, error: fnErr } = await supabase.functions.invoke('embed-note-text', {
      body: { text },
    });

    if (fnErr) {
      console.error('[embed] embed-note-text', fnErr);
      return 'failed';
    }
    if (fnData && typeof fnData === 'object' && 'error' in fnData && fnData.error) {
      console.error('[embed] embed-note-text', fnData.error);
      return 'failed';
    }

    const embedding = fnData && typeof fnData === 'object' ? fnData.embedding : null;
    if (!Array.isArray(embedding) || embedding.length !== 384) {
      console.error('[embed] bad embedding in response');
      return 'failed';
    }

    const updatedAt = new Date().toISOString();
    const { error: upErr } = await supabase.from('note_embeddings').upsert(
      {
        user_id: userId,
        note_id: noteId,
        source_text: text,
        embedding,
        updated_at: updatedAt,
      },
      { onConflict: 'user_id,note_id' },
    );

    if (upErr) {
      console.error('[embed] upsert note_embeddings', upErr);
      return 'failed';
    }

    return existing ? 're_embedded' : 'embedded';
  } catch (e) {
    console.error('[embed] syncNoteEmbeddingForUserNote', e);
    return 'failed';
  }
}
