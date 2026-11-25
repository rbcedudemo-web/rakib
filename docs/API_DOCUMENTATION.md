# API Documentation

The web and Android apps talk to Supabase directly (PostgREST + RLS) with the publishable
key and the user's session. Privileged steps run on the server.

## Auth
| Flow | Where | Notes |
| --- | --- | --- |
| Student / teacher demo OTP | `apps/web/src/app/login/actions.ts` (server action) | Bangladesh number normalised to `8801XXXXXXXXX`; code `DEMO_OTP_CODE` (default 123456); 5 wrong codes per number per 10 min; new numbers become students; session created with the service key via `generateLink` + `verifyOtp`. Swap for a real SMS gateway later. |
| Admin | `/admin/login` server action | email + password; non-admins are signed out |
| Logout | `POST /logout` | |

## RPC (Postgres functions, called with `supabase.rpc`)
| Name | Args | Returns |
| --- | --- | --- |
| `enroll_student` | `p_full_name text, p_class_id smallint, p_version version_code, p_group group_code?` | profile row |
| `subject_lessons` | `p_subject_id uuid` | `id, sequence, title, chapter_id, duration_seconds, watched_percent, is_completed, is_unlocked` |
| `record_lesson_progress` | `p_lesson_id uuid, p_watched_seconds int` | progress row |
| `move_lesson` | `p_lesson_id uuid, p_direction int` (-1 up, 1 down) | void; staff of the subject only |
| `exam_status` | `p_lesson_id uuid` | jsonb: settings, questions in the bank, attempts used/limit today, best score, running attempt id, last 10 attempts |
| `start_exam` | `p_lesson_id uuid` | jsonb attempt view; resumes a running attempt; errors with hint `exam.error.dailyLimit` / `exam.error.noQuestions` |
| `exam_attempt_view` | `p_attempt_id uuid` | jsonb: questions with options in the shuffled order; after submission also `correct`, `is_correct`, marks, explanation, model answer; closes an attempt whose time is over |
| `save_exam_answer` | `p_attempt_id, p_question_id, p_selected int?` (shown position), `p_images text[]?` (`answer-sheets/<student>/<attempt>/…`) | void; hint `exam.error.timeUp` after the deadline (+30 s grace) |
| `submit_exam` | `p_attempt_id uuid` | jsonb attempt view with corrections; MCQs marked, written with photos set to `pending_teacher` |

## Admin server actions (D2, `apps/web/src/app/admin/(panel)/lessons/actions.ts`)
| Action | What it does |
| --- | --- |
| `saveLesson({ id, isNew, input, files })` | Validates with `validateLesson` (shared), creates a chapter if asked, inserts/updates the lesson (new lessons go last), upserts `exam_settings`. Files are uploaded by the browser first; only the lesson's own paths are accepted. New transcript/note resets status to `draft` for D3. |
| `moveLesson(id, -1 \| 1)` | Calls `move_lesson` RPC. |
| `setLessonPublished(id, bool)` | Publishing needs a video and its length. |
| `deleteLesson(id)` | Deletes the lesson (cascade) and its storage files. |
| `setSubjectActive(id, bool)` | Shows/hides a subject for students. |

Storage paths: `lesson-media/<lesson id>/note.pdf`, `lesson-media/<lesson id>/video.mp4`,
`lesson-private/<lesson id>/transcript.txt`.

## Question bank server actions (D3, `apps/web/src/app/admin/(panel)/lessons/[id]/questions/actions.ts`)
| Action | What it does |
| --- | --- |
| `generateQuestions(lessonId)` | Admin only. Sets status `generating`, sends transcript + note PDF to Claude (`claude-opus-5-5`, structured JSON output, `fallbacks: "default"`), cleans the answer with `cleanGeneratedQuestions`, replaces old AI questions (unused deleted, used switched off), sets `ready` / `failed`, logs tokens and cost in `ai_usage_log`. Page `maxDuration` 300 s. Needs `ANTHROPIC_API_KEY`. |
| `saveQuestion(input)` | Add or edit one question (checked with `cleanQuestion`). |
| `setQuestionActive`, `deleteQuestion` | A question already used in an exam is switched off instead of deleted. |

## Student exam server actions (D4, `apps/web/src/app/learn/[subjectId]/[lessonId]/exam/actions.ts`)
`startExam`, `saveAnswer`, `submitExam` wrap the RPCs above and turn the hint into a text key.

## Planned
`mark-written-answer` (D5), `tutor-chat` (D6).
