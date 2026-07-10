# Dungeonslop v0 — Frontend Replacement Plan

**Revised:** 2026-07-10
**Source of truth:** `docs/superpowers/specs/2026-07-04-dungeonslop-v0-design.md`
**Goal:** Replace the isometric tactical board and card hand with a readable multiplayer ship interface where each player controls one character during real-time emergencies.

## Constraints

- Work only under `frontend/` for this plan.
- Use Bun for installs and scripts.
- Preserve reusable lobby/network/rendering utilities where they fit the new contract.
- Remove grid targeting, tactical turns, ability-card hand UI, dungeon monsters, and class models once their replacements land.
- The frontend interpolates and presents authoritative state; it never decides damage, repairs, votes, or encounter results.
- Prioritize readability and responsiveness over detailed art.
- Keep current unrelated visual worktree edits intact until migration reaches their files; review rather than blindly overwrite them.

## F0 — Establish the replacement boundary

- [ ] Record the current passing baseline with the package's existing test, typecheck, lint, and build scripts.
- [ ] Add a temporary `ship` feature boundary with its own state adapter and route/screen.
- [ ] Inventory reusable pieces: lobby form, Colyseus connection lifecycle, camera setup, health bars, primitive models, and CSS tokens.
- [ ] Mark tactical screens and card-hand code for deletion; do not extend them.
- [ ] Add fixtures matching the new backend `RunState` contract.

**Exit:** the app can render a placeholder ship screen from a fixture without modifying the old prototype path further.

## F1 — Top-down ship and crew control

- [ ] Render the single cutaway ship layout with rooms, doors, stations, and room labels.
- [ ] Render crew using distinct colors, names, roles, health, and incapacitated state.
- [ ] Implement click-to-move or WASD movement through the frontend command layer.
- [ ] Highlight the local player's crew and nearby valid interactions.
- [ ] Add contextual interact, carry/drop, attack, and revive controls.
- [ ] Interpolate crew movement between server snapshots without predicting rule outcomes.
- [ ] Add fixture-driven tests for state adaptation and interaction-command payloads.

**Exit:** each browser clearly controls one character and can traverse/operate the fixture ship.

## F2 — Ship systems and emergencies

- [ ] Visualize station health, powered state, operator, and repair progress.
- [ ] Add HUD elements for hull, shields, reactor capacity/allocation, encounter objective, and enemy charge threats.
- [ ] Visualize room oxygen, fire, breaches, sealed doors, and low-oxygen danger.
- [ ] Add strong audio/visual cues for hull hits, new fire, breach, oxygen warning, weapon ready, and incapacitation.
- [ ] Add role ability control with cooldown and clear unavailable reasons.
- [ ] Ensure overlapping emergencies remain readable at the default camera framing.

**Exit:** a player can glance at the screen and identify the most urgent ship problems and their own useful actions.

## F3 — Enemy and encounter presentation

- [ ] Add a compact enemy-ship panel showing hull, shields, visible systems, and charging weapons.
- [ ] Support gunner targeting and ability commands without simulating hits locally.
- [ ] Render boarders inside player rooms with target/attack feedback.
- [ ] Add encounter intro, current objective, success, reward, and defeat transitions.
- [ ] Add an environmental-emergency presentation that does not require an enemy ship.

**Exit:** combat and non-combat emergencies are understandable without exposing internal simulation data.

## F4 — Map, events, votes, and upgrades

- [ ] Render a branching sector map with reachable destinations and encounter-type hints.
- [ ] Add a shared voting overlay with options, player votes, countdown, and resolved result.
- [ ] Support rotating captain identity and a tie-break prompt only for the captain.
- [ ] Render authored events with role-specific information visible only to the appropriate local player.
- [ ] Add trader/repair/upgrade screens showing shared scrap and irreversible consequences.
- [ ] Reveal the sector Slop effect prominently and keep a compact reminder during play.

**Exit:** a group can navigate and make every shared decision without developer controls.

## F5 — Lobby and live networking

- [ ] Change class selection to Pilot, Engineer, Gunner, and Medic role selection.
- [ ] Indicate uncovered roles without preventing duplicate choices.
- [ ] Adapt the Colyseus client to the replacement commands and snapshots.
- [ ] Associate the local session with exactly one crew member.
- [ ] Surface command rejection briefly without rolling back authoritative state.
- [ ] Implement reconnecting, disconnected-seat indication, and grace-period messaging.
- [ ] Remove the fixture driver from production flow after live integration works.

**Exit:** 2–4 separate browsers can join by code, start, control their crew simultaneously, and vote.

## F6 — Delete tactical UI and polish the fun-check

- [ ] Delete obsolete board-grid, turn, card-hand, Knight/Wizard, and dungeon-monster UI and tests.
- [ ] Remove copied frontend engine rules; frontend imports contract types only and sends commands.
- [ ] Add onboarding prompts for movement, station operation, repair, hazards, and voting.
- [ ] Add victory/defeat recap highlighting major incidents available from server event history.
- [ ] Check 2-, 3-, and 4-player layouts at common desktop sizes.
- [ ] Verify keyboard focus, reduced motion, color-independent hazard cues, and readable text contrast.
- [ ] Run all existing frontend tests and type checks.
- [ ] Run `cd frontend && bun run build`.

**Exit:** no discarded tactical experience remains in the shipped bundle, and the multiplayer fun-check is playable end to end.

## Suggested fun-check sequence

1. Four players join and select roles.
2. The crew votes on a node.
3. An enemy volley causes a fire and oxygen breach while weapons are charging.
4. One player is incapacitated and revived.
5. The crew wins, argues over repair versus upgrade, and votes.
6. A sector Slop effect changes station behavior.
7. The shortened run ends in a final encounter and recap.

## Out of scope for this plan

Mobile UI, gamepads, voice chat, accounts, progression, multiple ship layouts, cinematic 3D assets, PvP, and individual leaderboards.
