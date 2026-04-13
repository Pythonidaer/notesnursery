-- Notes Nursery — first-pass Supabase Postgres schema + RLS
-- Run in Supabase SQL Editor or via `supabase db push` if using Supabase CLI.

-- Profiles (username alongside auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  default_label_id uuid references public.labels (id) on delete set null
);

-- Notes (imported or user-created)
-- Optional metadata columns: existing projects can run migrations/001_notes_metadata_columns.sql
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  body_html text not null default '',
  source_file_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at_source text,
  modified_at_source text
);

create index if not exists notes_user_id_updated_at_idx on public.notes (user_id, updated_at desc);

-- Labels (per user, unique name per user)
create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists labels_user_id_name_idx on public.labels (user_id, name);

-- Join table
create table if not exists public.note_labels (
  note_id uuid not null references public.notes (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (note_id, label_id)
);

create index if not exists note_labels_label_id_idx on public.note_labels (label_id);

-- updated_at is set in application code on each update (avoids trigger dialect issues).

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.notes enable row level security;
alter table public.labels enable row level security;
alter table public.note_labels enable row level security;

-- Profiles: users can read/update own row
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Notes
create policy "notes_select_own" on public.notes
  for select using (auth.uid() = user_id);

create policy "notes_insert_own" on public.notes
  for insert with check (auth.uid() = user_id);

create policy "notes_update_own" on public.notes
  for update using (auth.uid() = user_id);

create policy "notes_delete_own" on public.notes
  for delete using (auth.uid() = user_id);

-- Labels
create policy "labels_select_own" on public.labels
  for select using (auth.uid() = user_id);

create policy "labels_insert_own" on public.labels
  for insert with check (auth.uid() = user_id);

create policy "labels_update_own" on public.labels
  for update using (auth.uid() = user_id);

create policy "labels_delete_own" on public.labels
  for delete using (auth.uid() = user_id);

-- note_labels: allow if the note belongs to the user
create policy "note_labels_select_own" on public.note_labels
  for select using (
    exists (
      select 1 from public.notes n
      where n.id = note_labels.note_id and n.user_id = auth.uid()
    )
  );

create policy "note_labels_insert_own" on public.note_labels
  for insert with check (
    exists (
      select 1 from public.notes n
      where n.id = note_labels.note_id and n.user_id = auth.uid()
    )
    and exists (
      select 1 from public.labels l
      where l.id = note_labels.label_id and l.user_id = auth.uid()
    )
  );

create policy "note_labels_delete_own" on public.note_labels
  for delete using (
    exists (
      select 1 from public.notes n
      where n.id = note_labels.note_id and n.user_id = auth.uid()
    )
  );
