# UWR Matchmaking — Project Rules

Project rules for v0. Follow these conventions for every change in this repo.

## What this app is

A web app for an **Unterwasserrugby (UWR / underwater rugby)** club. Players sign
up for the next training by writing "bin da" (or similar) in WhatsApp, and an
organizer randomly splits everyone into two teams. The UI language is **German**.

## Stack

- **Next.js 16** (App Router) + React 19, TypeScript.
- **Neon Postgres** accessed through **Drizzle ORM** (`drizzle-orm/node-postgres` + `pg` Pool).
- **Neon Auth** (managed Better Auth) with **Google OAuth** in shared mode.
- **Tailwind CSS v4** + shadcn/ui components.
- Icons: `lucide-react`. Never use emojis as icons.

## Auth & roles

- Auth is **managed Neon Auth**, configured in `lib/auth/server.ts`. Google OAuth is
  enabled in the Neon dashboard (shared mode) — **do not** add Google client
  credentials or any other provider unless explicitly asked.
- The client lives in `lib/auth/client.ts` and needs an **absolute** base URL
  (built from `window.location.origin`), not a relative path.
- Roles are **not** stored in the DB. They are derived from the `ORGANIZER_EMAILS`
  env var (comma-separated allowlist). Anyone whose email is on it is an
  `organizer`; every other signed-in user is a `viewer`.
- Always read the session via `getSessionUser()` from `lib/auth/server.ts`.
- Guard every **mutating** server action with `requireOrganizer()`. Viewers get
  read-only UI — hide organizer controls behind a `canManage` prop.

## Middleware

- `middleware.ts` protects all routes and **must run on the Node.js runtime**
  (`runtime: "nodejs"`) because the auth module uses Node's `crypto`.
- The matcher must keep `api/auth`, `api/whatsapp`, and `sign-in` public.
  **Never** put the WhatsApp webhook behind auth — Meta calls it unauthenticated.

## Database

- Schema is in `lib/db/schema.ts`; the Drizzle client is `db` from `lib/db`.
- Tables: `trainings`, `players`, `signups`, `messages`. Column names are snake_case
  in SQL, camelCase in Drizzle.
- Apply DDL/schema changes through the **Neon MCP** (one statement per call) before
  writing code that depends on them. Drizzle Kit migrations are not used here.
- App tables have no foreign keys by design — don't add them unless asked.
- Never use an ORM other than Drizzle, and never use `@neondatabase/serverless`
  or `@vercel/postgres` to reach Neon.

## Signup logic

- Shared logic lives in `lib/signup.ts` (`signUpPlayer`, `isPresentMessage`,
  `getOpenTraining`, `logMessage`). Both the WhatsApp webhook and the in-app
  forms must go through `signUpPlayer` — don't duplicate signup logic.
- "Present" phrases are matched by `PRESENT_PATTERNS` (e.g. "bin da", "dabei",
  "komme", "+1"). Extend that array rather than scattering new checks.

## Environment variables

Required (all already set in this project):

- `DATABASE_URL` — Neon connection string (auto-provisioned).
- `NEON_AUTH_BASE_URL` — managed Neon Auth server URL.
- `NEON_AUTH_COOKIE_SECRET` — cookie signing secret. `lib/auth/server.ts` hashes
  short values to 64 hex chars, so any value works, but prefer a 32+ char random one.
- `ORGANIZER_EMAILS` — comma-separated organizer email allowlist.

WhatsApp Cloud API (optional, only needed for real WhatsApp group integration):
`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`.

## Conventions

- UI copy is **German**.
- Build components, not one giant file. The dashboard composes `roster-panel`,
  `teams-panel`, `message-feed`, and `user-menu`.
- Use semantic Tailwind design tokens (`bg-background`, `text-foreground`, etc.),
  never hard-coded colors. The theme is an aquatic teal palette in `app/globals.css`.
- Data fetching happens in Server Components / server actions — do not fetch in
  `useEffect`.
