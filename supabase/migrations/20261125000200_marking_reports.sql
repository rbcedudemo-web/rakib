-- =============================================================================
-- D5 (free part): teachers mark written answers, and reports.
--
--   marking_queue(status, lesson)   written answers with photos, for the lessons
--                                   the caller teaches (admin: all)
--   mark_answer(answer, marks, feedback, reason)
--                                   a teacher gives marks; every change is kept
--                                   in mark_changes and the attempt score updates
--   my_report()                     a student's own results, per lesson
--   results_overview(subject)       staff: per lesson, students, attempts, average
--   lesson_results(lesson)          staff: per student, best score and attempts
--
-- Safe to run more than once.
-- =============================================================================

alter table public.attempt_answers add column if not exists teacher_feedback text;
alter table public.attempt_answers add column if not exists marked_by uuid references public.profiles(id) on delete set null;
alter table public.attempt_answers add column if not exists marked_at timestamptz;
create index if not exists attempt_answers_marked_idx on public.attempt_answers (marked_at desc) where marked_at is not null;

-- Marks out of this many for an answer (same rule as the exam paper).
create or replace function public.answer_max_marks(p_answer_id uuid)
returns numeric
language sql stable security definer set search_path = '' as $$
  select case when q.type = 'mcq' then coalesce(es.mcq_marks, 1) else coalesce(es.written_marks, 5) end
    from public.attempt_answers aa
    join public.exam_attempts a on a.id = aa.attempt_id
    join public.questions q on q.id = aa.question_id
    left join public.exam_settings es on es.lesson_id = a.lesson_id
   where aa.id = p_answer_id
$$;

-- ------------------------------------------------------ marking_queue ----
-- p_status: 'pending' (waiting for a teacher) or 'marked' (already marked).
create or replace function public.marking_queue(p_status text default 'pending', p_lesson_id uuid default null, p_limit integer default 50)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not public.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(x.j order by x.sort_at), '[]'::jsonb) into v from (
    select jsonb_build_object(
             'answer_id',      aa.id,
             'attempt_id',     a.id,
             'lesson_id',      l.id,
             'subject_id',     s.id,
             'lesson_title',   l.title,
             'subject_bn',     s.name_bn,
             'subject_en',     s.name_en,
             'class_id',       s.class_id,
             'student_name',   p.full_name,
             'student_code',   p.student_code,
             'submitted_at',   a.submitted_at,
             'prompt',         q.prompt,
             'model_answer',   q.model_answer,
             'rubric',         q.rubric,
             'images',         to_jsonb(aa.image_paths),
             'max_marks',      coalesce(es.written_marks, 5),
             'marks_awarded',  aa.marks_awarded,
             'marking_status', aa.marking_status,
             'feedback',       coalesce(aa.teacher_feedback, aa.ai_feedback),
             'marked_at',      aa.marked_at,
             'marked_by_name', mb.full_name
           ) as j,
           case when p_status = 'marked' then -extract(epoch from coalesce(aa.marked_at, aa.updated_at))
                else extract(epoch from a.submitted_at) end as sort_at
      from public.attempt_answers aa
      join public.exam_attempts a on a.id = aa.attempt_id and a.status <> 'in_progress'
      join public.questions q on q.id = aa.question_id and q.type = 'written'
      join public.lessons l on l.id = a.lesson_id
      join public.subjects s on s.id = l.subject_id
      join public.profiles p on p.id = a.student_id
      left join public.exam_settings es on es.lesson_id = a.lesson_id
      left join public.profiles mb on mb.id = aa.marked_by
     where cardinality(aa.image_paths) > 0
       and public.teaches_subject(s.id)
       and (p_lesson_id is null or a.lesson_id = p_lesson_id)
       and case when p_status = 'marked' then aa.marking_status in ('ai', 'teacher')
                else aa.marking_status = 'pending_teacher' end
     order by sort_at
     limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ) x;
  return v;
end $$;

-- Number of answers waiting for the caller (for the menu badge).
create or replace function public.marking_pending_count()
returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int
    from public.attempt_answers aa
    join public.exam_attempts a on a.id = aa.attempt_id and a.status <> 'in_progress'
    join public.lessons l on l.id = a.lesson_id
   where aa.marking_status = 'pending_teacher' and public.is_staff() and public.teaches_subject(l.subject_id)
$$;

-- -------------------------------------------------------- mark_answer ----
create or replace function public.mark_answer(p_answer_id uuid, p_marks numeric, p_feedback text default null, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  aa public.attempt_answers;
  a public.exam_attempts;
  v_type public.question_type;
  v_max numeric;
  v_score numeric;
begin
  select * into aa from public.attempt_answers where id = p_answer_id for update;
  if not found then raise exception 'answer not found' using errcode = 'P0002'; end if;
  select * into a from public.exam_attempts where id = aa.attempt_id for update;
  if not (public.is_staff() and public.teaches_lesson(a.lesson_id)) then
    raise exception 'not allowed to mark this answer' using errcode = '42501', hint = 'marking.error.notAllowed';
  end if;
  if a.status = 'in_progress' then
    raise exception 'exam is still running' using errcode = '22023', hint = 'marking.error.running';
  end if;
  select q.type into v_type from public.questions q where q.id = aa.question_id;
  if v_type <> 'written' or cardinality(aa.image_paths) = 0 then
    raise exception 'only written answers with photos are marked by hand' using errcode = '22023', hint = 'marking.error.notWritten';
  end if;
  v_max := public.answer_max_marks(p_answer_id);
  if p_marks is null or p_marks < 0 or p_marks > v_max or (p_marks * 2) <> trunc(p_marks * 2) then
    raise exception 'marks must be between 0 and %, in steps of 0.5', v_max using errcode = '22023', hint = 'marking.error.marks';
  end if;

  insert into public.mark_changes (answer_id, changed_by, old_marks, new_marks, reason)
  values (aa.id, auth.uid(), aa.marks_awarded, p_marks, nullif(btrim(coalesce(p_reason, '')), ''));

  update public.attempt_answers
     set marks_awarded    = p_marks,
         is_correct       = (p_marks >= v_max),
         marking_status   = 'teacher',
         teacher_feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
         marked_by        = auth.uid(),
         marked_at        = now()
   where id = aa.id;

  update public.exam_attempts x
     set score = (select coalesce(sum(y.marks_awarded), 0) from public.attempt_answers y where y.attempt_id = x.id)
   where x.id = a.id
  returning x.score into v_score;

  return jsonb_build_object('answer_id', aa.id, 'marks', p_marks, 'max', v_max, 'attempt_score', v_score);
end $$;

-- ------------------------------------------------------------ reports ----
-- A student's own results: one row per lesson they took an exam in.
create or replace function public.my_report()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(r.j order by r.subject_bn, r.sequence), '[]'::jsonb) from (
    select s.name_bn as subject_bn, l.sequence,
           jsonb_build_object(
             'lesson_id',     l.id,
             'subject_id',    s.id,
             'lesson_title',  l.title,
             'sequence',      l.sequence,
             'subject_bn',    s.name_bn,
             'subject_en',    s.name_en,
             'attempts',      count(*),
             'best_score',    max(a.score),
             'best_max',      (array_agg(a.max_score order by a.score desc nulls last))[1],
             'best_percent',  max(case when a.max_score > 0 then round(100 * a.score / a.max_score) end),
             'last_at',       max(a.submitted_at),
             'last_attempt',  (array_agg(a.id order by a.submitted_at desc))[1],
             'pending',       bool_or(exists (select 1 from public.attempt_answers aa
                                               where aa.attempt_id = a.id and aa.marking_status = 'pending_teacher'))
           ) as j
      from public.exam_attempts a
      join public.lessons l on l.id = a.lesson_id
      join public.subjects s on s.id = l.subject_id
     where a.student_id = auth.uid() and a.status <> 'in_progress'
     group by l.id, s.id
  ) r
$$;

-- Staff: per lesson of the subjects they teach (admin: all, or one subject).
create or replace function public.results_overview(p_subject_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not public.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(x.j order by x.class_id, x.subject_bn, x.sequence), '[]'::jsonb) into v from (
    select s.class_id, s.name_bn as subject_bn, l.sequence,
           jsonb_build_object(
             'lesson_id',    l.id,
             'subject_id',   s.id,
             'lesson_title', l.title,
             'sequence',     l.sequence,
             'subject_bn',   s.name_bn,
             'subject_en',   s.name_en,
             'class_id',     s.class_id,
             'version',      s.version,
             'students',     (select count(distinct a.student_id) from public.exam_attempts a where a.lesson_id = l.id and a.status <> 'in_progress'),
             'attempts',     (select count(*) from public.exam_attempts a where a.lesson_id = l.id and a.status <> 'in_progress'),
             'avg_best_percent', (
               select round(avg(b.pct)) from (
                 select max(case when a.max_score > 0 then 100 * a.score / a.max_score end) as pct
                   from public.exam_attempts a
                  where a.lesson_id = l.id and a.status <> 'in_progress'
                  group by a.student_id) b),
             'pending',      (select count(*) from public.attempt_answers aa
                                join public.exam_attempts a on a.id = aa.attempt_id
                               where a.lesson_id = l.id and aa.marking_status = 'pending_teacher')
           ) as j
      from public.lessons l
      join public.subjects s on s.id = l.subject_id
     where public.teaches_subject(s.id)
       and (p_subject_id is null or s.id = p_subject_id)
       and exists (select 1 from public.exam_attempts a where a.lesson_id = l.id and a.status <> 'in_progress')
  ) x;
  return v;
end $$;

-- Staff: every student who took this lesson's exam, best score first.
create or replace function public.lesson_results(p_lesson_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not (public.is_staff() and public.teaches_lesson(p_lesson_id)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(x.j order by x.pct desc nulls last, x.name), '[]'::jsonb) into v from (
    select max(case when a.max_score > 0 then 100 * a.score / a.max_score end) as pct, p.full_name as name,
           jsonb_build_object(
             'student_id',   p.id,
             'student_name', p.full_name,
             'student_code', p.student_code,
             'attempts',     count(*),
             'best_score',   max(a.score),
             'best_max',     (array_agg(a.max_score order by a.score desc nulls last))[1],
             'best_percent', round(max(case when a.max_score > 0 then 100 * a.score / a.max_score end)),
             'best_attempt', (array_agg(a.id order by a.score desc nulls last, a.submitted_at))[1],
             'last_at',      max(a.submitted_at),
             'pending',      bool_or(exists (select 1 from public.attempt_answers aa
                                              where aa.attempt_id = a.id and aa.marking_status = 'pending_teacher'))
           ) as j
      from public.exam_attempts a
      join public.profiles p on p.id = a.student_id
     where a.lesson_id = p_lesson_id and a.status <> 'in_progress'
     group by p.id
  ) x;
  return v;
end $$;

-- ------------------------------------------------- exam_attempt_view ----
-- Same as before; the feedback shown is now the teacher's when there is one.
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
           'feedback',       case when v_done then coalesce(aa.teacher_feedback, aa.ai_feedback) end,
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

-- ------------------------------------------------------------- grants ----
revoke all on function public.answer_max_marks(uuid) from public, anon, authenticated;
revoke all on function public.marking_queue(text, uuid, integer) from public, anon;
revoke all on function public.marking_pending_count() from public, anon;
revoke all on function public.mark_answer(uuid, numeric, text, text) from public, anon;
revoke all on function public.my_report() from public, anon;
revoke all on function public.results_overview(uuid) from public, anon;
revoke all on function public.lesson_results(uuid) from public, anon;
revoke all on function public.exam_attempt_view(uuid) from public, anon;

grant execute on function public.answer_max_marks(uuid) to service_role;
grant execute on function public.marking_queue(text, uuid, integer) to authenticated, service_role;
grant execute on function public.marking_pending_count() to authenticated, service_role;
grant execute on function public.mark_answer(uuid, numeric, text, text) to authenticated, service_role;
grant execute on function public.my_report() to authenticated, service_role;
grant execute on function public.results_overview(uuid) to authenticated, service_role;
grant execute on function public.lesson_results(uuid) to authenticated, service_role;
grant execute on function public.exam_attempt_view(uuid) to authenticated, service_role;
