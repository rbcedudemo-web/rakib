# Supabase backend (stage D1 onward)

- `migrations/` — SQL migrations for the 21+ demo tables, Row Level Security policies and seed data (D1).
- `functions/` — Edge Functions: AI question bank (D3), written-answer marking (D5), AI Tutor (D6).

Secrets (Anthropic API key, service role key) are set by Rakib in the Supabase
dashboard under **Edge Functions → Secrets**. They are never committed and never
sent to the web or Android app.
