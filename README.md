# PokerFlow

Private Texas Hold’em for 2–8 friends. Virtual chips only.

## Local development

1. Install Node.js 22 and run `npm install`.
2. Copy `.env.example` to `.env.local` and configure the Supabase credentials.
3. Run the migration in `supabase/schema.sql` on your own Supabase project.
4. Run `npm run dev`.

Never commit the service role key. Production credentials belong in Vercel environment variables.

Production: https://pokerflow-theta.vercel.app

This is an initial prototype with polling, anonymous browser sessions, and server-side game logic. Complex poker scenarios and full multiplayer browser tests remain pending.
