# Project Progress

## 24 Nov 2026 — D2 Admin: lessons and Video Upload
Done
- Admin area with its own menu (dashboard, Video Upload & Lessons, Subjects; later pages listed as coming).
- Video Upload form: class → version → subject, chapter (pick or create), title, description,
  YouTube link (Unlisted) or small MP4, video length filled in automatically from the player,
  transcript (type, paste, or .txt/.srt/.vtt converted to plain text), note PDF, exam settings
  (MCQ, written, minutes, marks; defaults from Settings), publish switch.
- Files go straight from the browser to Supabase Storage under `<lesson id>/…` (no size limit from
  the website host); transcripts stay in the private bucket for staff and the AI only.
- Lesson list per subject with file checklist, status, move up/down, publish/hide, two-step delete.
- Subjects page with lesson counts and on/off switch.
- Database: `move_lesson` function (swap order safely); 6 new security checks (50 in total).
- Live site fix: explicit API grants (PR #3) after the hosted project refused table access.

Pending
- Rakib runs `supabase/migrations/20261124000100_lesson_admin.sql` once in the SQL Editor (adds `move_lesson`).
- Rakib uploads one sample lesson to check the whole flow on the live site.


## 23 Nov 2026 — D1 Database and Login
Done
- 22 tables with keys, checks and indexes; 3 migrations; seed with classes, groups, versions,
  96 class 9–10 subjects, settings, sample packages, notice and live schedule.
- Row Level Security on every table and storage bucket; 42 automated security checks pass.
- Enrolment function with student ID; ordered lesson unlocking at 50% watched (database side).
- Demo OTP login (mobile + 123456), admin email login, logout, route protection.
- First-login enrolment form (class, group from class 9, version).
- Header shows the signed-in user; student home with own subjects, progress bars and locked
  Live / SSC–HSC buttons; teacher and admin home pages with live database counts.

Pending
- Rakib runs `supabase/deploy/setup.sql` in the SQL Editor and creates his admin user.
- End-to-end login against the real project needs the site online (secret key in hosting settings).


## 23 Nov 2026 — D0 Preparation
Done
- Monorepo created (`apps/web`, `apps/mobile` placeholder, `packages/shared`, `supabase`, `docs`).
- Design tokens (colours, font, radii, touch size) shared by web and app; `/design` preview page.
- Sticky header with the approved menu order, Live Classes sub-menu, search box, EN | বাংলা
  toggle, Login button, and student/teacher profile dropdowns; mobile ☰ menu.
- Public home page in Bangla and English; placeholder "coming soon" pages for every menu.
- Shared rules: class levels, versions, groups, group needed from class 9, SSC/HSC mapping.
- CI on GitHub Actions: tests, typecheck, build.

Pending
- Supabase account from Rakib (needed for D1).
- Sample lesson files (D2), answer-sheet photos (D5), terms and contact text.

Next: D1 Database and Login.
