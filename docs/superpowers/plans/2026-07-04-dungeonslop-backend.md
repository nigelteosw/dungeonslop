# Dungeonslop v0 — Backend Replacement Plan

**Revised:** 2026-07-10
**Source of truth:** `docs/superpowers/specs/2026-07-04-dungeonslop-v0-design.md`
**Goal:** Replace the turn-based tactical engine with an authoritative, deterministic ship simulation and multiplayer run service.

## Constraints

- Work only under `backend/` for this plan.
- Use Bun for installs, scripts, tests, and runtime.
- Preserve the existing Colyseus room-code/lobby foundation where useful.
- Replace obsolete grid, cards, monsters, equipment, and tactical-turn code; do not maintain compatibility with the discarded prototype.
- Keep rules pure in `backend/shared`; keep sockets, timers, and sessions in `backend/server`.
- Use a fixed simulation step and injected seeded RNG.
- Commit boundaries below are recommendations, not authorization to commit automatically.

## Target state model

```ts
interface RunState {
  seed: string;
  status: 'lobby' | 'mapVote' | 'eventVote' | 'encounter' | 'upgradeVote' | 'victory' | 'defeat';
  tick: number;
  sectorIndex: number;
  nodeId?: string;
  captainSeat: number;
  ship: ShipState;
  crew: Record<string, CrewState>;
  boarders: Record<string, BoarderState>;
  enemy?: EnemyState;
  map?: SectorMap;
  vote?: VoteState;
  objective?: ObjectiveState;
  slopEffectId?: string;
}
```

Ship topology is room-and-door based. Positions are room IDs, optionally with normalized local coordinates for rendering. Rules must not depend on Three.js.

## B0 — Remove the discarded game contract

- [ ] Record the current passing baseline with `cd backend && bun test && bun run typecheck`.
- [ ] Delete tactical-only shared modules and tests: board geometry, card combat, monster tactics, turn queue, dungeon rooms, upgrades/equipment, and their content.
- [ ] Replace tactical `GameState`, phases, and intent types with the ship-run state model.
- [ ] Retain generic seeded RNG and validation helpers where still useful.
- [ ] Update package exports so no deleted tactical API remains public.
- [ ] Make `bun test` and `bun run typecheck` pass with the minimal replacement contract.

**Exit:** backend compiles with no grid/card/turn API and exposes the new serializable types.

## B1 — Pure ship topology and crew actions

- [ ] Define one validated ship layout containing rooms, doors, stations, and spawn points.
- [ ] Implement room graph helpers: adjacency, open/locked doors, shortest path, and reachable rooms.
- [ ] Implement crew creation, movement commands, station interaction, item carry/drop, and role cooldown state.
- [ ] Enforce one owner per crew member in the session layer.
- [ ] Test invalid paths, locked doors, occupied interactions, cooldowns, and ownership rejection.

**Exit:** several crew can move through the same deterministic ship and operate stations concurrently.

## B2 — Fixed-tick ship simulation

- [ ] Add a pure `stepSimulation(state, commands, rng)` function.
- [ ] Implement hull, reactor power, system health, shields, and per-room oxygen.
- [ ] Implement fire ignition/spread/extinguish and breach oxygen loss/sealing.
- [ ] Implement crew damage, incapacitation, revive window, and run defeat.
- [ ] Implement role passives and abilities from the spec.
- [ ] Define ordering rules for simultaneous commands and document them in tests.
- [ ] Add deterministic replay tests: same seed and command stream produce identical state.

**Exit:** a scripted cascading emergency can be simulated without Colyseus or real time.

## B3 — Encounters and lightweight enemies

- [ ] Define validated enemy profiles with hull, shields, weapon timers, targeting weights, rewards, and boarder triggers.
- [ ] Implement weapon charging, target selection, shield absorption, system damage, and enemy defeat.
- [ ] Implement boarder room-path pursuit, nearby attacks, sabotage, and defeat.
- [ ] Implement encounter objectives and completion/reward transitions.
- [ ] Add three combat profiles and one environmental-emergency profile.
- [ ] Test that enemy behavior remains deterministic and cannot command player crew.

**Exit:** a complete real-time encounter can end in reward or run defeat without complex tactical AI.

## B4 — Sector generation and events

- [ ] Generate a seeded three-sector branching map with valid start-to-exit paths.
- [ ] Define node types: combat, emergency, trader, event, and final encounter.
- [ ] Add an authored-event schema supporting choices, role-specific information, costs, outcomes, and prerequisites.
- [ ] Implement sector Slop selection without repeats in the same run.
- [ ] Add at least four meaningful Slop effects and six events for the fun-check.
- [ ] Test map reachability, event validation, resource bounds, and run completion.

**Exit:** a seed produces a replayable run skeleton from lobby to final encounter.

## B5 — Voting and economy

- [ ] Implement timed votes for map nodes, events, repairs/purchases, and upgrades.
- [ ] Allow changing a vote until expiry; abstention must not block resolution.
- [ ] Implement majority resolution and rotating-captain tie breaks.
- [ ] Rotate captain after every resolved node and when a Slop rule explicitly requires it.
- [ ] Implement shared scrap, repair packages, and a small validated upgrade pool.
- [ ] Reject votes from spectators, expired seats, or invalid options.
- [ ] Test majority, ties, disconnects, captain rotation, and insufficient scrap.

**Exit:** all irreversible shared decisions resolve without an admin manually advancing the run.

## B6 — Authoritative Colyseus integration

- [ ] Refactor `GameSession` around `RunState` and lobby roles.
- [ ] Run the simulation from a fixed-rate server clock; never accept client-provided timestamps or outcomes.
- [ ] Queue and validate commands between ticks.
- [ ] Project authoritative state into a Colyseus schema or stable serialized snapshot.
- [ ] Preserve room codes, join, ready, host start, leave, and reconnect grace behavior.
- [ ] Add protocol-level error messages suitable for temporary frontend feedback.
- [ ] Add integration tests for two clients joining, moving concurrently, resolving an encounter, voting, and advancing.

**Exit:** headless clients can complete a shortened multiplayer run through the real room protocol.

## B7 — Content and operational verification

- [ ] Tune tick rate, hazard rates, repair speed, charge times, and encounter length for 2–4 players.
- [ ] Validate all content at process startup.
- [ ] Add structured logs for room lifecycle, rejected commands, vote resolution, encounter result, and tick overruns.
- [ ] Ensure an abandoned room stops its simulation timer.
- [ ] Run `cd backend && bun test`.
- [ ] Run `cd backend && bun run typecheck`.
- [ ] Run the existing server start script briefly and verify it listens without retaining a live process.

**Exit:** backend supports the v0 fun-check and has no dependency on the discarded tactical game.

## Out of scope for this plan

Persistence, accounts, matchmaking, multiple ship layouts, sophisticated enemy crew simulation, traitors, individual scoring, and production deployment automation.
