# Database Schema (D1)

Postgres on Supabase. Source: `supabase/migrations/`. One file to paste into the SQL Editor:
`supabase/deploy/setup.sql` (regenerate with `npm run db:bundle`). Security tests: `npm run db:test`.

## Tables (22)

| Area | Table | Holds | Key rules |
| --- | --- | --- | --- |
| People | `profiles` | role, name, phone, email, student ID, class, group, version, active flag, enrolment time | 1:1 with `auth.users`; created by trigger; enrolled student must have class + version, and a group exactly from class 9 |
| People | `teacher_subjects` | teacher ↔ subject, `can_upload` | PK (teacher, subject) |
| Academic | `classes` | 6–12 | id = class level |
| Academic | `groups` | science / commerce / arts | |
| Academic | `versions` | bangla / english_version / english_medium / madrasa | |
| Academic | `subjects` | class, version, group (null = every group), code, BN/EN names | unique (class, version, code) |
| Academic | `chapters` | subject chapters | |
| Lessons | `lessons` | subject, chapter, `sequence`, title, video link or file, duration, transcript path, note PDF path, status, published | unique (subject, sequence); published lesson needs a video |
| Lessons | `lesson_progress` | watched seconds and %, completed time | PK (student, lesson); written only by `record_lesson_progress()` |
| Exams | `exam_settings` | per lesson: MCQ count, written count, minutes, marks (default 10 / 2 / 15) | |
| Exams | `questions` | bank: type, prompt, options, correct index, explanation, model answer, rubric, marks, difficulty, source | MCQ shape and written shape checks |
| Exams | `exam_attempts` | student, lesson, Dhaka date, attempt no., question ids, shuffled orders, start, server deadline, status, score | unique (student, lesson, date, attempt no.) |
| Exams | `attempt_answers` | selected option, up to 4 answer-sheet images, marks, AI feedback, marking status | unique (attempt, question) |
| Exams | `mark_changes` | teacher overrides: who, when, old, new, reason | |
| Tutor | `tutor_conversations`, `tutor_messages` | chats, messages, attachments | |
| System | `ai_usage_log` | AI task, tokens, cost | admin only |
| System | `settings` | key/value: attempts per day 3, unlock 50%, tutor limit 30, defaults | |
| UI only | `packages`, `subscriptions`, `live_classes` | sample prices, demo memberships, schedule | no payment |
| Content | `notices` | Notice menu | |

`versions` and `groups` replace the guideline's separate lesson-level version: a lesson takes
its version from its subject, so the two can never disagree.

## Functions
| Function | Who | Does |
| --- | --- | --- |
| `enroll_student(name, class, version, group)` | student, once | validates the group rule, sets the student ID `RB<yy>-<000001>` |
| `subject_lessons(subject)` | student / staff | ordered list with progress and `is_unlocked` |
| `lesson_is_unlocked(lesson)` | any | lesson 1 always; next when the previous is completed; staff: all |
| `record_lesson_progress(lesson, seconds)` | student | progress only grows; completed at `unlock_percent` (50) |
| `is_admin()`, `is_staff()`, `teaches_subject()`, `student_can_see_subject()`, `has_paid_service()` | RLS helpers | |
| `handle_new_user()` trigger | Auth | creates the profile; role only from `app_metadata` |
| `guard_profile_update()` trigger | profiles | only admins change role, class, group, version, phone, ID, status |

## Row Level Security (all 22 tables)
- Student: own profile, progress, attempts, answers, chats, memberships; published lessons of
  subjects matching class + version + group; **never** the question bank.
- Teacher: assigned subjects' lessons (drafts too), question banks, attempts; students of those classes.
- Admin: everything. Visitors: classes, subjects, packages, live schedule, notices only.

## Storage buckets
`lesson-media` (notes, small videos; lesson viewers), `lesson-private` (transcripts; staff),
`answer-sheets` (student's own folder; staff read), `avatars` (public read, owner write).

## Backup
Supabase free plan has no point-in-time recovery. Before the investor demo, a manual
`pg_dump`-style export from the dashboard (Database → Backups) is recommended.
