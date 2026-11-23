# Project Requirements — Phase 1 investor demo

Source of truth: the two project documents (IPTV Proposal, Master Project Profile), the
Software Requirement Extraction Report, and the **Demo Build Guideline** approved by Rakib on
23 Nov 2026 (https://claude.ai/artifact/SgBrCJFA5vyBkdK9GzKGJT). Tags: [Source] from the
documents or Rakib; [Proposed] Claude's proposal accepted with the guideline.

## Scope
- Platforms: web portal (student, teacher, admin) and Android app. No iOS in Phase 1. [Source]
- Classes 9 and 10; subjects Bangla, Mathematics, English. [Source]
- Free tools only; the only running cost is Anthropic API usage. [Source]
- UI only (no real integration): Live classes, SSC/HSC prep live, packages, payment. [Source]
- Out of the demo: IPTV, institution LMS, real SMS and payment APIs, DRM, iOS. [Source]
- All third-party accounts are in Rakib's name; keys are entered by Rakib, never in chat. [Source]

## Student
- Login by mobile number + OTP; demo uses a fixed demo code, no SMS. [Source / Proposed]
- First login form: name, class, version (Bangla Version / English Version / English Medium /
  Madrasa); classes 9–12 also group (Science / Business Studies / Humanities). [Source]
- Home shows only the student's own subjects; Live Class and SSC/HSC prep buttons are for paid
  members only (locked otherwise, opens the package page). [Source]
- Lesson page: ordered lesson list (left), video and note PDF (centre), exam and AI Tutor (right).
  Next lesson unlocks when 50% of the video is watched. [Source]
- Exam per lesson: MCQ + written (photo or file upload), per-lesson counts and time
  (default 10 MCQ, 2 written, 15 min), timer starts on open and auto-submits. [Source]
- 3 attempts per lesson per day, counter resets at midnight Asia/Dhaka; highest score counts. [Source]
- Instant result: score, right/wrong per question, correct answer and explanation. [Source]
- AI Tutor chat on the lesson page, accepts images and files. [Source]

## Teacher
- View and edit question banks of own subjects; review written answers and override AI marks
  (who, when, old and new mark logged). [Source]
- Uses the AI Tutor. [Source]

## Admin
- "Video Upload" page: class, subject, chapter, lesson, version, order, video link/file,
  transcript, note PDF, exam settings. AI builds a 30–40 question bank per lesson. [Source]
- Full dashboard with real database figures (13 pages listed in the guideline §8). [Source]

## Header (all pages)
Logo · Home · Live Classes (Live Classes, SSC/HSC Preparation) · Reports · Community (coming
soon) · Terms · Notice · Contact · search · EN | বাংলা · profile dropdown. [Source]

## Pending from Rakib
- One sample lesson (video link, transcript, note PDF) before D2.
- 5–10 real answer-sheet photos before D5.
- Terms text and contact details.
