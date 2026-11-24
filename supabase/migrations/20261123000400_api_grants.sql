-- Explicit API grants.
-- Newer Supabase projects no longer give the API roles (anon, authenticated,
-- service_role) automatic access to new tables, so the website got
-- "permission denied" (42501). Row Level Security still decides which rows
-- each role can see or change; these grants only open the door to the table.
-- Safe to run more than once.

grant usage on schema public to anon, authenticated, service_role;

-- Tables: RLS is enabled on every table in public (see auth_and_security).
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;

-- Sequences: only the server (e.g. ai_usage_log ids). student_code_seq stays
-- closed to anon/authenticated; enroll_student uses it as owner.
grant usage, select on all sequences in schema public to service_role;

-- Helper functions used inside RLS policies run as the caller, so every API
-- role needs EXECUTE on them.
grant execute on function
  public.current_user_role(),
  public.is_admin(),
  public.is_staff(),
  public.teaches_subject(uuid),
  public.teaches_lesson(uuid),
  public.student_can_see_subject(uuid),
  public.has_paid_service(uuid, public.paid_service),
  public.setting_int(text, integer),
  public.lesson_is_unlocked(uuid)
to anon, authenticated, service_role;

-- Student actions (anon stays revoked).
grant execute on function public.enroll_student(text, smallint, public.version_code, public.group_code) to authenticated, service_role;
grant execute on function public.record_lesson_progress(uuid, integer) to authenticated, service_role;
grant execute on function public.subject_lessons(uuid) to authenticated, service_role;
