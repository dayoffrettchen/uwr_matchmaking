# UWR Matchmaking — Repository Contract

## Project purpose

This application manages underwater-rugby training signup, team assignment, rotations, matches, and player ratings for a UWR club.

## Authoritative matchmaking rule

- A complete active team has six players.
- Whenever feasible, the active lineup consists of:
  - two goalkeepers,
  - two defenders,
  - two forwards.
- Each of those six active places is an independent rotation slot.
- Each populated rotation slot has exactly one starter.
- Additional players assigned to a position are substitutes in one of its two slots.
- Every signup appears exactly once.
- Players may only be assigned eligible positions.
- Team sizes differ by at most one.
- Identical normalized input and seed must produce deterministic results.
- The optimizer must score the same final lineup structure that is displayed and persisted.
- Hard invariants must not be silently weakened.

## Repository rules

- Do not run or add production schema mutation during ordinary requests.
- Database schema changes require versioned migrations.
- Do not commit secrets, credentials, exported personal data, or real environment files.
- Keep server-only code out of client bundles.
- Prefer pure functions for matchmaking and rating calculations.
- Avoid broad `any`, unsafe casts, and ignored errors.
- Do not modify unrelated files in focused pull requests.
- Preserve German and English behavior unless the task explicitly changes localization.
- Do not update dependencies unrelated to the task.

## Required validation commands

Run these before opening or updating a pull request:

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm test`
5. `pnpm build`
6. `pnpm check`

`pnpm test:coverage` is required when test infrastructure or coverage behavior changes.

## Local environment assumptions

- Use the package manager identified by the committed `pnpm-lock.yaml`: pnpm.
- Use a current Node.js version compatible with Next.js 16 and Vitest; CI uses Node.js 24.
- Production builds may import modules that read environment variables. Local builds should provide harmless development values for `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, and `ORGANIZER_EMAILS` when the surrounding environment does not already provide them.
- Never use real production credentials for local validation or CI.
