-- Comedy rating (half-star steps). Production may add CHECK `notes_comedy_rating_check` separately.
alter table public.notes
  add column if not exists comedy_rating numeric(2, 1);

comment on column public.notes.comedy_rating is
  'Optional 0.5–5.0 comedy rating. Allowed values enforced by notes_comedy_rating_check in production.';
