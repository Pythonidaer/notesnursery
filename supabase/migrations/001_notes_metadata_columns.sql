-- Optional Apple Notes metadata on `public.notes`.
-- Older deployments may lack these columns; the app omits them on insert when empty.
-- Run this (or apply full `supabase/schema.sql`) so imports can store `created_at_source` / `modified_at_source`.

alter table public.notes add column if not exists created_at_source text;
alter table public.notes add column if not exists modified_at_source text;
