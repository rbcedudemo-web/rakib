# Supabase backend

- `migrations/` — schema, Row Level Security, storage buckets (applied in order).
- `seed.sql` — classes, groups, versions, subjects, settings, sample UI-only data. Re-runnable.
- `deploy/setup.sql` — migrations + seed in one file (`npm run db:bundle`).
- `tests/` — `npm run db:test` starts a throwaway Postgres in Docker and runs the security tests.
- `functions/` — Edge Functions for AI (from D3).

## Setting up the real project (Rakib, once)
1. Supabase → **SQL Editor** → **New query**. Paste all of `deploy/setup.sql`, press **Run**.
2. **Authentication → Users → Add user → Create new user**: your email and a strong password,
   tick **Auto Confirm User**.
3. SQL Editor again, run (with your email):
   `update public.profiles set role = 'admin', full_name = 'Rakib' where email = 'you@example.com';`

Secrets (Secret key, Anthropic key) are entered by Rakib in the hosting / Supabase settings,
never committed and never sent in chat.
