/**
 * Backfill public.note_embeddings for the authenticated user.
 *
 * Expected table columns (hosted): id (uuid, default ok), user_id, note_id,
 * source_text (typically NOT NULL), embedding vector(384), updated_at (timestamptz).
 *
 * Env (required):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_ACCESS_TOKEN — a valid user JWT (access_token from the client session)
 *
 * Run from repo root:
 *   node scripts/backfill-note-embeddings.js
 *
 * Optional:
 *   SEMANTIC_SEARCH_EMBED_URL — override Edge Function URL (default: $SUPABASE_URL/functions/v1/embed-note-text)
 */

import { createClient } from '@supabase/supabase-js';
import { buildNoteEmbeddingSourceText } from '../src/utils/noteEmbeddingSourceText.js';

const SELECT_NOTES = `
  *,
  note_labels (
    labels (
      name
    )
  )
`;

function mapRowToNote(row) {
  const nl = row.note_labels ?? [];
  const labels = nl
    .map((x) => (x.labels && x.labels.name ? String(x.labels.name) : null))
    .filter(Boolean);
  return {
    id: row.id,
    title: row.title ?? '',
    bodyHtml: row.body_html ?? '',
    bodyMarkdown: row.body_markdown ?? '',
    contentType: row.content_type ?? 'html',
    labels,
  };
}

function env(name) {
  const v = process.env[name];
  if (!v?.trim()) {
    throw new Error(`Missing env ${name}`);
  }
  return v.trim();
}

async function main() {
  const url = env('SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY');
  const accessToken = env('SUPABASE_ACCESS_TOKEN');
  const embedUrl =
    process.env.SEMANTIC_SEARCH_EMBED_URL?.trim() ||
    `${url.replace(/\/$/, '')}/functions/v1/embed-note-text`;

  const supabase = createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw new Error(`Invalid session: ${userErr?.message ?? 'no user'}`);
  }

  console.log(`[backfill] user ${user.id}`);
  console.log(`[backfill] embed endpoint ${embedUrl}`);

  const { data: rows, error: fetchErr } = await supabase
    .from('notes')
    .select(SELECT_NOTES)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (fetchErr) {
    throw fetchErr;
  }

  const notes = (rows ?? []).map(mapRowToNote);
  console.log(`[backfill] notes to index: ${notes.length}`);

  const { data: embRows, error: embErr } = await supabase
    .from('note_embeddings')
    .select('note_id, source_text')
    .eq('user_id', user.id);

  if (embErr) {
    throw embErr;
  }

  const previousSourceByNoteId = new Map(
    (embRows ?? []).map((r) => [r.note_id, r.source_text ?? '']),
  );

  let embedded = 0;
  let reEmbedded = 0;
  let skippedUnchanged = 0;
  let failed = 0;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const text = buildNoteEmbeddingSourceText(note);
    const label = `[backfill] ${i + 1}/${notes.length} ${note.id.slice(0, 8)}…`;
    const prev = previousSourceByNoteId.get(note.id);

    if (prev === text) {
      console.log(`${label} unchanged → skipped`);
      skippedUnchanged++;
      continue;
    }
    if (prev === undefined) {
      console.log(`${label} missing → embedding`);
    } else {
      console.log(`${label} changed source_text → re-embedding`);
    }

    try {
      const res = await fetch(embedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`${label} embed HTTP ${res.status}: ${errText}`);
        failed++;
        continue;
      }

      const payload = await res.json();
      const embedding = payload.embedding;
      if (!Array.isArray(embedding) || embedding.length !== 384) {
        console.error(`${label} bad embedding shape`, embedding?.length);
        failed++;
        continue;
      }

      const updatedAt = new Date().toISOString();
      const { error: upErr } = await supabase.from('note_embeddings').upsert(
        {
          user_id: user.id,
          note_id: note.id,
          source_text: text,
          embedding,
          updated_at: updatedAt,
        },
        { onConflict: 'user_id,note_id' },
      );

      if (upErr) {
        console.error(`${label} upsert`, upErr);
        failed++;
        continue;
      }

      if (prev === undefined) {
        embedded++;
        console.log(`${label} embedded`);
      } else {
        reEmbedded++;
        console.log(`${label} re-embedded`);
      }
    } catch (e) {
      console.error(label, e);
      failed++;
    }
  }

  console.log(
    `[backfill] done: ${embedded} new, ${reEmbedded} re-embedded, ${skippedUnchanged} skipped (unchanged), ${failed} failed`,
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('[backfill] fatal', e);
  process.exitCode = 1;
});
