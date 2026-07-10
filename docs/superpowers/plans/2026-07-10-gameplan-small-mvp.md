# Dungeonslop — Small GAMEPLAN MVP Implementation Plan

**Date:** 2026-07-10  
**Source of truth:** `GAMEPLAN.md`, supplemented by `docs/superpowers/specs/2026-07-04-dungeonslop-v0-design.md`  
**Goal:** Deliver a compact, browser-based co-op ship-management game that feels like the GAMEPLAN: friends operate one failing ship, coordinate under real-time pressure, and make shared decisions between encounters.

**Implementation status:** Phase 0, the Phase 1 reactor-power slice, and the starter Pulse Laser portion of Phase 2 are complete and source-verified on 2026-07-10. The second weapon and additional target effects remain in Phase 2.

## Product boundary

This is intentionally a smaller version of the GAMEPLAN, not an attempt to recreate every FTL system.

### First playable run

- 2–4 players in one shared ship.
- One fixed six-room layout: bridge, engineering, shields, weapons, oxygen, and medbay.
- One crew member per player, with Pilot, Engineer, Gunner, and Medic roles.
- A single short sector: three to four encounters followed by a boss.
- A 20–30 minute run target.
- Real-time encounters; no unlimited pause.
- Shared hull, limited reactor power, system damage, oxygen, fire, breaches, and one simple boarder type.
- Route, event, and upgrade votes between encounters.

### Explicitly deferred

- Hacking, drones, teleporter boarding, cloaking, mind control, and artillery.
- Custom or movable rooms, multiple player ships, PvP, traitors, and personal scoring.
- Accounts, persistence, matchmaking, progression, mobile controls, gamepads, and voice chat.
- Detailed enemy-crew simulation, large narrative-event pools, and authored 3D assets.

## Implementation rules

- Keep the server authoritative: the frontend renders snapshots and sends intentions, but never resolves damage, timing, or vote outcomes.
- Keep simulation rules and deterministic tests in `backend/shared`; keep Colyseus lifecycle and timers in `backend/server`.
- Keep the ship readable at a glance. Every active emergency must be visually obvious without opening a modal.
- Build and tune one complete playable loop before adding more systems or content.
- Preserve the existing in-progress ship, hazards, networking, and UI work. Extend it rather than restarting the prototype.

## Current foundation

The repository already contains much of the needed base:

- Colyseus lobby, room codes, names, roles, ready state, and session-to-crew ownership.
- A top-down fixed ship with six rooms, doors, crew, fires, breaches, oxygen, boarders, voting, upgrades, and sector state.
- Fixed server ticks and pure shared simulation helpers.
- Frontend state adaptation, movement, contextual interactions, voting, combat feedback, and audio hooks.

The next implementation should concentrate on making the core co-op choices obvious and meaningful: **reactor power allocation, weapon timing/targeting, visible system status, and cascading emergencies**.

## Phase 0 — Establish the playable baseline

**Purpose:** ensure the current prototype is safe to extend and identify unfinished state-contract work before changing gameplay.

- [x] Run `cd backend && bun test && bun run typecheck`.
- [x] Run `cd frontend && bun test && bun run build`.
- [x] Record the current user-visible flow: lobby, vote, encounter, victory/defeat.
- [x] List every state field projected through `backend/server/src/schema.ts` and consumed by `frontend/src/net/schemaAdapter.ts`.
- [ ] Add a short fixture or deterministic test for one active encounter state with a fire, breach, damaged system, and charging enemy weapon.

**Exit:** the current multiplayer path is reproducible, and contract gaps are known before feature work begins.

## Phase 1 — Make reactor power a real shared decision

**Purpose:** create the Engineer/Weapons coordination loop at the center of the GAMEPLAN.

### Shared simulation

- [x] Add validated power-allocation commands to `backend/shared/src/types.ts`.
- [x] Implement allocation and rejection rules in `backend/shared/src/ship.ts`:
  - total active allocation cannot exceed reactor capacity;
  - damaged system bars reduce maximum usable power;
  - reactor, shields, weapons, oxygen, and helm have clear powered/unpowered behavior;
  - changing allocation is immediate but server-authoritative.
- [x] Require a crew member to operate Engineering before they can reroute power globally.
- [x] Ensure system destruction depowers the affected system; repaired bars become available for allocation again.
- [x] Add pure tests for over-allocation, damaged-system buffering, and depowering.

### Server and network contract

- [x] Parse and validate the new command in `backend/server/src/rooms/DungeonRoom.ts`.
- [x] Verify allocation state is already projected through `backend/server/src/schema.ts` and `backend/server/src/snapshot.ts`.
- [x] Extend the frontend command contract in `frontend/src/net/useDungeonRoom.ts`.

### Frontend presentation

- [x] Add a compact command-deck panel to `frontend/src/game/ShipScreen.tsx`.
- [x] Show reactor capacity, allocated power, and each system’s health, power, and operator.
- [x] Show power controls only while the local crew member operates Engineering.
- [x] Give all players read-only visibility of the allocation so they can coordinate verbally.

**Exit:** an Engineer can trade Oxygen or Weapons power for Shields or Helm during an incoming volley, and every player can see the consequence.

## Phase 2 — Make the Weapons station an active cooperative task

**Purpose:** replace passive automatic damage with readable charge, target, and volley decisions.

- [x] Add the starter Pulse Laser to shared state with charge, target, and firing intent.
- [ ] Add a second heavier weapon or missile.
- [x] Require a powered, functional Weapons system; a Gunner operating it charges the Pulse Laser faster.
- [x] Add target selection for the displayed enemy ship: Shields, Weapons, Helm, or Core.
- [x] Resolve shield absorption, hull damage, and target-specific weapon disruption only in `backend/shared/src/ship.ts`.
- [x] Preserve the existing Called Shot ability as a separate, visible special volley.
- [x] Add deterministic tests for operator ownership, power interruption, charge, shield stripping, target selection, and enemy defeat.
- [x] Update `ShipScreen.tsx` with the enemy cutaway target controls, weapon charge panel, fire readiness, and existing outgoing-volley feedback.

**Exit:** players can call “give Weapons two power,” wait for a coordinated salvo, strip shields, and damage a selected enemy system.

## Phase 3 — Turn the ship view into a crisis-management interface

**Purpose:** make the game look and read like the GAMEPLAN’s shared, failing machine.

- [x] Keep the top-down cutaway in `frontend/src/game/ShipScreen.tsx` as the main play surface.
- [x] Add a prioritized alert stack for hull danger, fire, breach, low oxygen, damaged systems, boarders, and incoming enemy fire.
- [x] Add per-room system health bars, power indicators, operator identity, oxygen state, and hazard badges.
- [x] Make low oxygen, fire, breach, locked doors, and destroyed rooms distinguishable by color, icon, text label, and animation.
- [x] Add a clear enemy panel: hull, shields, weapon charge, selected target, and imminent-volley warning.
- [x] Preserve the local player’s contextual actions, but make the currently most useful action prominent.
- [ ] Verify keyboard movement, focus states, reduced motion, and a standard desktop layout before styling for smaller screens.

**Exit:** a player can identify the next urgent problem, the crew member who should handle it, and the system that needs power within a glance.

## Phase 4 — Finish the first cascading emergency loop

**Purpose:** prove that the game creates recoverable co-op panic instead of isolated chores.

- [ ] Tune fire so it consumes oxygen, hurts nearby crew, damages rooms/systems, and can spread through open doors.
- [ ] Tune breaches so they drain oxygen, require a repair action, and create a meaningful choice between sealing and venting.
- [ ] Keep door operation simple: local opening for adjacent interior doors; bridge control for locks and hull vents.
- [ ] Keep one boarder behavior only: enter, move toward a useful system, fight crew in-room, and sabotage when uncontested.
- [ ] Make incapacitation and revive windows visible and recoverable.
- [ ] Add one scripted encounter where an enemy volley creates both a fire and a breach while Weapons are charging.
- [ ] Add audio and visual cues for new fire, breach, oxygen warning, weapon ready, incoming volley, crew incapacity, and encounter resolution.

**Exit:** a playtest group must choose between holding stations, saving a crew member, fighting a boarder, repairing a breach, and preparing the next volley.

## Phase 5 — Add a short co-op run around combat

**Purpose:** give the encounters a shared objective and enough variety to replay the core loop.

- [ ] Restrict the initial campaign to one short sector, three to four nodes, and a final boss.
- [ ] Retain only a small encounter pool: two or three enemy profiles, one environmental emergency, one trader, and one authored event.
- [ ] Use shared scrap for one repair-or-upgrade decision after each encounter.
- [ ] Start with four upgrades that alter coordination: Backup Battery, Blast Doors, Medbay Foam, and Jury-Rigged Turret.
- [ ] Keep one sector Slop condition with a visible behavioral effect; use `Hot Reactor Summer` first because it reinforces emergency management.
- [ ] Keep majority voting and rotating captain tie breaks, with a visible timer and each player’s vote.
- [ ] End the run with victory/defeat plus a concise incident recap from server event history.

**Exit:** a party can complete a 20–30 minute run without developer intervention and remembers at least one self-inflicted disaster.

## Phase 6 — Multiplayer and fun-check verification

**Purpose:** validate the thing the GAMEPLAN is actually trying to create: coordination among friends.

- [ ] Test two, three, and four clients in the same room.
- [ ] Test ownership rejection: no player can move another player’s crew or reroute power without being at Engineering.
- [ ] Test reconnect/leave behavior and clear disconnected-seat feedback.
- [ ] Playtest the scripted crisis with a group using voice chat.
- [ ] Collect whether players naturally split duties, call out danger, disagree over a shared decision, recover from a cascade, and want another run.
- [ ] Tune only the bottlenecks found in that test before adding deferred systems.

**Exit:** four friends can complete the short run and the core loop generates communication without a designated game master.

## Suggested implementation order

1. Phase 0 baseline and contract audit.
2. Phase 1 reactor allocation, including UI readout and controls.
3. Phase 2 weapon charge, target selection, and volley resolution.
4. Phase 3 crisis interface and clearer room/system presentation.
5. Phase 4 scripted cascading emergency and tuning.
6. Phase 5 short sector, upgrades, and final boss.
7. Phase 6 multi-client fun-check and iteration.

Do not begin deferred systems until a group has played the complete short run.

## Verification commands

```sh
cd backend && bun test && bun run typecheck
cd frontend && bun test && bun run build
git diff --check
```
