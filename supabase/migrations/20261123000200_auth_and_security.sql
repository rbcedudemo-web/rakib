-- =============================================================================
-- D1 - Roles, enrolment and Row Level Security
-- Rules (Guideline sec. 9, project instructions sec. 7):
--   * a student sees only their own records and the subjects of their class,
--     version and group; never the question bank or correct answers;
--   * a teacher sees only the subjects assigned to them;
--   * an admin sees everything.
-- Every helper is SECURITY DEFINER with an empty search_path.
-- =============================================================================

-- ------------------------------------------------------------ helpers ----
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_user_role() in ('admin', 'teacher'), false)
$$;

create or replace function public.teaches_subject(p_subject_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.teacher_subjects ts
    join public.profiles p on p.id = ts.teacher_id and p.is_active and p.role = 'teacher'
    where ts.teacher_id = auth.uid() and ts.subject_id = p_subject_id
  )
$$;

create or replace function public.teaches_lesson(p_lesson_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select public.teaches_subject((select l.subject_id from public.lessons l where l.id = p_lesson_id))
$$;

-- Does the signed-in student's class / version / group match this subject?
create or replace function public.student_can_see_subject(p_subject_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.subjects s
    join public.profiles p on p.id = auth.uid()
    where s.id = p_subject_id
      and s.is_active
      and p.role = 'student' and p.is_active and p.enrolled_at is not null
      and s.class_id = p.class_id
      and s.version = p.version
      and (s.group_code is null or s.group_code = p.group_code)
  )
$$;

create or replace function public.has_paid_service(p_student_id uuid, p_service public.paid_service)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s
    where s.student_id = p_student_id and s.service = p_service
      and (now() at time zone 'Asia/Dhaka')::date between s.starts_on and s.ends_on
  )
$$;

create or replace function public.setting_int(p_key text, p_default integer)
returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((select (s.value #>> '{}')::integer from public.settings s where s.key = p_key), p_default)
$$;

-- ------------------------------------------------- new user -> profile ----
-- Role comes only from app_metadata, which only the service role can set.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, phone, email, full_name)
  values (
    new.id,
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'student'),
    nullif(new.phone, ''),
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------- protect sensitive profile fields ----
-- Signed-in users may edit their own name and photo. Role, class, version,
-- group, phone, student code and status change only through an admin or the
-- enrolment function below (Guideline sec. 7a: students cannot change class).
-- SECURITY INVOKER on purpose: current_user is then the API role of the caller,
-- while SECURITY DEFINER functions such as enroll_student() run as the owner.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.role        is distinct from old.role
    or new.phone       is distinct from old.phone
    or new.student_code is distinct from old.student_code
    or new.class_id    is distinct from old.class_id
    or new.group_code  is distinct from old.group_code
    or new.version     is distinct from old.version
    or new.is_active   is distinct from old.is_active
    or new.enrolled_at is distinct from old.enrolled_at then
      raise exception 'only an admin can change these profile fields' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- --------------------------------------------------------- enrolment ----
-- First-login form (Guideline sec. 7a). Runs once per student.
create or replace function public.enroll_student(
  p_full_name text,
  p_class_id smallint,
  p_version public.version_code,
  p_group public.group_code default null
)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if coalesce(trim(p_full_name), '') = '' or length(trim(p_full_name)) > 100 then
    raise exception 'name is required' using errcode = '22023';
  end if;
  if p_class_id not between 6 and 12 then
    raise exception 'class must be 6 to 12' using errcode = '22023';
  end if;
  if p_class_id >= 9 and p_group is null then
    raise exception 'group is required from class 9' using errcode = '22023';
  end if;
  if p_class_id < 9 and p_group is not null then
    raise exception 'classes 6 to 8 have no group' using errcode = '22023';
  end if;

  update public.profiles p
     set full_name    = trim(p_full_name),
         class_id     = p_class_id,
         version      = p_version,
         group_code   = p_group,
         enrolled_at  = now(),
         student_code = 'RB' || to_char(now() at time zone 'Asia/Dhaka', 'YY') || '-'
                        || lpad(nextval('public.student_code_seq')::text, 6, '0')
   where p.id = auth.uid() and p.role = 'student' and p.enrolled_at is null
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'already enrolled or not a student' using errcode = '42501';
  end if;
  return v_profile;
end $$;

-- ---------------------------------------------- lesson list & unlocking ----
-- Lesson N+1 opens when lesson N's video is watched to the unlock threshold
-- (setting unlock_percent, default 50). Staff see every lesson unlocked.
create or replace function public.subject_lessons(p_subject_id uuid)
returns table (
  id uuid, sequence integer, title text, chapter_id uuid,
  duration_seconds integer, watched_percent numeric, is_completed boolean, is_unlocked boolean
)
language sql stable security definer set search_path = '' as $$
  with visible as (
    select l.*
    from public.lessons l
    where l.subject_id = p_subject_id
      and l.is_published
      and (public.teaches_subject(p_subject_id) or public.student_can_see_subject(p_subject_id))
  ), ordered as (
    select v.id, v.sequence, v.title, v.chapter_id, v.duration_seconds,
           coalesce(lp.watched_percent, 0) as watched_percent,
           lp.completed_at is not null as is_completed,
           lag(lp.completed_at is not null, 1, true) over (order by v.sequence) as prev_completed
    from visible v
    left join public.lesson_progress lp on lp.lesson_id = v.id and lp.student_id = auth.uid()
  )
  select o.id, o.sequence, o.title, o.chapter_id, o.duration_seconds, o.watched_percent, o.is_completed,
         (public.is_staff() or o.is_completed or o.prev_completed) as is_unlocked
  from ordered o
  order by o.sequence
$$;

create or replace function public.lesson_is_unlocked(p_lesson_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select sl.is_unlocked
    from public.lessons l, public.subject_lessons(l.subject_id) sl
    where l.id = p_lesson_id and sl.id = p_lesson_id
  ), false)
$$;

-- Called by the video player. Progress only goes up; completion is sticky.
create or replace function public.record_lesson_progress(p_lesson_id uuid, p_watched_seconds integer)
returns public.lesson_progress
language plpgsql security definer set search_path = '' as $$
declare
  v_duration integer;
  v_percent  numeric(5,2);
  v_row      public.lesson_progress;
begin
  if public.current_user_role() is distinct from 'student' then
    raise exception 'only students record progress' using errcode = '42501';
  end if;
  if not public.lesson_is_unlocked(p_lesson_id) then
    raise exception 'lesson is locked' using errcode = '42501';
  end if;
  select l.duration_seconds into v_duration from public.lessons l where l.id = p_lesson_id;
  if v_duration is null then
    raise exception 'lesson has no duration' using errcode = '22023';
  end if;
  v_percent := least(100, round(greatest(p_watched_seconds, 0)::numeric * 100 / v_duration, 2));

  insert into public.lesson_progress as lp (student_id, lesson_id, watched_seconds, watched_percent, completed_at)
  values (auth.uid(), p_lesson_id, least(greatest(p_watched_seconds, 0), v_duration), v_percent,
          case when v_percent >= public.setting_int('unlock_percent', 50) then now() end)
  on conflict (student_id, lesson_id) do update
     set watched_seconds = greatest(lp.watched_seconds, excluded.watched_seconds),
         watched_percent = greatest(lp.watched_percent, excluded.watched_percent),
         completed_at    = coalesce(lp.completed_at, excluded.completed_at)
  returning * into v_row;
  return v_row;
end $$;

-- ===================================================== Row Level Security ==
alter table public.classes             enable row level security;
alter table public.groups              enable row level security;
alter table public.versions            enable row level security;
alter table public.subjects            enable row level security;
alter table public.chapters            enable row level security;
alter table public.profiles            enable row level security;
alter table public.teacher_subjects    enable row level security;
alter table public.lessons             enable row level security;
alter table public.lesson_progress     enable row level security;
alter table public.exam_settings       enable row level security;
alter table public.questions           enable row level security;
alter table public.exam_attempts       enable row level security;
alter table public.attempt_answers     enable row level security;
alter table public.mark_changes        enable row level security;
alter table public.tutor_conversations enable row level security;
alter table public.tutor_messages      enable row level security;
alter table public.ai_usage_log        enable row level security;
alter table public.settings            enable row level security;
alter table public.packages            enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.live_classes        enable row level security;
alter table public.notices             enable row level security;

-- Public reference data: readable by everyone (public site shows classes,
-- subjects, packages, live schedule and notices); written by admins.
create policy "read: everyone" on public.classes  for select using (true);
create policy "read: everyone" on public.groups   for select using (true);
create policy "read: everyone" on public.versions for select using (true);
create policy "read: everyone" on public.subjects for select using (true);
create policy "read: everyone" on public.chapters for select using (true);
create policy "read: everyone" on public.packages for select using (is_active or public.is_admin());
create policy "read: everyone" on public.live_classes for select using (true);
create policy "read: everyone" on public.notices  for select using (published_at <= now() or public.is_admin());

create policy "write: admin" on public.classes      for all using (public.is_admin()) with check (public.is_admin());
create policy "write: admin" on public.groups       for all using (public.is_admin()) with check (public.is_admin());
create policy "write: admin" on public.versions     for all using (public.is_admin()) with check (public.is_admin());
create policy "write: admin" on public.subjects     for all using (public.is_admin()) with check (public.is_admin());
create policy "write: admin" on public.packages     for all using (public.is_admin()) with check (public.is_admin());
create policy "write: admin" on public.live_classes for all using (public.is_admin()) with check (public.is_admin());
create policy "write: admin" on public.notices      for all using (public.is_admin()) with check (public.is_admin());
create policy "write: subject staff" on public.chapters for all
  using (public.teaches_subject(subject_id)) with check (public.teaches_subject(subject_id));

-- Profiles
create policy "read: self" on public.profiles for select using (id = auth.uid());
create policy "read: admin" on public.profiles for select using (public.is_admin());
create policy "read: teacher sees students of own classes" on public.profiles for select using (
  role = 'student' and exists (
    select 1 from public.teacher_subjects ts join public.subjects s on s.id = ts.subject_id
    where ts.teacher_id = auth.uid() and s.class_id = profiles.class_id and s.version = profiles.version
  )
);
create policy "update: self (name, photo; guarded by trigger)" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "write: admin" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

create policy "read: self or admin" on public.teacher_subjects for select
  using (teacher_id = auth.uid() or public.is_admin());
create policy "write: admin" on public.teacher_subjects for all using (public.is_admin()) with check (public.is_admin());

-- Lessons: students see published lessons of their own subjects.
create policy "read: students of the subject" on public.lessons for select
  using (is_published and public.student_can_see_subject(subject_id));
create policy "read: subject staff" on public.lessons for select using (public.teaches_subject(subject_id));
create policy "insert: admin or uploading teacher" on public.lessons for insert with check (
  public.is_admin() or exists (
    select 1 from public.teacher_subjects ts
    where ts.teacher_id = auth.uid() and ts.subject_id = lessons.subject_id and ts.can_upload
  )
);
create policy "update: subject staff" on public.lessons for update
  using (public.teaches_subject(subject_id)) with check (public.teaches_subject(subject_id));
create policy "delete: admin" on public.lessons for delete using (public.is_admin());

-- Progress: read own; written only through record_lesson_progress().
create policy "read: self" on public.lesson_progress for select using (student_id = auth.uid());
create policy "read: subject staff" on public.lesson_progress for select using (public.teaches_lesson(lesson_id));

-- Exam settings: visible to whoever can see the lesson; edited by staff.
create policy "read: lesson viewers" on public.exam_settings for select using (
  public.teaches_lesson(lesson_id) or exists (
    select 1 from public.lessons l where l.id = lesson_id and l.is_published and public.student_can_see_subject(l.subject_id)
  )
);
create policy "write: subject staff" on public.exam_settings for all
  using (public.teaches_lesson(lesson_id)) with check (public.teaches_lesson(lesson_id));

-- Question bank: staff only. Students receive questions through exam
-- functions (D4) that strip correct answers.
create policy "all: subject staff" on public.questions for all
  using (public.teaches_lesson(lesson_id)) with check (public.teaches_lesson(lesson_id));

-- Attempts and answers: student reads own; staff of the subject read all;
-- writes only through exam functions (D4) and the marking function (D5).
create policy "read: self" on public.exam_attempts for select using (student_id = auth.uid());
create policy "read: subject staff" on public.exam_attempts for select using (public.teaches_lesson(lesson_id));

create policy "read: own attempt" on public.attempt_answers for select using (
  exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.student_id = auth.uid())
);
create policy "read: subject staff" on public.attempt_answers for select using (
  exists (select 1 from public.exam_attempts a where a.id = attempt_id and public.teaches_lesson(a.lesson_id))
);

create policy "read: own answer or staff" on public.mark_changes for select using (
  exists (
    select 1 from public.attempt_answers aa join public.exam_attempts a on a.id = aa.attempt_id
    where aa.id = answer_id and (a.student_id = auth.uid() or public.teaches_lesson(a.lesson_id))
  )
);

-- Tutor: own conversations; admins read all (Guideline sec. 7: shown above the chat).
create policy "read: self or admin" on public.tutor_conversations for select
  using (user_id = auth.uid() or public.is_admin());
create policy "insert: self" on public.tutor_conversations for insert with check (user_id = auth.uid());
create policy "read: self or admin" on public.tutor_messages for select using (
  exists (select 1 from public.tutor_conversations c
          where c.id = conversation_id and (c.user_id = auth.uid() or public.is_admin()))
);
-- messages are written by the tutor Edge Function (service role), not by clients.

create policy "read: admin" on public.ai_usage_log for select using (public.is_admin());

create policy "read: signed in" on public.settings for select using (auth.uid() is not null);
create policy "write: admin" on public.settings for all using (public.is_admin()) with check (public.is_admin());

create policy "read: self or admin" on public.subscriptions for select
  using (student_id = auth.uid() or public.is_admin());
create policy "write: admin" on public.subscriptions for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------- grants ----
revoke all on function public.enroll_student(text, smallint, public.version_code, public.group_code) from public, anon;
grant execute on function public.enroll_student(text, smallint, public.version_code, public.group_code) to authenticated;
revoke all on function public.record_lesson_progress(uuid, integer) from public, anon;
grant execute on function public.record_lesson_progress(uuid, integer) to authenticated;
revoke all on function public.subject_lessons(uuid) from public, anon;
grant execute on function public.subject_lessons(uuid) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on sequence public.student_code_seq from anon, authenticated;
