-- =============================================================================
-- D1 · Core schema for the investor demo
-- Tables follow the Demo Build Guideline §9 (21 tables + notices), named as in
-- the full design so they carry over to the production platform.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- enums ----
create type public.user_role         as enum ('admin', 'teacher', 'student');
create type public.version_code      as enum ('bangla', 'english_version', 'english_medium', 'madrasa');
create type public.group_code        as enum ('science', 'commerce', 'arts');
create type public.lesson_status     as enum ('draft', 'generating', 'ready', 'failed');
create type public.question_type     as enum ('mcq', 'written');
create type public.difficulty_level  as enum ('easy', 'medium', 'hard');
create type public.question_source   as enum ('ai', 'teacher');
create type public.attempt_status    as enum ('in_progress', 'submitted', 'expired');
create type public.marking_status    as enum ('unanswered', 'auto', 'ai', 'pending_teacher', 'teacher');
create type public.paid_service      as enum ('live', 'ssc_prep', 'hsc_prep');
create type public.ai_task           as enum ('question_bank', 'marking', 'tutor');
create type public.chat_role         as enum ('user', 'assistant');

-- ------------------------------------------------------ shared trigger ----
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ------------------------------------------------- academic reference ----
create table public.classes (
  id       smallint primary key check (id between 6 and 12),   -- the class level itself
  name_bn  text not null,
  name_en  text not null
);

create table public.groups (
  code     public.group_code primary key,
  name_bn  text not null,
  name_en  text not null,
  sort     smallint not null default 0
);

create table public.versions (
  code     public.version_code primary key,
  name_bn  text not null,
  name_en  text not null,
  sort     smallint not null default 0
);

create table public.subjects (
  id          uuid primary key default gen_random_uuid(),
  class_id    smallint not null references public.classes(id),
  version     public.version_code not null references public.versions(code),
  group_code  public.group_code references public.groups(code),   -- null = compulsory, every group
  code        text not null,                                      -- e.g. 'bangla-1', 'math'
  name_bn     text not null,
  name_en     text not null,
  sort        smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (class_id, version, code)
);
create index subjects_lookup_idx on public.subjects (class_id, version, group_code) where is_active;
create trigger subjects_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();

create table public.chapters (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references public.subjects(id) on delete cascade,
  title       text not null,
  sort        smallint not null default 0,
  created_at  timestamptz not null default now()
);
create index chapters_subject_idx on public.chapters (subject_id, sort);

-- ------------------------------------------------------------- people ----
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          public.user_role not null default 'student',
  full_name     text,
  phone         text unique,                       -- 8801XXXXXXXXX, students and teachers
  email         text,                              -- admins
  student_code  text unique,                       -- e.g. RB26-000123, set at enrolment
  class_id      smallint references public.classes(id),
  group_code    public.group_code references public.groups(code),
  version       public.version_code references public.versions(code),
  avatar_url    text,
  is_active     boolean not null default true,
  enrolled_at   timestamptz,                       -- first-login form completed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- a student who has enrolled always has class + version; group exactly from class 9
  constraint student_enrolment_complete check (
    role <> 'student' or enrolled_at is null or (
      class_id is not null and version is not null and full_name is not null
      and ((class_id >= 9) = (group_code is not null))
    )
  )
);
create index profiles_role_idx on public.profiles (role);
create index profiles_class_idx on public.profiles (class_id, version, group_code) where role = 'student';
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create sequence public.student_code_seq;

create table public.teacher_subjects (
  teacher_id  uuid not null references public.profiles(id) on delete cascade,
  subject_id  uuid not null references public.subjects(id) on delete cascade,
  can_upload  boolean not null default false,       -- admin may let a teacher upload lessons
  primary key (teacher_id, subject_id)
);
create index teacher_subjects_subject_idx on public.teacher_subjects (subject_id);

-- ------------------------------------------------------------ lessons ----
create table public.lessons (
  id                uuid primary key default gen_random_uuid(),
  subject_id        uuid not null references public.subjects(id) on delete cascade,
  chapter_id        uuid references public.chapters(id) on delete set null,
  sequence          integer not null check (sequence > 0),   -- order in the left-hand lesson list
  title             text not null,
  description       text,
  video_url         text,              -- YouTube (Unlisted) link
  video_path        text,              -- or a small file in storage bucket lesson-media
  duration_seconds  integer check (duration_seconds is null or duration_seconds > 0),
  transcript_path   text,              -- storage: lesson-private
  note_pdf_path     text,              -- storage: lesson-media
  status            public.lesson_status not null default 'draft',
  is_published      boolean not null default false,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (subject_id, sequence) deferrable initially immediate,
  constraint lesson_has_video check (video_url is not null or video_path is not null or not is_published)
);
create index lessons_subject_idx on public.lessons (subject_id, sequence);
create trigger lessons_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();

create table public.lesson_progress (
  student_id       uuid not null references public.profiles(id) on delete cascade,
  lesson_id        uuid not null references public.lessons(id) on delete cascade,
  watched_seconds  integer not null default 0 check (watched_seconds >= 0),
  watched_percent  numeric(5,2) not null default 0 check (watched_percent between 0 and 100),
  completed_at     timestamptz,                    -- set once watched_percent reaches the unlock threshold
  updated_at       timestamptz not null default now(),
  primary key (student_id, lesson_id)
);
create index lesson_progress_lesson_idx on public.lesson_progress (lesson_id);
create trigger lesson_progress_updated_at before update on public.lesson_progress
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------- exams ----
create table public.exam_settings (
  lesson_id         uuid primary key references public.lessons(id) on delete cascade,
  mcq_count         smallint not null default 10 check (mcq_count between 0 and 50),
  written_count     smallint not null default 2  check (written_count between 0 and 10),
  duration_minutes  smallint not null default 15 check (duration_minutes between 1 and 180),
  mcq_marks         numeric(4,1) not null default 1 check (mcq_marks > 0),
  written_marks     numeric(4,1) not null default 5 check (written_marks > 0),
  updated_at        timestamptz not null default now(),
  check (mcq_count + written_count > 0)
);
create trigger exam_settings_updated_at before update on public.exam_settings
  for each row execute function public.set_updated_at();

create table public.questions (
  id             uuid primary key default gen_random_uuid(),
  lesson_id      uuid not null references public.lessons(id) on delete cascade,
  type           public.question_type not null,
  prompt         text not null,
  options        jsonb,             -- mcq: ["A", "B", "C", "D"]
  correct_index  smallint,          -- mcq: 0-based index into options
  explanation    text,              -- shown after submission
  model_answer   text,              -- written: ideal answer
  rubric         text,              -- written: how marks are given
  marks          numeric(4,1) not null default 1 check (marks > 0),
  difficulty     public.difficulty_level not null default 'medium',
  source         public.question_source not null default 'ai',
  is_active      boolean not null default true,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint mcq_shape check (
    type <> 'mcq' or (
      jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6
      and correct_index is not null and correct_index >= 0
      and correct_index < jsonb_array_length(options)
    )
  ),
  constraint written_shape check (type <> 'written' or model_answer is not null)
);
create index questions_lesson_idx on public.questions (lesson_id, type) where is_active;
create trigger questions_updated_at before update on public.questions
  for each row execute function public.set_updated_at();

create table public.exam_attempts (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  lesson_id      uuid not null references public.lessons(id) on delete cascade,
  attempt_date   date not null default (now() at time zone 'Asia/Dhaka')::date,  -- counter resets at Dhaka midnight
  attempt_no     smallint not null check (attempt_no between 1 and 20),
  question_ids   uuid[] not null,
  option_orders  jsonb not null default '{}'::jsonb,   -- per-question shuffled option order
  started_at     timestamptz not null default now(),
  deadline_at    timestamptz not null,                 -- timer is kept on the server
  submitted_at   timestamptz,
  status         public.attempt_status not null default 'in_progress',
  score          numeric(6,1),
  max_score      numeric(6,1) not null,
  unique (student_id, lesson_id, attempt_date, attempt_no),
  check (deadline_at > started_at)
);
create index exam_attempts_student_idx on public.exam_attempts (student_id, lesson_id, attempt_date);
create index exam_attempts_lesson_idx on public.exam_attempts (lesson_id, started_at desc);

create table public.attempt_answers (
  id               uuid primary key default gen_random_uuid(),
  attempt_id       uuid not null references public.exam_attempts(id) on delete cascade,
  question_id      uuid not null references public.questions(id) on delete restrict,
  selected_index   smallint,                       -- mcq, index in the ORIGINAL options order
  image_paths      text[] not null default '{}',   -- written: storage paths in answer-sheets (max 4)
  is_correct       boolean,
  marks_awarded    numeric(4,1),
  ai_feedback      text,
  marking_status   public.marking_status not null default 'unanswered',
  updated_at       timestamptz not null default now(),
  unique (attempt_id, question_id),
  check (cardinality(image_paths) <= 4)
);
create index attempt_answers_pending_idx on public.attempt_answers (marking_status)
  where marking_status = 'pending_teacher';
create trigger attempt_answers_updated_at before update on public.attempt_answers
  for each row execute function public.set_updated_at();

create table public.mark_changes (
  id          uuid primary key default gen_random_uuid(),
  answer_id   uuid not null references public.attempt_answers(id) on delete cascade,
  changed_by  uuid not null references public.profiles(id),
  old_marks   numeric(4,1),
  new_marks   numeric(4,1) not null,
  reason      text,
  changed_at  timestamptz not null default now()
);
create index mark_changes_answer_idx on public.mark_changes (answer_id);

-- -------------------------------------------------------------- tutor ----
create table public.tutor_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  lesson_id   uuid references public.lessons(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index tutor_conversations_user_idx on public.tutor_conversations (user_id, created_at desc);

create table public.tutor_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.tutor_conversations(id) on delete cascade,
  role             public.chat_role not null,
  content          text not null,
  attachments      jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);
create index tutor_messages_conversation_idx on public.tutor_messages (conversation_id, created_at);

-- ------------------------------------------------------------- system ----
create table public.ai_usage_log (
  id             bigint generated always as identity primary key,
  task           public.ai_task not null,
  user_id        uuid references public.profiles(id) on delete set null,
  lesson_id      uuid references public.lessons(id) on delete set null,
  model          text not null,
  input_tokens   integer not null default 0,
  output_tokens  integer not null default 0,
  cost_usd       numeric(10,6) not null default 0,
  created_at     timestamptz not null default now()
);
create index ai_usage_log_created_idx on public.ai_usage_log (created_at desc);

create table public.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------------------------------- UI-only in the demo (no real money) ----
create table public.packages (
  id           uuid primary key default gen_random_uuid(),
  service      public.paid_service not null,
  name_bn      text not null,
  name_en      text not null,
  price_bdt    integer not null check (price_bdt >= 0),
  period_days  smallint not null default 30 check (period_days > 0),
  is_active    boolean not null default true,
  sort         smallint not null default 0
);

create table public.subscriptions (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  service     public.paid_service not null,
  package_id  uuid references public.packages(id) on delete set null,
  starts_on   date not null default current_date,
  ends_on     date not null,
  is_demo     boolean not null default true,      -- demo: marked by admin, no payment taken
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index subscriptions_student_idx on public.subscriptions (student_id, service, ends_on);

create table public.live_classes (
  id                uuid primary key default gen_random_uuid(),
  kind              public.paid_service not null default 'live',
  class_id          smallint references public.classes(id),
  subject_id        uuid references public.subjects(id) on delete set null,
  teacher_id        uuid references public.profiles(id) on delete set null,
  title             text not null,
  starts_at         timestamptz not null,
  duration_minutes  smallint not null default 60 check (duration_minutes > 0),
  stream_url        text,
  created_at        timestamptz not null default now()
);
create index live_classes_starts_idx on public.live_classes (starts_at);

create table public.notices (
  id            uuid primary key default gen_random_uuid(),
  title_bn      text not null,
  title_en      text,
  body_bn       text not null,
  body_en       text,
  published_at  timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null
);
create index notices_published_idx on public.notices (published_at desc);
