-- RLS for private `note-audio` bucket (user-scoped paths: `{user_id}/...`).
-- Upload/list often work via dashboard defaults; DELETE requires an explicit policy.
-- Paths must match upload layout: `{auth.uid()}/scope/uuid_filename.ext`

drop policy if exists "note_audio_select_own" on storage.objects;
drop policy if exists "note_audio_insert_own" on storage.objects;
drop policy if exists "note_audio_update_own" on storage.objects;
drop policy if exists "note_audio_delete_own" on storage.objects;

create policy "note_audio_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'note-audio'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "note_audio_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'note-audio'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "note_audio_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'note-audio'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'note-audio'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- DELETE (and SELECT above) are both required for .remove() to work.
create policy "note_audio_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'note-audio'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
