-- =============================================================================
-- D1 - Storage buckets
--   lesson-media    note PDFs, small video files, thumbnails  (signed-in read)
--   lesson-private  transcripts, read by staff and AI only
--   answer-sheets   students' written-answer photos           (owner + staff)
--   avatars         profile photos                            (public read)
-- Object names start with an owner/lesson folder: '<uuid>/<file>'.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('lesson-media',   'lesson-media',   false, 52428800, array['application/pdf', 'video/mp4', 'image/jpeg', 'image/png', 'image/webp']),
  ('lesson-private', 'lesson-private', false, 10485760, array['text/plain', 'application/pdf', 'text/vtt', 'application/x-subrip']),
  ('answer-sheets',  'answer-sheets',  false, 5242880,  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('avatars',        'avatars',        true,  2097152,  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- lesson-media: folder = lesson id
create policy "lesson-media: read by lesson viewers" on storage.objects for select to authenticated using (
  bucket_id = 'lesson-media' and (
    public.is_staff() or exists (
      select 1 from public.lessons l
      where l.id::text = (storage.foldername(name))[1]
        and l.is_published and public.student_can_see_subject(l.subject_id)
    )
  )
);
create policy "lesson-media: write by staff" on storage.objects for insert to authenticated
  with check (bucket_id = 'lesson-media' and public.is_staff());
create policy "lesson-media: update by staff" on storage.objects for update to authenticated
  using (bucket_id = 'lesson-media' and public.is_staff());
create policy "lesson-media: delete by admin" on storage.objects for delete to authenticated
  using (bucket_id = 'lesson-media' and public.is_admin());

-- lesson-private: staff only (Edge Functions use the service role)
create policy "lesson-private: staff" on storage.objects for all to authenticated
  using (bucket_id = 'lesson-private' and public.is_staff())
  with check (bucket_id = 'lesson-private' and public.is_staff());

-- answer-sheets: folder = student id
create policy "answer-sheets: student uploads own" on storage.objects for insert to authenticated
  with check (bucket_id = 'answer-sheets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "answer-sheets: student reads own, staff read all" on storage.objects for select to authenticated
  using (bucket_id = 'answer-sheets' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- avatars: folder = user id
create policy "avatars: owner writes" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner updates" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
