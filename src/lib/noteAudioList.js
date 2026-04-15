import { NOTE_AUDIO_BUCKET } from '../constants/noteAudio.js';
import { getSupabase } from './supabaseClient.js';

/** Lists `.wav` / `.mp3` objects under each `{userId}/*` prefix (matches upload paths). */
export async function listUserNoteAudioFiles(userId) {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: scopes, error: errRoot } = await supabase.storage
    .from(NOTE_AUDIO_BUCKET)
    .list(userId, { limit: 100, sortBy: { column: 'updated_at', order: 'desc' } });

  if (errRoot) {
    console.error('[note-audio] list', errRoot);
    throw errRoot;
  }

  const out = [];

  for (const scope of scopes ?? []) {
    if (!scope?.name) continue;

    if (/\.(wav|mp3)$/i.test(scope.name) && scope.metadata && typeof scope.metadata.size === 'number') {
      out.push({
        path: `${userId}/${scope.name}`,
        fileName: scope.name,
        sizeBytes: scope.metadata.size,
        mimeType: typeof scope.metadata.mimetype === 'string' ? scope.metadata.mimetype : '',
        updatedAt: scope.updated_at || scope.created_at || '',
      });
      continue;
    }

    const prefix = `${userId}/${scope.name}`;
    const { data: files, error: errSub } = await supabase.storage
      .from(NOTE_AUDIO_BUCKET)
      .list(prefix, { limit: 100, sortBy: { column: 'updated_at', order: 'desc' } });

    if (errSub) continue;

    for (const f of files ?? []) {
      if (!f?.name || !/\.(wav|mp3)$/i.test(f.name)) continue;
      const path = `${prefix}/${f.name}`;
      const size = f.metadata?.size;
      const mime = f.metadata?.mimetype;
      out.push({
        path,
        fileName: f.name,
        sizeBytes: typeof size === 'number' ? size : null,
        mimeType: typeof mime === 'string' ? mime : '',
        updatedAt: f.updated_at || f.created_at || '',
      });
    }
  }

  out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return out;
}
