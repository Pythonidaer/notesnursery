-- Default label filter preference (references labels the user owns).
alter table public.profiles
  add column if not exists default_label_id uuid references public.labels (id) on delete set null;
