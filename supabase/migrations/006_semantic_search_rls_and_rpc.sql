-- Semantic search MVP: indexes, RLS on note_embeddings, and search_my_notes RPC.
-- Prerequisites: public.note_embeddings exists with at least:
--   user_id uuid, note_id uuid, embedding vector(384), source_text text (NOT NULL in production),
--   updated_at timestamptz (recommended), id uuid (PK, default gen_random_uuid() recommended).

-- One embedding row per note per user (required for PostgREST upserts from the backfill script).
create unique index if not exists note_embeddings_user_id_note_id_uidx
  on public.note_embeddings (user_id, note_id);

create index if not exists note_embeddings_user_id_idx on public.note_embeddings (user_id);
create index if not exists note_embeddings_note_id_idx on public.note_embeddings (note_id);

alter table public.note_embeddings enable row level security;

drop policy if exists "note_embeddings_select_own" on public.note_embeddings;
create policy "note_embeddings_select_own" on public.note_embeddings
  for select using (auth.uid() = user_id);

drop policy if exists "note_embeddings_insert_own" on public.note_embeddings;
create policy "note_embeddings_insert_own" on public.note_embeddings
  for insert with check (auth.uid() = user_id);

drop policy if exists "note_embeddings_update_own" on public.note_embeddings;
create policy "note_embeddings_update_own" on public.note_embeddings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "note_embeddings_delete_own" on public.note_embeddings;
create policy "note_embeddings_delete_own" on public.note_embeddings
  for delete using (auth.uid() = user_id);

-- Vector similarity search scoped to the invoker's notes only (SECURITY INVOKER = auth.uid() from JWT).
create or replace function public.search_my_notes(
  query_embedding vector(384),
  match_count int default 8
)
returns table (
  note_id uuid,
  title text,
  body_html text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    n.id as note_id,
    n.title,
    n.body_html,
    (1 - (ne.embedding <=> query_embedding))::double precision as similarity
  from public.note_embeddings ne
  inner join public.notes n
    on n.id = ne.note_id
    and n.user_id = ne.user_id
  where ne.user_id = auth.uid()
    and n.user_id = auth.uid()
  order by ne.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 8), 1), 50);
$$;

revoke all on function public.search_my_notes(vector(384), int) from public;
grant execute on function public.search_my_notes(vector(384), int) to authenticated;
