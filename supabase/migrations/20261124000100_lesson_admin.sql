-- =============================================================================
-- D2 - Admin "Video Upload": move a lesson up or down in its subject's list.
-- Runs as the caller, so the normal lesson update policy (subject staff)
-- still decides who may do it. The (subject_id, sequence) unique constraint
-- is deferrable, which lets two lessons swap places in one step.
-- =============================================================================

create or replace function public.move_lesson(p_lesson_id uuid, p_direction integer)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_subject   uuid;
  v_sequence  integer;
  v_other     uuid;
  v_other_seq integer;
begin
  select l.subject_id, l.sequence into v_subject, v_sequence
  from public.lessons l where l.id = p_lesson_id;
  if not found then
    raise exception 'lesson not found' using errcode = 'P0002';
  end if;

  if p_direction < 0 then
    select l.id, l.sequence into v_other, v_other_seq from public.lessons l
    where l.subject_id = v_subject and l.sequence < v_sequence
    order by l.sequence desc limit 1;
  else
    select l.id, l.sequence into v_other, v_other_seq from public.lessons l
    where l.subject_id = v_subject and l.sequence > v_sequence
    order by l.sequence asc limit 1;
  end if;
  if v_other is null then
    return;  -- already first or last
  end if;

  set constraints all deferred;
  update public.lessons set sequence = v_other_seq where id = p_lesson_id;
  if not found then
    raise exception 'not allowed to change this lesson' using errcode = '42501';
  end if;
  update public.lessons set sequence = v_sequence where id = v_other;
end $$;

revoke all on function public.move_lesson(uuid, integer) from public, anon;
grant execute on function public.move_lesson(uuid, integer) to authenticated, service_role;
