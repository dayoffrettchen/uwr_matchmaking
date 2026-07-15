# UWR Matchmaking

UWR Matchmaking is a Next.js application for an underwater-rugby club. It supports training signup, organizer-driven team generation, rotation slots, match result entry, player ratings, JSON data import/export, and optional WhatsApp integration.

The user-facing application copy is primarily German because the club workflow is German.

## Main user flows

- **Player signup:** players sign up for the next training in the app or through the optional WhatsApp webhook.
- **Organizer team generation:** organizers generate balanced teams from the current signup list.
- **Rotation slots:** each displayed team lineup includes position-based rotation groups for who starts in the water and who substitutes.
- **Match result entry:** organizers can record match results after play.
- **Player ratings:** the app tracks position-specific player ratings and confidence data.
- **Data import/export:** JSON import/export supports operational backups and data moves. Exports can contain personal data.
- **Optional WhatsApp integration:** Meta WhatsApp Cloud API webhooks can log messages and create signups from present messages such as “bin da”.

## Technology overview

- Next.js App Router
- React
- TypeScript
- PostgreSQL on Neon
- Drizzle ORM
- Neon Auth
- Tailwind CSS
- Vitest for unit tests

## Current business rule

The implemented complete active lineup is two goalkeepers, two defenders, and two forwards whenever feasible. The unified final-slot model uses independent one-starter rotation slots, calculates best-effort feasible targets for constrained rosters, and keeps the optimizer scoring aligned with the returned final slot model. Real Vitest and full ESLint remain unresolved infrastructure follow-ups; the current repository test and lint commands use fallback scripts. See [docs/matchmaking-domain-contract.md](docs/matchmaking-domain-contract.md) for the executable contract and characterization scope.

## Prerequisites

- Node.js compatible with Next.js 16 and Vitest; CI uses Node.js 24.
- pnpm, determined by the committed `pnpm-lock.yaml`.
- A Neon PostgreSQL database for real application use.
- Managed Neon Auth configuration for sign-in.

## Installation

```sh
pnpm install --frozen-lockfile
```

Use pnpm consistently. Do not replace the lockfile with npm or Yarn output.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Drizzle and `pg`. |
| `NEON_AUTH_BASE_URL` | Yes | Managed Neon Auth server URL. |
| `NEON_AUTH_COOKIE_SECRET` | Yes | Cookie signing secret for Neon Auth. |
| `ORGANIZER_EMAILS` | Yes | Comma-separated allowlist. Matching signed-in users are organizers; everyone else is a viewer. |
| `CRON_SECRET` | Optional | Protects the scheduled auto-team endpoint when configured. |
| `WHATSAPP_VERIFY_TOKEN` | Optional | Meta webhook verification token for WhatsApp Cloud API. |
| `WHATSAPP_ACCESS_TOKEN` | Optional | WhatsApp Cloud API access token for outbound API calls. |
| `WHATSAPP_PHONE_NUMBER_ID` | Optional | WhatsApp phone number ID for Cloud API calls. |

Do not commit real `.env` files, credentials, exported personal data, or production secrets.

## Local development

```sh
pnpm dev
```

## Validation commands

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm build
pnpm check
```

`pnpm check` runs the core validation sequence in this order: typecheck, lint, tests, and production build.

## Database setup status

The schema is defined in `lib/db/schema.ts` and accessed through Drizzle. Versioned migrations are not currently present in this repository. Some runtime schema setup behavior is legacy behavior and is scheduled for replacement by versioned migrations. Do not add production schema mutation during ordinary requests.

## Deployment notes

The app is intended to run on Vercel with Next.js. Configure all required environment variables in the deployment environment. CI uses harmless placeholder values for build-time imports and must not connect to the production database.

## Vercel cron

`vercel.json` configures the scheduled `/api/training/auto-teams` endpoint at `0 14,15 * * *`. Use `CRON_SECRET` when enabling the scheduled endpoint in a deployed environment.

## WhatsApp webhook overview

The WhatsApp route is public so Meta can call it without an application session. Configure the webhook URL in Meta, set `WHATSAPP_VERIFY_TOKEN` for verification, and provide `WHATSAPP_ACCESS_TOKEN` plus `WHATSAPP_PHONE_NUMBER_ID` only when real WhatsApp integration is needed.

## Security and personal data

JSON exports can contain personal data, including player names, signup records, match data, and messages. Treat exports as sensitive personal data and do not commit them.

## Architecture overview

- `app/` — Next.js App Router pages, layouts, and route handlers.
- `components/` — reusable UI components.
- `lib/auth/` — managed Neon Auth server and client helpers.
- `lib/db/` — Drizzle database client and schema definitions.
- `lib/matchmaking/` — team balancing and rotation logic.
- `lib/ratings/` — player rating types and calculations.
- `lib/signup.ts` — shared signup and message handling logic.
- `lib/**/__tests__/` — unit tests run by Vitest.

## Contribution workflow

- Start focused branches from the latest main branch when possible.
- Keep pull requests behavior-neutral unless the task explicitly changes product behavior.
- Run the required checks before review: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm check`.
- Do not modify unrelated files in focused pull requests.
- Do not update dependencies unrelated to the task.
- See `AGENTS.md` for the repository contract used by Codex and contributors.
