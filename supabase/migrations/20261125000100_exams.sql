-- =============================================================================
-- D3 + D4: lesson exams.
--
-- Students never read the question bank directly (RLS keeps it staff only).
-- Everything a student does in an exam goes through these functions, which
-- hide the correct answers until the attempt is submitted:
--
--   exam_status(lesson)        attempts left today, best score, questions ready
--   start_exam(lesson)         picks random questions, shuffles options, starts the server timer
--   exam_attempt_view(attempt) the paper (and, after submission, the corrections)
--   save_exam_answer(...)      saves one answer while the timer runs
--   submit_exam(attempt)       marks MCQs at once; written answers wait for marking (D5)
--
-- Rules from Rakib: 3 attempts a day (setting exam_attempts_per_day), the
-- counter resets at midnight in Dhaka, the highest score counts, and the
-- paper is submitted automatically when the time is up.
-- =============================================================================

-- Language of a question: decides the option letters (ক খ গ ঘ or A B C D)
-- in the exam and the result, whatever language the site is shown in.
alter table public.questions add column if not exists language text not null default 'bn'
  check (language in ('bn', 'en'));

-- A small grace period for network delay when the timer runs out.
create or replace function public.exam_grace() returns interval
language sql immutable set search_path = '' as $$ select interval '30 seconds' $$;

create or replace function public.dhaka_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Dhaka')::date $$;

-- ------------------------------------------------ marking (internal) ----
-- Marks the MCQs of an attempt and closes it. Not callable by clients.
create or replace function public.finalize_exam_attempt(p_attempt_id uuid, p_status public.attempt_status)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_mcq_marks numeric(4,1);
  v_written_marks numeric(4,1);
begin
  select coalesce(es.mcq_marks, 1), coalesce(es.written_marks, 5)
    into v_mcq_marks, v_written_marks
    from public.exam_attempts a
    left join public.exam_settings es on es.lesson_id = a.lesson_id
   where a.id = p_attempt_id and a.status = 'in_progress'
   for update of a;
  if not found then return; end if;

  -- MCQ: right or wrong, marked at once
  update public.attempt_answers aa
     set is_correct     = (aa.selected_index is not distinct from q.correct_index),
         marks_awarded  = case when aa.selected_index = q.correct_index then v_mcq_marks else 0 end,
         marking_status = case when aa.selected_index is null then 'unanswered' else 'auto' end::public.marking_status
    from public.questions q
   where aa.attempt_id = p_attempt_id and q.id = aa.question_id and q.type = 'mcq';

  -- Written: with a photo it waits for AI / teacher marking (D5); without one it scores 0
  update public.attempt_answers aa
     set marks_awarded  = case when cardinality(aa.image_paths) = 0 then 0 end,
         is_correct     = case when cardinality(aa.image_paths) = 0 then false end,
         marking_status = case when cardinality(aa.image_paths) = 0 then 'unanswered' else 'pending_teacher' end::public.marking_status
    from public.questions q
   where aa.attempt_id = p_attempt_id and q.id = aa.question_id and q.type = 'written';

  update public.exam_attempts a
     set status       = p_status,
         submitted_at = now(),
         score        = (select coalesce(sum(aa.marks_awarded), 0) from public.attempt_answers aa where aa.attempt_id = a.id)
   where a.id = p_attempt_id;
end $$;

-- Closes the caller's attempts whose time ran out (lazy auto-submit).
create or replace function public.expire_my_exam_attempts(p_lesson_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select a.id from public.exam_attempts a
     where a.student_id = auth.uid() and a.lesson_id = p_lesson_id
       and a.status = 'in_progress' and now() > a.deadline_at + public.exam_grace()
  loop
    perform public.finalize_exam_attempt(r.id, 'expired');
  end loop;
end $$;

-- ------------------------------------------------------- exam_status ----
create or replace function public.exam_status(p_lesson_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.exam_settings;
  v_limit integer := public.setting_int('exam_attempts_per_day', 3);
  v_used integer := 0;
  v_mcq integer;
  v_written integer;
  v_best numeric;
  v_best_max numeric;
  v_open uuid;
  v_history jsonb;
begin
  if not (public.lesson_is_unlocked(p_lesson_id) or public.teaches_lesson(p_lesson_id)) then
    raise exception 'lesson is locked' using errcode = '42501';
  end if;
  if auth.uid() is not null and public.current_user_role() = 'student' then
    perform public.expire_my_exam_attempts(p_lesson_id);
  end if;

  select * into v_settings from public.exam_settings where lesson_id = p_lesson_id;
  select count(*) filter (where type = 'mcq'), count(*) filter (where type = 'written')
    into v_mcq, v_written
    from public.questions where lesson_id = p_lesson_id and is_active;

  select count(*) into v_used from public.exam_attempts
   where student_id = auth.uid() and lesson_id = p_lesson_id and attempt_date = public.dhaka_today();

  select a.score, a.max_score into v_best, v_best_max from public.exam_attempts a
   where a.student_id = auth.uid() and a.lesson_id = p_lesson_id and a.status <> 'in_progress'
   order by a.score desc nulls last, a.submitted_at limit 1;

  select a.id into v_open from public.exam_attempts a
   where a.student_id = auth.uid() and a.lesson_id = p_lesson_id and a.status = 'in_progress'
   order by a.started_at desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', h.id, 'attempt_date', h.attempt_date, 'attempt_no', h.attempt_no, 'status', h.status,
           'score', h.score, 'max_score', h.max_score, 'submitted_at', h.submitted_at,
           'pending', h.pending) order by h.started_at desc), '[]'::jsonb)
    into v_history
    from (select a.*, exists (select 1 from public.attempt_answers aa
                               where aa.attempt_id = a.id and aa.marking_status = 'pending_teacher') as pending
            from public.exam_attempts a
           where a.student_id = auth.uid() and a.lesson_id = p_lesson_id and a.status <> 'in_progress'
           order by a.started_at desc limit 10) h;

  return jsonb_build_object(
    'mcq_count',        coalesce(v_settings.mcq_count, 10),
    'written_count',    coalesce(v_settings.written_count, 2),
    'duration_minutes', coalesce(v_settings.duration_minutes, 15),
    'mcq_marks',        coalesce(v_settings.mcq_marks, 1),
    'written_marks',    coalesce(v_settings.written_marks, 5),
    'bank_mcq',         v_mcq,
    'bank_written',     v_written,
    'attempts_used',    v_used,
    'attempts_limit',   v_limit,
    'best_score',       v_best,
    'best_max_score',   v_best_max,
    'open_attempt_id',  v_open,
    'history',          v_history
  );
end $$;

-- ------------------------------------------------- exam_attempt_view ----
-- Options are returned in the attempt's shuffled order; "selected" and
-- "correct" are positions in that shown order. The correct answer, the
-- explanation and the model answer appear only after submission.
create or replace function public.exam_attempt_view(p_attempt_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.exam_attempts;
  v_done boolean;
  v_questions jsonb;
begin
  select * into a from public.exam_attempts where id = p_attempt_id;
  if not found or not (a.student_id = auth.uid() or public.teaches_lesson(a.lesson_id)) then
    raise exception 'attempt not found' using errcode = '42501';
  end if;
  if a.status = 'in_progress' and now() > a.deadline_at + public.exam_grace() then
    perform public.finalize_exam_attempt(a.id, 'expired');
    select * into a from public.exam_attempts where id = p_attempt_id;
  end if;
  v_done := a.status <> 'in_progress';

  select jsonb_agg(jsonb_build_object(
           'id',       q.id,
           'n',        ord.n,
           'type',     q.type,
           'lang',     q.language,
           'prompt',   q.prompt,
           'options',  case when q.type = 'mcq' then
                         (select jsonb_agg(q.options -> (o.idx)::int order by o.pos)
                            from jsonb_array_elements_text(a.option_orders -> q.id::text) with ordinality o(idx, pos))
                       end,
           'selected', case when aa.selected_index is not null then
                         (select (o.pos - 1)::int
                            from jsonb_array_elements_text(a.option_orders -> q.id::text) with ordinality o(idx, pos)
                           where o.idx::int = aa.selected_index)
                       end,
           'images',   to_jsonb(aa.image_paths),
           'marks',    case when q.type = 'mcq' then coalesce(es.mcq_marks, 1) else coalesce(es.written_marks, 5) end,
           'correct',  case when v_done and q.type = 'mcq' then
                         (select (o.pos - 1)::int
                            from jsonb_array_elements_text(a.option_orders -> q.id::text) with ordinality o(idx, pos)
                           where o.idx::int = q.correct_index)
                       end,
           'is_correct',     case when v_done then aa.is_correct end,
           'marks_awarded',  case when v_done then aa.marks_awarded end,
           'marking_status', case when v_done then aa.marking_status end,
           'feedback',       case when v_done then aa.ai_feedback end,
           'explanation',    case when v_done then q.explanation end,
           'model_answer',   case when v_done then q.model_answer end
         ) order by ord.n)
    into v_questions
    from unnest(a.question_ids) with ordinality ord(qid, n)
    join public.questions q on q.id = ord.qid
    left join public.attempt_answers aa on aa.attempt_id = a.id and aa.question_id = q.id
    left join public.exam_settings es on es.lesson_id = a.lesson_id;

  return jsonb_build_object(
    'id',           a.id,
    'lesson_id',    a.lesson_id,
    'attempt_no',   a.attempt_no,
    'attempt_date', a.attempt_date,
    'status',       a.status,
    'started_at',   a.started_at,
    'deadline_at',  a.deadline_at,
    'submitted_at', a.submitted_at,
    'now',          now(),
    'score',        a.score,
    'max_score',    a.max_score,
    'questions',    coalesce(v_questions, '[]'::jsonb)
  );
end $$;

-- -------------------------------------------------------- start_exam ----
create or replace function public.start_exam(p_lesson_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.exam_settings;
  v_mcq_n integer;  v_written_n integer;  v_minutes integer;
  v_mcq_marks numeric;  v_written_marks numeric;
  v_open uuid;
  v_used integer;
  v_ids uuid[];
  v_orders jsonb;
  v_max numeric;
  v_id uuid;
begin
  if public.current_user_role() is distinct from 'student' then
    raise exception 'only students take exams' using errcode = '42501';
  end if;
  if not public.lesson_is_unlocked(p_lesson_id) then
    raise exception 'lesson is locked' using errcode = '42501';
  end if;

  -- one student, one lesson: serialise concurrent starts
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_lesson_id::text, 0));
  perform public.expire_my_exam_attempts(p_lesson_id);

  -- an exam already running is resumed, not started again
  select id into v_open from public.exam_attempts
   where student_id = auth.uid() and lesson_id = p_lesson_id and status = 'in_progress'
   order by started_at desc limit 1;
  if v_open is not null then
    return public.exam_attempt_view(v_open);
  end if;

  select count(*) into v_used from public.exam_attempts
   where student_id = auth.uid() and lesson_id = p_lesson_id and attempt_date = public.dhaka_today();
  if v_used >= public.setting_int('exam_attempts_per_day', 3) then
    raise exception 'daily_limit' using errcode = 'P0001', hint = 'exam.error.dailyLimit';
  end if;

  select * into v_settings from public.exam_settings where lesson_id = p_lesson_id;
  v_mcq_n         := coalesce(v_settings.mcq_count, 10);
  v_written_n     := coalesce(v_settings.written_count, 2);
  v_minutes       := coalesce(v_settings.duration_minutes, 15);
  v_mcq_marks     := coalesce(v_settings.mcq_marks, 1);
  v_written_marks := coalesce(v_settings.written_marks, 5);

  -- random questions from the bank: MCQs first, then written
  select coalesce(array_agg(id order by grp, rnd), '{}') into v_ids from (
    (select id, 1 as grp, random() as rnd from public.questions
      where lesson_id = p_lesson_id and is_active and type = 'mcq' order by random() limit v_mcq_n)
    union all
    (select id, 2, random() from public.questions
      where lesson_id = p_lesson_id and is_active and type = 'written' order by random() limit v_written_n)
  ) pick;
  if cardinality(v_ids) = 0 then
    raise exception 'no_questions' using errcode = 'P0001', hint = 'exam.error.noQuestions';
  end if;

  -- shuffled option order per MCQ: list of original indexes in the order shown
  select coalesce(jsonb_object_agg(q.id::text,
           (select jsonb_agg(i order by random()) from generate_series(0, jsonb_array_length(q.options) - 1) i)),
         '{}'::jsonb)
    into v_orders
    from public.questions q where q.id = any (v_ids) and q.type = 'mcq';

  select coalesce(sum(case when type = 'mcq' then v_mcq_marks else v_written_marks end), 0)
    into v_max from public.questions where id = any (v_ids);

  insert into public.exam_attempts (student_id, lesson_id, attempt_no, question_ids, option_orders, deadline_at, max_score)
  values (auth.uid(), p_lesson_id, v_used + 1, v_ids, v_orders, now() + make_interval(mins => v_minutes), v_max)
  returning id into v_id;

  insert into public.attempt_answers (attempt_id, question_id)
  select v_id, unnest(v_ids);

  return public.exam_attempt_view(v_id);
end $$;

-- -------------------------------------------------- save_exam_answer ----
-- p_selected is the position in the shown (shuffled) order, or null to clear.
-- p_images are storage paths in answer-sheets under <student>/<attempt>/.
create or replace function public.save_exam_answer(
  p_attempt_id uuid, p_question_id uuid, p_selected integer default null, p_images text[] default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.exam_attempts;
  v_type public.question_type;
  v_original integer;
  v_prefix text;
  v_path text;
begin
  select * into a from public.exam_attempts where id = p_attempt_id and student_id = auth.uid();
  if not found then
    raise exception 'attempt not found' using errcode = '42501';
  end if;
  if a.status <> 'in_progress' or now() > a.deadline_at + public.exam_grace() then
    raise exception 'time_up' using errcode = 'P0001', hint = 'exam.error.timeUp';
  end if;
  if not (p_question_id = any (a.question_ids)) then
    raise exception 'question is not in this exam' using errcode = '22023';
  end if;
  select type into v_type from public.questions where id = p_question_id;

  if v_type = 'mcq' then
    if p_selected is not null then
      select o.idx::int into v_original
        from jsonb_array_elements_text(a.option_orders -> p_question_id::text) with ordinality o(idx, pos)
       where o.pos = p_selected + 1;
      if v_original is null then
        raise exception 'no such option' using errcode = '22023';
      end if;
    end if;
    update public.attempt_answers set selected_index = v_original
     where attempt_id = p_attempt_id and question_id = p_question_id;
  else
    p_images := coalesce(p_images, '{}');
    if cardinality(p_images) > public.setting_int('max_answer_images', 4) then
      raise exception 'too many photos' using errcode = '22023', hint = 'exam.error.tooManyPhotos';
    end if;
    v_prefix := auth.uid()::text || '/' || p_attempt_id::text || '/';
    foreach v_path in array p_images loop
      if left(v_path, length(v_prefix)) <> v_prefix or v_path like '%..%' then
        raise exception 'bad photo path' using errcode = '22023';
      end if;
    end loop;
    update public.attempt_answers set image_paths = p_images
     where attempt_id = p_attempt_id and question_id = p_question_id;
  end if;
end $$;

-- ------------------------------------------------------- submit_exam ----
create or replace function public.submit_exam(p_attempt_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt_id and student_id = auth.uid();
  if not found then
    raise exception 'attempt not found' using errcode = '42501';
  end if;
  if a.status = 'in_progress' then
    perform public.finalize_exam_attempt(
      p_attempt_id,
      case when now() > a.deadline_at + public.exam_grace() then 'expired' else 'submitted' end::public.attempt_status);
  end if;
  return public.exam_attempt_view(p_attempt_id);
end $$;

-- ------------------------------------------------------------ grants ----
-- Hosted Supabase gives no default grants (see 20261123000400_api_grants.sql).
revoke all on function public.exam_grace() from public;
revoke all on function public.dhaka_today() from public;
revoke all on function public.finalize_exam_attempt(uuid, public.attempt_status) from public, anon, authenticated;
revoke all on function public.expire_my_exam_attempts(uuid) from public, anon, authenticated;
revoke all on function public.exam_status(uuid) from public, anon;
revoke all on function public.exam_attempt_view(uuid) from public, anon;
revoke all on function public.start_exam(uuid) from public, anon;
revoke all on function public.save_exam_answer(uuid, uuid, integer, text[]) from public, anon;
revoke all on function public.submit_exam(uuid) from public, anon;

grant execute on function public.exam_grace() to anon, authenticated, service_role;
grant execute on function public.dhaka_today() to anon, authenticated, service_role;
grant execute on function public.finalize_exam_attempt(uuid, public.attempt_status) to service_role;
grant execute on function public.expire_my_exam_attempts(uuid) to service_role;
grant execute on function public.exam_status(uuid) to authenticated, service_role;
grant execute on function public.exam_attempt_view(uuid) to authenticated, service_role;
grant execute on function public.start_exam(uuid) to authenticated, service_role;
grant execute on function public.save_exam_answer(uuid, uuid, integer, text[]) to authenticated, service_role;
grant execute on function public.submit_exam(uuid) to authenticated, service_role;

-- answer-sheets photos: folder = <student id>/<attempt id>/ (policy already
-- checks the first folder). Students may also replace or remove their own.
drop policy if exists "answer-sheets: student deletes own" on storage.objects;
create policy "answer-sheets: student deletes own" on storage.objects for delete to authenticated
  using (bucket_id = 'answer-sheets' and (storage.foldername(name))[1] = auth.uid()::text);

-- Deleting a lesson removes its questions and attempts together; with
-- ON DELETE RESTRICT that failed half-way. Answers now follow their question,
-- and a trigger stops a question that is already in an exam from being
-- deleted on its own (the admin switches it off instead).
alter table public.attempt_answers drop constraint if exists attempt_answers_question_id_fkey;
alter table public.attempt_answers add constraint attempt_answers_question_id_fkey
  foreign key (question_id) references public.questions(id) on delete cascade;

create or replace function public.guard_question_delete()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- when the whole lesson is being deleted, its row is already gone
  if exists (select 1 from public.lessons l where l.id = old.lesson_id)
     and exists (select 1 from public.attempt_answers aa where aa.question_id = old.id) then
    raise exception 'question_in_use' using errcode = '23503', hint = 'switch it off instead';
  end if;
  return old;
end $$;
revoke all on function public.guard_question_delete() from public, anon, authenticated;

drop trigger if exists questions_guard_delete on public.questions;
create trigger questions_guard_delete before delete on public.questions
  for each row execute function public.guard_question_delete();
