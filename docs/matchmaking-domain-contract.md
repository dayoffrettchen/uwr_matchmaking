# Matchmaking domain contract

This document records the intended underwater-rugby matchmaking behavior as a contract for tests and for the next implementation PR. It does **not** claim that the current optimizer already satisfies every rule.

## Intended active lineup

A complete active team has six players. Whenever the roster and player eligibility make it feasible, each of the two teams must have exactly two active goalkeepers, two active defenders, and two active forwards. This is the authoritative 2/2/2 active lineup.

## Independent rotation slots

Each of those six active places is an independent rotation slot. A populated slot has exactly one starter. Any additional players in that slot are substitutes for that slot only, and the slot has a deterministic member order using positive, unique `rotationOrder` values. Rotation groups must not use one group with two simultaneous starters as a substitute for two independent slots.

## Starter and substitute semantics

The first member of a populated slot starts in the water unless a future domain API explicitly exposes another deterministic starter. The remaining members are substitutes. A player may not be the starter in more than one slot, and every assigned player belongs to exactly one final slot.

For slot sizes one through five, the intended rotation is a deterministic closed cycle through the slot members. A one-player slot emits no rotation steps. Larger slots emit transitions from each member to the next member and back to the starter.

## Feasible and best-effort results

A fully feasible roster can satisfy the complete 2/2/2 active lineup for both teams. An infeasible roster must still assign every signup exactly once when a legal assignment exists, must not invent eligibility, and must not silently claim a complete 2/2/2 lineup. The future domain result should expose machine-readable violations such as `MISSING_POSITION_SLOT`, `NO_ELIGIBLE_POSITION`, `UNBALANCED_TEAM_SIZE`, `ACTIVE_PLAYER_LIMIT_EXCEEDED`, and `INCOMPLETE_ROTATION_SLOT` rather than requiring tests or callers to parse German warning text.

## Scoring alignment

The optimizer must score the same final slot structure that is returned by the domain API, displayed by `components/teams-panel.tsx`, and persisted through the training team route. Team effective strength, position strength, starting-lineup strength, substitute balance, rotation spread, and target-lineup penalties should all be calculated from that final independent-slot model.

## Current implementation notes

The current target-lineup helper prefers a legacy 1 goalkeeper, 2 defenders, and 3 forwards model. Candidate fitness is calculated in `lib/matchmaking/fitness.ts` by completing draft assignments through the intermediate rotation-group model. `lib/matchmaking/balance-teams.ts` later finalizes the result into the displayed and persisted slot model. Existing tests now keep that behavior as characterization while TODO tests define the future 2/2/2 acceptance criteria.

## What this PR tests now

The contract tests add reusable deterministic roster fixtures and assertions for currently enforceable invariants: every signup is assigned exactly once, team sizes differ by at most one, assigned positions are eligible, active players do not exceed six per team, populated final slots have exactly one starter, rotation cycles are deterministic, input order is normalized, candidate limits are respected, and missing-position rosters remain best-effort without illegal assignments.

## TODO tests for the next PR

The TODO tests are expected to become active in `Unify matchmaking evaluation and output around final 2-2-2 slots`. That implementation PR should enable the 2/2/2 target-lineup contract, independent one-starter candidate evaluation, complete feasible twelve-player and fourteen-player slot behavior, deterministic thirty-player final slots, structured violation codes, and display/persistence alignment with the final slot model.
