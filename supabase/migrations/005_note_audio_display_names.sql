-- User-editable display names for note audio objects (storage path stays stable; embeds keep working).

create table if not exists public.note_audio_display_names (
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  display_name text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, storage_path)
);

create index if not exists note_audio_display_names_user_id_idx
  on public.note_audio_display_names (user_id);

alter table public.note_audio_display_names enable row level security;

create policy "note_audio_display_names_select_own" on public.note_audio_display_names
  for select using (auth.uid() = user_id);

create policy "note_audio_display_names_insert_own" on public.note_audio_display_names
  for insert with check (auth.uid() = user_id);

create policy "note_audio_display_names_update_own" on public.note_audio_display_names
  for update using (auth.uid() = user_id);

create policy "note_audio_display_names_delete_own" on public.note_audio_display_names
  for delete using (auth.uid() = user_id);
