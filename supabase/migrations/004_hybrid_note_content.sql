-- Hybrid note content: markdown-authored vs HTML (imports / legacy).
-- Existing rows keep HTML in body_html; content_type defaults to html.

alter table public.notes add column if not exists body_markdown text;
alter table public.notes add column if not exists content_type text not null default 'html';

update public.notes set content_type = 'html' where content_type is null;

alter table public.notes drop constraint if exists notes_content_type_check;
alter table public.notes add constraint notes_content_type_check
  check (content_type in ('markdown', 'html'));

comment on column public.notes.body_markdown is
  'Markdown source when content_type = markdown; null for HTML notes.';
comment on column public.notes.content_type is
  'markdown = body_markdown is authoritative; html = body_html is authoritative (imports, legacy).';
