-- =============================================================================
-- Security and rules tests for D1. Run against a database that has the
-- migrations and seed applied:  npm run db:test
-- Everything runs in one transaction and is rolled back.
-- =============================================================================
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'ok   %', label;
end $$;

-- run a statement and expect it to be refused
create or replace function pg_temp.refused(stmt text, label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok   % (refused: %)', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % (statement was allowed)', label;
end $$;

create or replace function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.act_as_admin_db() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
grant execute on all functions in schema pg_temp to authenticated;

-- ------------------------------------------------------------ people ----
insert into auth.users (id, email, phone, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', null, '{"role":"admin"}', '{"full_name":"Admin"}'),
  ('00000000-0000-0000-0000-0000000000a1', null, '8801700000001', '{"role":"teacher"}', '{"full_name":"Bangla Teacher"}'),
  ('00000000-0000-0000-0000-0000000000a2', null, '8801700000002', '{"role":"teacher"}', '{"full_name":"Math Teacher"}'),
  ('00000000-0000-0000-0000-0000000000b1', null, '8801800000001', '{}', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', null, '8801800000002', '{"role":"student"}', '{}'),
  ('00000000-0000-0000-0000-0000000000b3', null, '8801800000003', '{}', '{}');

select pg_temp.check((select count(*) = 6 from public.profiles), 'a profile is created for every new user');
select pg_temp.check((select role = 'teacher' from public.profiles where phone = '8801700000001'), 'role comes from app_metadata');
select pg_temp.check((select role = 'student' from public.profiles where phone = '8801800000001'), 'default role is student');

-- assign teachers
insert into public.teacher_subjects (teacher_id, subject_id)
select '00000000-0000-0000-0000-0000000000a1', id from public.subjects where class_id = 9 and version = 'bangla' and code = 'bangla-1';
insert into public.teacher_subjects (teacher_id, subject_id)
select '00000000-0000-0000-0000-0000000000a2', id from public.subjects where class_id = 9 and version = 'bangla' and code = 'math';

-- lessons in Class 9 Bangla Version, Bangla 1st Paper
insert into public.lessons (id, subject_id, sequence, title, video_url, duration_seconds, is_published, status)
select v.id::uuid, s.id, v.seq, v.title, 'https://youtu.be/demo', 600, v.pub, 'ready'
from public.subjects s,
     (values ('10000000-0000-0000-0000-000000000001', 1, 'পাঠ ১', true),
             ('10000000-0000-0000-0000-000000000002', 2, 'পাঠ ২', true),
             ('10000000-0000-0000-0000-000000000003', 3, 'পাঠ ৩', true),
             ('10000000-0000-0000-0000-000000000004', 4, 'খসড়া পাঠ', false)) as v(id, seq, title, pub)
where s.class_id = 9 and s.version = 'bangla' and s.code = 'bangla-1';

insert into public.questions (lesson_id, type, prompt, options, correct_index, explanation)
values ('10000000-0000-0000-0000-000000000001', 'mcq', 'প্রশ্ন?', '["ক","খ","গ","ঘ"]', 2, 'কারণ');

-- --------------------------------------------------------- enrolment ----
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select pg_temp.refused($$select public.enroll_student('রাফি', 9::smallint, 'bangla', null)$$, 'class 9 needs a group');
select pg_temp.refused($$select public.enroll_student('রাফি', 8::smallint, 'bangla', 'science')$$, 'class 8 has no group');
select pg_temp.refused($$select public.enroll_student('', 9::smallint, 'bangla', 'science')$$, 'name is required');
select pg_temp.check((select student_code ~ '^RB[0-9]{2}-[0-9]{6}$'
                      from public.enroll_student('রাফি আহমেদ', 9::smallint, 'bangla', 'science')),
                     'enrolment gives a student ID like RB26-000001');
select pg_temp.refused($$select public.enroll_student('রাফি', 10::smallint, 'bangla', 'science')$$, 'enrolment runs only once');

select pg_temp.refused($$update public.profiles set class_id = 10 where id = auth.uid()$$, 'student cannot change own class');
select pg_temp.refused($$update public.profiles set role = 'admin' where id = auth.uid()$$, 'student cannot make self admin');
update public.profiles set full_name = 'রাফি আ.' where id = auth.uid();
select pg_temp.check((select full_name = 'রাফি আ.' from public.profiles where id = auth.uid()), 'student can change own name');
select pg_temp.check((select count(*) = 1 from public.profiles), 'student sees only own profile');

-- ----------------------------------------------------- what students see ----
select pg_temp.check(
  (select bool_and(public.student_can_see_subject(id)) from public.subjects
   where class_id = 9 and version = 'bangla' and (group_code is null or group_code = 'science')),
  'science student sees compulsory and science subjects');
select pg_temp.check(
  (select not bool_or(public.student_can_see_subject(id)) from public.subjects
   where not (class_id = 9 and version = 'bangla' and (group_code is null or group_code = 'science'))),
  'science student sees no commerce, arts, other class or other version subject');

select pg_temp.check((select count(*) = 3 from public.lessons), 'student sees the 3 published lessons, not the draft');
select pg_temp.check((select count(*) = 0 from public.questions), 'student cannot read the question bank');
select pg_temp.refused($$insert into public.lesson_progress (student_id, lesson_id, watched_percent, completed_at)
                         values (auth.uid(), '10000000-0000-0000-0000-000000000002', 100, now())$$,
                       'student cannot write progress directly');

-- -------------------------------------------------- ordered unlocking ----
select pg_temp.check(
  (select array_agg(is_unlocked order by sequence) = array[true, false, false]
   from public.subject_lessons((select subject_id from public.lessons where sequence = 1 limit 1))),
  'only lesson 1 is open at the start');
select pg_temp.refused($$select public.record_lesson_progress('10000000-0000-0000-0000-000000000002', 300)$$,
                       'progress on a locked lesson is refused');
select public.record_lesson_progress('10000000-0000-0000-0000-000000000001', 240);  -- 40%
select pg_temp.check(not public.lesson_is_unlocked('10000000-0000-0000-0000-000000000002'), '40% watched keeps lesson 2 locked');
select public.record_lesson_progress('10000000-0000-0000-0000-000000000001', 300);  -- 50%
select pg_temp.check(public.lesson_is_unlocked('10000000-0000-0000-0000-000000000002'), '50% watched opens lesson 2');
select pg_temp.check(not public.lesson_is_unlocked('10000000-0000-0000-0000-000000000003'), 'lesson 3 stays locked');
select public.record_lesson_progress('10000000-0000-0000-0000-000000000001', 60);   -- going back
select pg_temp.check((select watched_percent = 50 and completed_at is not null from public.lesson_progress
                      where lesson_id = '10000000-0000-0000-0000-000000000001'),
                     'progress never goes down and completion sticks');

-- storage: answer sheets in own folder only
insert into storage.objects (bucket_id, name) values ('answer-sheets', '00000000-0000-0000-0000-0000000000b1/q1.jpg');
select pg_temp.refused($$insert into storage.objects (bucket_id, name) values ('answer-sheets', '00000000-0000-0000-0000-0000000000b2/x.jpg')$$,
                       'student cannot upload into another student''s folder');
select pg_temp.refused($$insert into public.settings (key, value) values ('hack', '1')$$, 'student cannot change settings');

-- second student (class 10 commerce) cannot see class 9 lessons
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.enroll_student('নাদিয়া', 10::smallint, 'bangla', 'commerce');
select pg_temp.check((select count(*) = 0 from public.lessons), 'class 10 student does not see class 9 lessons');
select pg_temp.check((select count(*) = 0 from public.lesson_progress), 'student does not see others'' progress');
select pg_temp.check((select count(*) = 0 from storage.objects where bucket_id = 'answer-sheets'), 'student cannot see others'' answer sheets');

-- ------------------------------------------------------------- teachers ----
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) = 1 from public.questions), 'Bangla teacher sees own subject''s question bank');
select pg_temp.check((select count(*) = 4 from public.lessons), 'teacher sees drafts of own subject');
select pg_temp.check((select bool_and(is_unlocked) from public.subject_lessons(
                        (select subject_id from public.lessons where sequence = 1 limit 1))), 'all lessons are open for teachers');
select pg_temp.check((select count(*) = 1 from public.profiles where role = 'student'), 'teacher sees students of own class only');
select pg_temp.check((select count(*) = 0 from public.ai_usage_log), 'teacher cannot see AI costs');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select pg_temp.check((select count(*) = 0 from public.questions), 'Math teacher cannot see Bangla questions');
update public.lessons set title = 'hacked' where sequence = 1;
select pg_temp.check((select count(*) = 0 from public.lessons where title = 'hacked'), 'Math teacher cannot edit Bangla lessons');
select pg_temp.refused($$insert into public.lessons (subject_id, sequence, title) select subject_id, 9, 'x' from public.teacher_subjects where teacher_id = auth.uid()$$,
                       'teacher without upload permission cannot add lessons');
select pg_temp.refused($$select public.move_lesson('10000000-0000-0000-0000-000000000002', -1)$$,
                       'Math teacher cannot reorder Bangla lessons');

-- ---------------------------------------------------------------- admin ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) = 6 from public.profiles), 'admin sees every profile');
update public.profiles set class_id = 10, group_code = 'science' where phone = '8801800000001';
select pg_temp.check((select class_id = 10 from public.profiles where phone = '8801800000001'), 'admin can move a student to another class');
insert into public.settings (key, value) values ('test_key', '1');
select pg_temp.check((select count(*) = 1 from public.questions), 'admin sees the question bank');

-- admin Video Upload (D2)
select public.move_lesson('10000000-0000-0000-0000-000000000002', -1);
set constraints all immediate;
select pg_temp.check((select sequence = 1 from public.lessons where id = '10000000-0000-0000-0000-000000000002')
                 and (select sequence = 2 from public.lessons where id = '10000000-0000-0000-0000-000000000001'),
                 'admin moves a lesson up (the two lessons swap places)');
select public.move_lesson('10000000-0000-0000-0000-000000000002', -1);
select pg_temp.check((select sequence = 1 from public.lessons where id = '10000000-0000-0000-0000-000000000002'), 'moving the first lesson up changes nothing');
select public.move_lesson('10000000-0000-0000-0000-000000000004', 1);
select pg_temp.check((select sequence = 4 from public.lessons where id = '10000000-0000-0000-0000-000000000004'), 'moving the last lesson down changes nothing');
insert into public.chapters (id, subject_id, title, sort)
select '20000000-0000-0000-0000-000000000001', id, 'অধ্যায় ১', 1 from public.subjects where class_id = 9 and version = 'bangla' and code = 'math';
insert into public.lessons (id, subject_id, chapter_id, sequence, title, created_by)
select '10000000-0000-0000-0000-000000000009', subject_id, id, 1, 'ভগ্নাংশ', auth.uid() from public.chapters where id = '20000000-0000-0000-0000-000000000001';
insert into public.exam_settings (lesson_id, mcq_count, written_count, duration_minutes)
values ('10000000-0000-0000-0000-000000000009', 12, 3, 20);
select pg_temp.check((select count(*) = 1 from public.exam_settings where lesson_id = '10000000-0000-0000-0000-000000000009'),
                     'admin adds a chapter, a draft lesson and its exam settings');
select pg_temp.refused($$update public.lessons set is_published = true where id = '10000000-0000-0000-0000-000000000009'$$,
                       'a lesson without a video cannot be published');

-- the website server (service_role key): used by the demo phone login
select pg_temp.act_as_admin_db();
set local role service_role;
select pg_temp.check((select count(*) = 6 from public.profiles), 'website server can read profiles (demo login)');
select pg_temp.check((select count(*) > 0 from public.subjects), 'website server can read subjects');
reset role;

-- anonymous visitors
select pg_temp.act_as_admin_db();
set local role anon;
select pg_temp.check((select count(*) > 0 from public.subjects), 'visitors can browse subjects');
select pg_temp.check((select count(*) = 0 from public.lessons), 'visitors cannot see lessons');
select pg_temp.check((select count(*) = 0 from public.profiles), 'visitors cannot see profiles');

reset role;
rollback;
\echo ALL RLS TESTS PASSED
