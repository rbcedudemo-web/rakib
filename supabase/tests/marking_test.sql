-- =============================================================================
-- Marking + report tests (D5). Run by npm run db:test after exam_test.sql.
-- Everything runs in one transaction and is rolled back.
-- =============================================================================
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'ok   %', label;
end $$;

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

-- position of the option with this text in a question of an attempt view
create or replace function pg_temp.pos(v jsonb, qn int, txt text) returns int language sql as $$
  select (o.p - 1)::int
    from jsonb_array_elements(v -> 'questions') q,
         jsonb_array_elements_text(q -> 'options') with ordinality o(t, p)
   where (q ->> 'n')::int = qn and o.t = txt
$$;
grant execute on all functions in schema pg_temp to authenticated;
create temp table t (k text primary key, v jsonb);
grant all on t to authenticated;

-- ------------------------------------------------------------- set up ----
insert into auth.users (id, email, phone, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', null, '8801700000001', '{"role":"teacher"}', '{"full_name":"Bangla Teacher"}'),
  ('00000000-0000-0000-0000-0000000000a2', null, '8801700000002', '{"role":"teacher"}', '{"full_name":"Math Teacher"}'),
  ('00000000-0000-0000-0000-0000000000b1', null, '8801800000001', '{}', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', null, '8801800000002', '{}', '{}');
insert into public.teacher_subjects (teacher_id, subject_id)
select '00000000-0000-0000-0000-0000000000a1', id from public.subjects where class_id = 9 and version = 'bangla' and code = 'bangla-1';
insert into public.teacher_subjects (teacher_id, subject_id)
select '00000000-0000-0000-0000-0000000000a2', id from public.subjects where class_id = 9 and version = 'bangla' and code = 'math';

insert into public.lessons (id, subject_id, sequence, title, video_url, duration_seconds, is_published, status)
select '10000000-0000-0000-0000-000000000001', s.id, 1, 'পাঠ ১', 'https://youtu.be/demo', 600, true, 'ready'
from public.subjects s where s.class_id = 9 and s.version = 'bangla' and s.code = 'bangla-1';
insert into public.exam_settings (lesson_id, mcq_count, written_count, duration_minutes, mcq_marks, written_marks)
values ('10000000-0000-0000-0000-000000000001', 1, 1, 5, 1, 5);
insert into public.questions (lesson_id, type, prompt, options, correct_index, model_answer) values
  ('10000000-0000-0000-0000-000000000001', 'mcq', 'প্রশ্ন ১', '["ঠিক","ভুল ক","ভুল খ","ভুল গ"]', 0, null),
  ('10000000-0000-0000-0000-000000000001', 'written', 'লিখিত প্রশ্ন', null, null, 'আদর্শ উত্তর');

-- student b1 takes the exam: MCQ right, written with a photo
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.enroll_student('রাফি', 9::smallint, 'bangla', 'science');
insert into t select 'a1', public.start_exam('10000000-0000-0000-0000-000000000001');
select public.save_exam_answer((v ->> 'id')::uuid, (v -> 'questions' -> 0 ->> 'id')::uuid, pg_temp.pos(v, 1, 'ঠিক')) from t where k = 'a1';
select public.save_exam_answer((v ->> 'id')::uuid, (v -> 'questions' -> 1 ->> 'id')::uuid, null,
                               array['00000000-0000-0000-0000-0000000000b1/' || (v ->> 'id') || '/1.jpg']) from t where k = 'a1';
select pg_temp.refused($$select public.marking_queue()$$, 'a student cannot open the marking list');
select public.submit_exam((v ->> 'id')::uuid) from t where k = 'a1';
select pg_temp.act_as_admin_db();
insert into t select 'ans', to_jsonb(aa.id) from public.attempt_answers aa join public.questions q on q.id = aa.question_id
 where q.type = 'written';
select pg_temp.check((select count(*) = 1 from t where k = 'ans'), 'the written answer is saved');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select pg_temp.refused(format($$select public.mark_answer(%L, 5)$$, v #>> '{}'), 'a student cannot mark own answer') from t where k = 'ans';
select pg_temp.check((select jsonb_array_length(public.my_report()) = 1
                         and (public.my_report() -> 0 ->> 'best_score')::numeric = 1
                         and (public.my_report() -> 0 ->> 'pending')::boolean),
                     'student report: 1 lesson, 1 mark so far, written answer waiting');
select pg_temp.refused($$select public.results_overview()$$, 'a student cannot open the staff results');

-- teacher of another subject sees nothing and cannot mark
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select pg_temp.check((select jsonb_array_length(public.marking_queue()) = 0 and public.marking_pending_count() = 0),
                     'teacher of another subject sees no answers to mark');
select pg_temp.refused(format($$select public.mark_answer(%L, 5)$$, v #>> '{}'), 'teacher of another subject cannot mark') from t where k = 'ans';
select pg_temp.refused($$select public.lesson_results('10000000-0000-0000-0000-000000000001')$$,
                       'teacher of another subject cannot see this lesson''s results');

-- the subject's teacher marks it
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select public.marking_pending_count() = 1), 'subject teacher: 1 answer waiting');
select pg_temp.check((select q -> 0 ->> 'student_name' = 'রাফি' and q -> 0 ->> 'model_answer' = 'আদর্শ উত্তর'
                         and (q -> 0 ->> 'max_marks')::numeric = 5 and jsonb_array_length(q -> 0 -> 'images') = 1
                      from public.marking_queue() q),
                     'marking list shows student, photo, model answer and full marks');
select pg_temp.refused(format($$select public.mark_answer(%L, 6)$$, v #>> '{}'), 'more than full marks is refused') from t where k = 'ans';
select pg_temp.refused(format($$select public.mark_answer(%L, 2.3)$$, v #>> '{}'), 'marks only in steps of 0.5') from t where k = 'ans';
select pg_temp.refused(format($$select public.mark_answer(%L, -1)$$, v #>> '{}'), 'negative marks are refused') from t where k = 'ans';
select pg_temp.check((select (public.mark_answer((v #>> '{}')::uuid, 3.5, 'ভালো, তবে উদাহরণ দাও') ->> 'attempt_score')::numeric = 4.5
                        from t where k = 'ans'),
                     'teacher gives 3.5: attempt score becomes 1 + 3.5 = 4.5');
select pg_temp.check((select jsonb_array_length(public.marking_queue()) = 0
                         and jsonb_array_length(public.marking_queue('marked')) = 1
                         and public.marking_queue('marked') -> 0 ->> 'marked_by_name' = 'Bangla Teacher'),
                     'marked answer leaves the waiting list and shows who marked it');
select public.mark_answer((v #>> '{}')::uuid, 4, 'আরও ভালো', 'আবার দেখে নম্বর বাড়ালাম') from t where k = 'ans';
select pg_temp.check((select count(*) = 2 and bool_or(old_marks = 3.5 and new_marks = 4 and reason is not null)
                        from public.mark_changes),
                     'every change of marks is recorded with old and new marks');
select pg_temp.check((select (r -> 0 ->> 'students')::int = 1 and (r -> 0 ->> 'avg_best_percent')::int = 83
                         and (r -> 0 ->> 'pending')::int = 0
                      from public.results_overview() r),
                     'results overview: 1 student, average best 5/6 = 83%');
select pg_temp.check((select r -> 0 ->> 'student_name' = 'রাফি' and (r -> 0 ->> 'best_score')::numeric = 5
                      from public.lesson_results('10000000-0000-0000-0000-000000000001') r),
                     'lesson results list the student with best score 5');

-- the student sees the teacher's marks and comment
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select pg_temp.check((select (q ->> 'marks_awarded')::numeric = 4 and q ->> 'feedback' = 'আরও ভালো' and q ->> 'marking_status' = 'teacher'
                      from t, jsonb_array_elements(public.exam_attempt_view((select (v ->> 'id')::uuid from t where k = 'a1')) -> 'questions') q
                      where t.k = 'a1' and q ->> 'type' = 'written'),
                     'student sees the teacher''s marks and comment in the result');
select pg_temp.check((select (public.my_report() -> 0 ->> 'best_score')::numeric = 5 and not (public.my_report() -> 0 ->> 'pending')::boolean),
                     'student report updates: best 5, nothing waiting');

-- another student sees none of it
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.enroll_student('নাদিয়া', 9::smallint, 'bangla', 'science');
select pg_temp.check((select jsonb_array_length(public.my_report()) = 0), 'another student''s report is empty');
select pg_temp.check((select count(*) = 0 from public.mark_changes), 'another student cannot read mark changes');

reset role;
rollback;
\echo ALL MARKING TESTS PASSED
