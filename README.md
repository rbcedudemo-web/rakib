# সবার জন্য ডিজিটাল দূরশিক্ষণ — Ruposhi Bangla Television

Investor demo of the digital distance-learning platform (Class 6–12, Bangladesh).
Phase 1 scope: Web portal (student, teacher, admin) + Android app on one Supabase backend.

## Repository layout

| Path | What it holds |
| --- | --- |
| `apps/web` | Next.js web portal: public site, student, teacher and admin areas |
| `apps/mobile` | Android app (Expo), from stage D7 |
| `packages/shared` | Design tokens, Bangla/English text, academic rules, menus — shared by web and app |
| `supabase` | Database migrations, security policies, Edge Functions (AI) |
| `docs` | Project documents (requirements, architecture, progress, decisions, tests) |

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000  (design preview at /design)
npm test           # unit tests
npm run typecheck
npm run build
```

Node 20 or newer. The plan this work follows is the Demo Build Guideline
(stages D0–D8); see `docs/DEVELOPMENT_ROADMAP.md`.
