# System Architecture — Phase 1 demo

```
Web portal (Next.js)  ─┐
Admin (same web app)  ─┼──>  Supabase: Postgres + Auth + Storage + Edge Functions ──> Anthropic API
Android app (Expo)    ─┘            (one database, one account per student)
```

- **One backend, one database, one account** for web and Android (project rule §3–4).
- AI calls run only inside Supabase Edge Functions; API keys never reach the browser or app.
- Videos: YouTube Unlisted links (Supabase free plan: 1 GB storage, 50 MB per file).

## Stack (approved with the guideline)
| Layer | Choice | Why |
| --- | --- | --- |
| Web | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 3 | Free hosting on Vercel, SEO-friendly public pages, large developer pool |
| Android | Expo (React Native) | Same language as web, shares `packages/shared`, free APK builds |
| Backend / DB | Supabase (Postgres, Auth, Storage, Edge Functions, RLS) | Free plan, relational DB, row-level security for minors' data |
| AI | Anthropic Claude API | Question generation, written-answer marking, tutor |
| Hosting | Vercel Hobby | Free; publish only with Rakib's approval |

## Repository
npm workspaces monorepo: `apps/web`, `apps/mobile`, `packages/shared`, `supabase`, `docs`.

## Design system (D0)
- Tokens in `packages/shared/src/theme.ts`, used by Tailwind (web) and later by the app.
- Primary: Bangladesh flag green `#006a4e`; accent: flag red `#c8202b` (Live badge, alerts only);
  highlight amber; slate-green neutrals.
- Font: Hind Siliguri (Bangla + Latin in one family), self-hosted via `@fontsource`, so pages
  work without Google Fonts. Body line height 1.65 for Bangla script.
- Touch targets at least 44 px; mobile header collapses menus behind ☰.
- Language: `lang` cookie (`bn` default, `en`), texts in `packages/shared/src/i18n.ts`; a unit
  test keeps both languages complete. Lesson video and notes do not change with the toggle.
- Live preview page: `/design`.
