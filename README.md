# Zamane

Mobile-first PWA for couples — shared trips, finances, and goals in one
place. Signup pairs two people into a group (create an invite code or join
a partner's); everything from there on is scoped to that pair. Vite + React
+ Tailwind v4 on the frontend, Vercel-style serverless functions talking to
Neon Postgres on the backend, with fully custom email/password
authentication.

Design tokens, fonts, and the animated brand gradient are ported verbatim
from the sibling `Design System for Zamane App` project — that project stays
the source of truth for visual design; this repo is the real app.

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Create a free project at [console.neon.tech](https://console.neon.tech),
   then run `db/schema.sql` once against it (Neon's SQL editor, or
   `node --env-file=.env scripts/apply-schema.mjs` after step 3).
3. Copy `.env.example` to `.env` and fill in `DATABASE_URL` with your Neon
   connection string. `RESEND_API_KEY` is optional — without it, the
   forgot-password flow logs the reset link to the server console and
   returns it in the API response (dev only).
4. Start the app:
   ```
   npm run dev
   ```
   This runs a small local server (`scripts/dev-server.mjs`) that serves the
   Vite frontend and emulates Vercel's request/response contract for the
   `/api/*.ts` functions, so local development doesn't require a Vercel
   account. The `/api` files themselves are plain Vercel serverless
   functions and deploy to Vercel unchanged.

   If you do have a Vercel account and want the real CLI emulation instead
   (e.g. to test Vercel-specific config), set `VERCEL_TOKEN` and run
   `npm run dev:vercel`.

## Auth model

Custom email/password auth against three Neon tables (`db/schema.sql`):
`users`, `sessions`, and `password_reset_tokens`. Sessions and reset tokens
are stored as SHA-256 hashes, never the raw value; passwords are hashed with
bcrypt. See `api/auth/*.ts` for the six endpoints (signup, login, logout,
forgot-password, reset-password, session) and `api/_lib/auth.ts` for the
shared cookie/session/hashing logic.

## Regenerating PWA icons

`public/icons/*.png` are generated from `scripts/icon-source.html` (a
font-free SVG mark, screenshotted via Playwright since no image
rasterization library is installed):

```
npm run generate-icons
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server (frontend + `/api`, no Vercel account needed) |
| `npm run dev:vercel` | Local dev via the real Vercel CLI (needs `vercel login` or `VERCEL_TOKEN`) |
| `npm run build` | Typecheck + production build (also generates the service worker) |
| `npm run preview` | Preview the production build |
| `npm run lint` | Oxlint |
