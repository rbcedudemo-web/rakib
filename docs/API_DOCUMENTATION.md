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

## Planned
Edge Functions: `generate-question-bank` (D3), `mark-written-answer` (D5), `tutor-chat` (D6);
exam RPCs `start_exam`, `save_answer`, `submit_exam` (D4).
