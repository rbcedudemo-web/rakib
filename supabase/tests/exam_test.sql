-- =============================================================================
-- Exam tests (D3 + D4). Run by npm run db:test after rls_test.sql.
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
  ('00000000-0000-0000-0000-0000000000b1', null, '8801800000001', '{}', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', null, '8801800000002', '{}', '{}');
insert into public.teacher_subjects (teacher_id, subject_id)
select '00000000-0000-0000-0000-0000000000a1', id from public.subjects where class_id = 9 and version = 'bangla' and code = 'bangla-1';

insert into public.lessons (id, subject_id, sequence, title, video_url, duration_seconds, is_published, status)
select v.id::uuid, s.id, v.seq, v.title, 'https://youtu.be/demo', 600, true, 'ready'
from public.subjects s,
     (values ('10000000-0000-0000-0000-000000000001', 1, 'পাঠ ১'),
             ('10000000-0000-0000-0000-000000000002', 2, 'পাঠ ২')) as v(id, seq, title)
where s.class_id = 9 and s.version = 'bangla' and s.code = 'bangla-1';

insert into public.exam_settings (lesson_id, mcq_count, written_count, duration_minutes, mcq_marks, written_marks)
values ('10000000-0000-0000-0000-000000000001', 2, 1, 5, 1, 5);

-- every MCQ: the right option says "ঠিক", so the test can find it after shuffling
insert into public.questions (lesson_id, type, prompt, options, correct_index, explanation, model_answer) values
  ('10000000-0000-0000-0000-000000000001', 'mcq', 'প্রশ্ন ১', '["ঠিক","ভুল ক","ভুল খ","ভুল গ"]', 0, 'ব্যাখ্যা ১', null),
  ('10000000-0000-0000-0000-000000000001', 'mcq', 'প্রশ্ন ২', '["ভুল ক","ঠিক","ভুল খ","ভুল গ"]', 1, 'ব্যাখ্যা ২', null),
  ('10000000-0000-0000-0000-000000000001', 'mcq', 'প্রশ্ন ৩', '["ভুল ক","ভুল খ","ঠিক","ভুল গ"]', 2, 'ব্যাখ্যা ৩', null),
  ('10000000-0000-0000-0000-000000000001', 'written', 'লিখিত প্রশ্ন', null, null, null, 'আদর্শ উত্তর'),
  ('10000000-0000-0000-0000-000000000001', 'mcq', 'বাতিল প্রশ্ন', '["ঠিক","ভুল"]', 0, null, null);
update public.questions set is_active = false where prompt = 'বাতিল প্রশ্ন';

-- --------------------------------------------------------- the student ----
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.enroll_student('রাফি', 9::smallint, 'bangla', 'science');

select pg_temp.check((select (s ->> 'bank_mcq')::int = 3 and (s ->> 'bank_written')::int = 1
                         and (s ->> 'attempts_used')::int = 0 and (s ->> 'attempts_limit')::int = 3
                      from public.exam_status('10000000-0000-0000-0000-000000000001') s),
                     'exam status: 3 MCQ + 1 written ready, 0 of 3 attempts used');
select pg_temp.refused($$select public.start_exam('10000000-0000-0000-0000-000000000002')$$, 'exam of a locked lesson is refused');
select pg_temp.refused($$insert into public.exam_attempts (student_id, lesson_id, attempt_no, question_ids, deadline_at, max_score)
                         values (auth.uid(), '10000000-0000-0000-0000-000000000001', 1, '{}', now() + interval '1 hour', 99)$$,
                       'student cannot write an attempt directly');

insert into t select 'a1', public.start_exam('10000000-0000-0000-0000-000000000001');
select pg_temp.check((select jsonb_array_length(v -> 'questions') = 3 from t where k = 'a1'),
                     'exam has 2 MCQ + 1 written, as set by the admin');
select pg_temp.check((select (v ->> 'max_score')::numeric = 7 from t where k = 'a1'), 'full marks = 2 x 1 + 1 x 5 = 7');
select pg_temp.check((select bool_and(q -> 'correct' = 'null'::jsonb and q -> 'explanation' = 'null'::jsonb)
                        from t, jsonb_array_elements(v -> 'questions') q where k = 'a1'),
                     'correct answers and explanations are hidden during the exam');
select pg_temp.check((select not bool_or(q ->> 'prompt' = 'বাতিল প্রশ্ন') from t, jsonb_array_elements(v -> 'questions') q where k = 'a1'),
                     'switched-off questions are never asked');
select pg_temp.check((select (q ->> 'type') = 'written' from t, jsonb_array_elements(v -> 'questions') q
                       where k = 'a1' and (q ->> 'n')::int = 3), 'MCQs come first, written last');
select pg_temp.check((select (deadline - started) between interval '4 minutes 59 seconds' and interval '5 minutes 1 second'
                        from (select (v ->> 'deadline_at')::timestamptz deadline, (v ->> 'started_at')::timestamptz started from t where k = 'a1') x),
                     'server timer is 5 minutes');
select pg_temp.check((select (public.start_exam('10000000-0000-0000-0000-000000000001') ->> 'id') = (v ->> 'id') from t where k = 'a1'),
                     'starting again resumes the running exam');
select pg_temp.check((select (public.exam_status('10000000-0000-0000-0000-000000000001') ->> 'attempts_used')::int = 1),
                     'resuming does not use another attempt');

-- answer: Q1 right, Q2 wrong, written with a photo
select public.save_exam_answer((v ->> 'id')::uuid, (v -> 'questions' -> 0 ->> 'id')::uuid, pg_temp.pos(v, 1, 'ঠিক')) from t where k = 'a1';
select public.save_exam_answer((v ->> 'id')::uuid, (v -> 'questions' -> 1 ->> 'id')::uuid, pg_temp.pos(v, 2, 'ভুল ক')) from t where k = 'a1';
select pg_temp.refused(format($$select public.save_exam_answer(%L, %L, null, array['00000000-0000-0000-0000-0000000000b2/x.jpg'])$$,
                              (v ->> 'id'), (v -> 'questions' -> 2 ->> 'id')), 'answer photo from another student''s folder is refused')
  from t where k = 'a1';
select public.save_exam_answer((v ->> 'id')::uuid, (v -> 'questions' -> 2 ->> 'id')::uuid, null,
                               array['00000000-0000-0000-0000-0000000000b1/' || (v ->> 'id') || '/1.jpg']) from t where k = 'a1';
select pg_temp.check((select (public.exam_attempt_view((v ->> 'id')::uuid) -> 'questions' -> 0 ->> 'selected')::int = pg_temp.pos(v, 1, 'ঠিক')
                        from t where k = 'a1'), 'a saved answer comes back in the shuffled order');

-- another student cannot look at it
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.enroll_student('নাদিয়া', 9::smallint, 'bangla', 'science');
select pg_temp.refused(format($$select public.exam_attempt_view(%L)$$, v ->> 'id'), 'another student cannot open my exam') from t where k = 'a1';
select pg_temp.refused(format($$select public.submit_exam(%L)$$, v ->> 'id'), 'another student cannot submit my exam') from t where k = 'a1';
select pg_temp.check((select count(*) = 0 from public.exam_attempts), 'another student does not see my attempts');

-- submit: instant result with corrections
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
insert into t select 'r1', public.submit_exam((v ->> 'id')::uuid) from t where k = 'a1';
select pg_temp.check((select v ->> 'status' = 'submitted' and (v ->> 'score')::numeric = 1 from t where k = 'r1'),
                     'MCQs are marked at once: 1 right = 1 mark');
select pg_temp.check((select (q -> 'is_correct')::boolean and (q ->> 'correct')::int = (q ->> 'selected')::int
                        from t, jsonb_array_elements(v -> 'questions') q where k = 'r1' and (q ->> 'n')::int = 1),
                     'right answer is shown as right');
select pg_temp.check((select not (q -> 'is_correct')::boolean and (q ->> 'correct')::int = pg_temp.pos(v, 2, 'ঠিক')
                             and q ->> 'explanation' like 'ব্যাখ্যা _'
                        from t, jsonb_array_elements(v -> 'questions') q where k = 'r1' and (q ->> 'n')::int = 2),
                     'wrong answer shows the correct option and the explanation');
select pg_temp.check((select q ->> 'marking_status' = 'pending_teacher' and q ->> 'model_answer' = 'আদর্শ উত্তর'
                        from t, jsonb_array_elements(v -> 'questions') q where k = 'r1' and (q ->> 'n')::int = 3),
                     'written answer with a photo waits for marking; model answer is shown');
select pg_temp.refused(format($$select public.save_exam_answer(%L, %L, 0)$$, v ->> 'id', v -> 'questions' -> 0 ->> 'id'),
                       'answers cannot change after submission') from t where k = 'a1';
select pg_temp.check((select (public.submit_exam((v ->> 'id')::uuid) ->> 'score')::numeric = 1 from t where k = 'a1'),
                     'submitting twice changes nothing');
update public.attempt_answers set marks_awarded = 5;  -- no update policy: changes nothing
select pg_temp.check((select count(*) = 0 from public.attempt_answers where marks_awarded = 5), 'student cannot give self marks');

-- attempts 2 and 3, then the daily limit
insert into t select 'a2', public.start_exam('10000000-0000-0000-0000-000000000001');
select public.save_exam_answer((v ->> 'id')::uuid, (v -> 'questions' -> 0 ->> 'id')::uuid, pg_temp.pos(v, 1, 'ঠিক')) from t where k = 'a2';
select public.save_exam_answer((v ->> 'id')::uuid, (v -> 'questions' -> 1 ->> 'id')::uuid, pg_temp.pos(v, 2, 'ঠিক')) from t where k = 'a2';
select public.submit_exam((v ->> 'id')::uuid) from t where k = 'a2';
insert into t select 'a3', public.start_exam('10000000-0000-0000-0000-000000000001');
select public.submit_exam((v ->> 'id')::uuid) from t where k = 'a3';
select pg_temp.check((select (v ->> 'attempt_no')::int = 3 from t where k = 'a3'), 'third attempt is numbered 3');
select pg_temp.refused($$select public.start_exam('10000000-0000-0000-0000-000000000001')$$, 'a 4th attempt on the same day is refused');
select pg_temp.check((select (s ->> 'best_score')::numeric = 2 and (s ->> 'attempts_used')::int = 3
                             and jsonb_array_length(s -> 'history') = 3
                        from public.exam_status('10000000-0000-0000-0000-000000000001') s),
                     'the highest score (2 of 7) counts; 3 attempts listed');

-- teacher of the subject sees the attempts; cannot take the exam
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) = 3 from public.exam_attempts), 'teacher sees the students'' attempts');
select pg_temp.check((select public.exam_attempt_view((v ->> 'id')::uuid) ->> 'status' = 'submitted' from t where k = 'a1'),
                     'teacher can open a student''s result');
select pg_temp.refused($$select public.start_exam('10000000-0000-0000-0000-000000000001')$$, 'teachers do not take exams');
select pg_temp.refused(format($$select public.finalize_exam_attempt(%L, 'submitted')$$, v ->> 'id'), 'internal marking function is not callable')
  from t where k = 'a1';

-- next day (Dhaka midnight): the counter starts again
select pg_temp.act_as_admin_db();
update public.exam_attempts set attempt_date = attempt_date - 1;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
insert into t select 'a4', public.start_exam('10000000-0000-0000-0000-000000000001');
select pg_temp.check((select (v ->> 'attempt_no')::int = 1 from t where k = 'a4'), 'after midnight the student gets 3 new attempts');

-- time runs out: the exam closes itself
select pg_temp.act_as_admin_db();
update public.exam_attempts set started_at = now() - interval '10 minutes', deadline_at = now() - interval '5 minutes'
 where id = (select (v ->> 'id')::uuid from t where k = 'a4');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select pg_temp.refused(format($$select public.save_exam_answer(%L, %L, 0)$$, v ->> 'id', v -> 'questions' -> 0 ->> 'id'),
                       'answers after the time is up are refused') from t where k = 'a4';
select pg_temp.check((select public.exam_attempt_view((v ->> 'id')::uuid) ->> 'status' = 'expired' from t where k = 'a4'),
                     'an exam past its time is submitted automatically');
select pg_temp.check((select (public.exam_status('10000000-0000-0000-0000-000000000001') ->> 'open_attempt_id') is null),
                     'no exam is left running');

-- a question already used in an exam cannot be deleted (switch it off instead), but its lesson can be
select pg_temp.act_as_admin_db();
select pg_temp.refused($$delete from public.questions where prompt = 'লিখিত প্রশ্ন'$$, 'a question used in an exam cannot be deleted');
delete from public.lessons where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.check((select count(*) = 0 from public.exam_attempts), 'deleting a lesson removes its questions and attempts');

reset role;
rollback;
\echo ALL EXAM TESTS PASSED
