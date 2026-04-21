/**
 * Semantic search via Edge Function (auth + RPC on the server). Does not expose embeddings to the client.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} query
 * @param {number} [limit]
 * @returns {Promise<{ results: { noteId: string, title: string, snippet: string, similarity: number }[] }>}
 */
export async function searchNotesSemantic(supabase, query, limit = 8) {
  const { data, error } = await supabase.functions.invoke('search-notes-semantic', {
    body: { query, limit },
  });

  if (error) {
    throw new Error(error.message || 'Semantic search failed');
  }

  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }

  const results = Array.isArray(data?.results) ? data.results : [];
  return { results };
}
