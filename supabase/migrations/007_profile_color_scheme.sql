-- Per-user light/dark appearance (app + hamburger menu). Nullable = default light in client.
alter table public.profiles
  add column if not exists color_scheme text;

alter table public.profiles
  drop constraint if exists profiles_color_scheme_check;

alter table public.profiles
  add constraint profiles_color_scheme_check
  check (color_scheme is null or color_scheme in ('light', 'dark'));
