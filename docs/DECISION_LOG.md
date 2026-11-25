# Decision Log

| Date | Decision | By |
| --- | --- | --- |
| 22 Nov 2026 | Phase 1 is an investor demo: web + Android, no iOS, free tools only | Rakib |
| 22 Nov 2026 | Live class and payment as UI only; no IPTV or LMS licence now | Rakib |
| 22 Nov 2026 | Demo content: Class 9–10 Bangla, Math, English; AI exams per lesson | Rakib |
| 23 Nov 2026 | Signup with class + version (+ group for 9–12); ordered lessons unlock at 50% watched; highest score counts | Rakib |
| 23 Nov 2026 | Demo Build Guideline approved; repository `rbcedudemo-web/rakib` (name kept) | Rakib |
| 23 Nov 2026 | Monorepo with npm workspaces; Next.js 15 + Tailwind 3 for web; shared TS package for tokens, text and rules | Claude (per guideline stack) |
| 23 Nov 2026 | Brand colours from the Bangladesh flag (green primary, red accent used sparingly); Hind Siliguri font, self-hosted | Claude (proposal, open to Rakib's change) |
| 23 Nov 2026 | Default language Bangla; choice kept in a cookie | Claude |
| 23 Nov 2026 | Lesson version comes from its subject (no separate column), so they cannot disagree | Claude |
| 23 Nov 2026 | Demo OTP issues sessions on the server through Supabase magic-link tokens; each phone user has an internal address that never receives mail | Claude |
| 23 Nov 2026 | New phone numbers always become students; teachers and admins are created by an admin | Claude |
| 23 Nov 2026 | Class 9–10 subject list beyond Bangla/English/Math follows NCTB SSC structure [Inferred]; English Medium and Madrasa get only the three demo subjects until the admin adds theirs | Claude |
| 23 Nov 2026 | Database setup is one SQL file pasted into the Supabase SQL Editor, so no database password leaves Rakib | Claude |
| 23 Nov 2026 | Hosting on Vercel Hobby (project rakib, https://rakib-azure.vercel.app); table/function grants to API roles are explicit in a migration instead of relying on project defaults | Claude |
| 25 Nov 2026 | AI question bank runs as a Next.js server action on Vercel (up to 300 s) instead of a Supabase Edge Function, so the API key lives in one place (Vercel) | Claude |
| 25 Nov 2026 | Questions made with `claude-opus-5-5` using JSON structured output, then checked again in code; refusal fallback on; about $0.30–0.60 per lesson | Claude |
| 25 Nov 2026 | Exam marks per question come from the lesson's exam settings; questions drawn at random and options shuffled per attempt; 30 s grace after the timer for slow networks | Claude |
| 25 Nov 2026 | Written answers are saved as photos and wait for marking until D5 (AI marking + teacher review) | Claude |
| 25 Nov 2026 | Rakib writes his own 30 MCQs per lesson; each attempt draws the exam's count at random from them. Bulk import: fixed-format Word/text is free (no AI); PDF import uses Claude Sonnet 5.5 because Bangla text in PDFs often cannot be read reliably without it | Rakib / Claude |
| 25 Nov 2026 | Android app is a native Expo shell around the student portal (same accounts and features); APK built by GitHub Actions. Built early, parked until after D5/D6 at Rakib's request | Rakib / Claude |
| 25 Nov 2026 | Order after exams (Rakib): teacher review + reports, then AI Tutor + AI marking, Android last | Rakib |
| 25 Nov 2026 | Teacher marks: 0 to the question's marks in steps of 0.5; teacher comment shown instead of an AI comment; changes logged in `mark_changes` | Claude |
