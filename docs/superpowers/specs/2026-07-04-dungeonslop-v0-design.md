# Dungeonslop v0 — Design

**Status:** in review (design revised for 3D + card system)
**Date:** 2026-07-04
**Goal:** A genuinely playable online co-op tactical dungeon run that 2–4 friends can play together ASAP, with a fantasy/D&D identity: a 3D XCOM-style board and Slay-the-Spire ability cards. Fun over content. Keep everything not on the critical path lean.

---

## 1. Product summary

Dungeonslop is a browser-based co-op tactical dungeon crawler with a fantasy/D&D theme (knights, wizards, dungeons). Friends open a link, join a room by code, pick a class, and clear a 3-room dungeon together on an **16×16 grid rendered as a 3D board seen from a fixed XCOM-style 45° isometric camera**.

Combat is a deliberate hybrid:
- **XCOM tactics** for positioning — grid movement, obstacles, line up your party.
- **Slay-the-Spire cards** for actions — each class's attacks and abilities are a **hand of cards** you draw and play, gated by **energy**.

Between rooms, a **Slop Card** injects a run-wide twist — this chaos is the game's identity. Players grow stronger via post-room **upgrade** picks and **equipment** that drops from monsters.

A run is a single session. When the room closes, the run is gone. That is acceptable for v0.

## 2. Scope (v0)

**In:**
- 2–4 player online co-op, room-code join
- 2 classes: **Knight** (melee) and **Wizard** (ranged/support)
- Per-class **ability-card decks** (a small starter deck each; cards are data)
- 5 monster types
- 3 rooms: easy → elite → boss
- 15 slop cards (event cards, presented Slay-the-Spire style)
- 20 upgrades
- 15 equipment items (weapon / armor / trinket slots)
- **3D isometric board** (react-three-fiber), fixed 45° camera, **simple low-poly models built in code** (knight, wizard, monsters, walls) — no external art
- Slay-the-Spire card-hand UI (2D overlay) driving grid-targeted abilities
- Lobby: create/join room, pick name, pick class, ready up

**Explicitly out (deferred, not scaffolded):**
- **Postgres / any persistence.** Runs live in the Colyseus room's memory and die with it. Needed only for saved history/accounts/leaderboards — none of which v0 requires.
- Hand-authored art assets. v0 uses procedural/primitive low-poly models and can swap in `.glb` files later.
- Discord bot, external "chaos agent"
- Accounts / login / auth

**Scope honesty:** the card engine and the 3D renderer make v0 bigger than a flat-grid slice. That is a deliberate trade for the game's identity. Everything *else* stays lean — no persistence, placeholder models, minimal content to reach the first fun-check.

## 3. Architecture

One repository, workspace with three packages:

```
dungeonslop/
  client/    Vite + React + react-three-fiber → 3D board + card UI, sends intents
  server/    Colyseus + Node + TypeScript      → authoritative game state + turn engine
  shared/    TypeScript + Zod                   → types, schemas, PURE game-logic functions
```

**Core discipline — logic vs. visuals separation (unchanged, and now paying off):**
- **All game rules live in `shared/` as pure, deterministic functions** (movement, card resolution, energy, draw/discard, monster AI, room-clear). Randomness (deck shuffles, loot) is injected as `rng: () => number` so tests are deterministic. Trivially unit-testable with no server or client.
- **The `server/` is the sole authority.** The Colyseus room holds authoritative state and mutates it only via `shared/` functions. Clients never decide outcomes.
- **The `client/` renders and sends intents only.** The 3D scene and card hand are *presentational*: a **driver** supplies `GameState` + action callbacks; the scene renders and emits tile/unit picks; the hand emits card plays. Swapping the driver (hotseat ↔ Colyseus) is the only change between single-device and multiplayer. **The render tech (r3f) is invisible to `shared`** — the board is just an 16×16 grid of data.

**Data flow:**
```
client intent ("play card C on target T" / "move unit A to (3,4)")
  → server room receives message
  → validates via shared logic (your turn? enough energy? legal target? already moved?)
  → mutates state via shared logic
  → Colyseus auto-syncs state to all clients
  → clients animate the change (3D move tween, card fly-out, hp change)
```

Illegal / out-of-turn / non-owner intents are rejected server-side and ignored.

## 4. Content is data

Classes, cards, monsters, upgrades, equipment, and slop cards are **plain typed data** in `shared/content/`, validated by Zod at load time. Adding content later is editing a data file, not writing code.

- **Class:** `{ id, name, maxHp, moveRange, attack, maxEnergy, startingDeck: string[] }`
- **Card:** `{ id, name, cost, effect: 'damage'|'heal'|'block', shape: 'melee'|'ranged'|'line'|'self', power, range? }`
  - **effect** = what it does: `damage` (deal `attack + power`), `heal` (restore `power` to an ally), `block` (temporary shield of `power` on self).
  - **shape** = how you target it, resolved against the grid + obstacles:
    - `melee` — an adjacent enemy.
    - `ranged` — a single enemy within `range` tiles **with clear line of sight** (a hard obstacle between blocks it).
    - `line` — pick an orthogonal direction; the attack travels in a straight line up to `range`, **pierces enemies in its path, and stops at the first hard obstacle** (wall). (e.g. the "AK-47 Vulcan".)
    - `self` — no target (block/buff on the caster).
  - **Tone:** cards can be absurd — modern/joke weapons in a fantasy dungeon are on-theme for *slop*. Flavor lives entirely in card data.
  - **Extensible by design:** `shape` is data, resolved by a single `cardTargets(state, unitId, cardId)` function + a `resolveCard` switch. Adding `blast`, `cone`, etc. later is new data + one branch — no structural change.
- **Monster:** `{ id, name, maxHp, moveRange, attack, lootTable }` (monsters use direct AI attacks, not cards)
- **Upgrade:** `{ id, name, description, effect }` (applied immediately on pick; effects include stat buffs and "add a card to your deck")
- **Equipment:** `{ id, name, slot: weapon|armor|trinket, effect }` (drops from monsters)
- **SlopCard:** `{ id, name, description, effect }` (run/room-wide modifier)

## 5. Combat & turn model

**Per player turn, the active unit has two resources:**
- **1 Move** — a grid movement action, up to `moveRange` tiles (XCOM). Once per turn, free of energy.
- **Energy** (e.g. 3) — spent to **play ability cards** from the hand (Slay the Spire).

**Turn flow (active player):** start of turn → refill energy, reset the move, **draw up to hand size (5)** from the deck (reshuffle discard into deck when empty, seeded rng) → the player moves (optional) and plays cards until out of energy/targets → **end turn** → the card hand goes to discard.

**Playing a card:** select the card, then pick a target tile on the grid. Legality is computed by `cardTargets(state, unitId, cardId)`, which returns the set of valid tiles for the card's `shape` (adjacency for `melee`; range + line-of-sight for `ranged`; the four orthogonal directions for `line`; none for `self`). `resolveCard` then applies the `effect`: `damage` deals `attack + power` to each affected enemy (a `line` card hits every enemy along its path until a wall stops it), `heal` restores `power` to an ally, `block` shields the caster. Playing a card pays its `cost` in energy and moves it hand→discard.

**Hard obstacles (walls)** block three things: movement, line-of-sight for `ranged` cards, and the path of `line` cards. Shared helpers `lineOfSight(state, from, to)` and `traceLine(state, from, dir, range)` encapsulate this so every card shape uses the same obstacle rules.

**Round structure — seat-order queue:** P1's turn, P2's turn, … then a **monster phase** where each monster runs simple AI (approach nearest player; attack if adjacent, using its `attack` stat directly — monsters have no cards). Then the next round begins. This avoids DnD initiative edge cases.

**Board:** 16×16 grid with walls/obstacles and an exit tile, rendered in 3D isometric. Interaction: click a tile to move there (if legal) or select a card then click a highlighted target.

**Scaled for the larger board:** movement and ranges are tuned for 16×16 so the space reads as tactical, not glacial — starting `moveRange` ≈ 4–5, ranged/line card `range` ≈ 6–9. Exact values are tuning done during authoring. Rooms place the party and monsters far enough apart that positioning and approach matter.

**Room clear:** all monsters defeated → exit opens → the party advances.

**Between rooms:** draw 1 **Slop Card** (run/room-wide modifier) → **upgrade chest** (pick 1 of 3). Equipment drops occur *during* fights from monster loot tables.

## 6. Rendering (3D isometric)

- **Tech:** `react-three-fiber` + `three` + `@react-three/drei`. An **orthographic camera** at a fixed isometric angle (~45° azimuth, ~35° elevation) for the XCOM "angled from above" look. No free camera in v0 (optional gentle rotate/zoom later).
- **Board:** 3D floor tiles (thin boxes) on an 16×16 grid; walls/obstacles are extruded cube blocks; the exit tile is a lit marker. Legal-move tiles and card targets are highlighted by tinting/emissive.
- **Characters — simple low-poly models built from Three.js primitives in code (no external assets):**
  - **Knight:** blocky armored torso, box limbs, a helm (box/cone), a small sword. Metallic-grey material, team-color trim.
  - **Wizard:** robed body (tapered cylinder/cone), pointed hat (cone), a staff. Robe in team color.
  - **Monsters:** Goblin (small green figure), Slime (squashed sphere), etc. — primitive-based.
  - Each model is a small reusable React component (`<KnightModel/>`, `<WizardModel/>`, …). Swapping in `.glb` art later is a component-internal change.
- **Card hand:** a 2D React/DOM overlay pinned to the bottom, Slay-the-Spire style — cards fan out, lift on hover, click (or drag) to select. Selecting a card highlights valid targets on the 3D board; clicking a target plays it.
- **Interaction:** pointer raycasting (r3f built-in) on tiles/units for move and target selection.
- **Presentational boundary:** the scene and hand receive `GameState` + callbacks only; all legality comes from the driver (which calls `shared` or the server).

## 7. Progression (two systems, kept simple)

- **Upgrades:** post-room chest, pick 1 of 3 from the 20-item pool. Applied immediately (stat buffs like +1 max HP / +1 attack / +1 move / +1 energy, or "add card X to your deck"). No inventory — picking = applied.
- **Equipment:** three slots (weapon / armor / trinket). Drops from monsters mid-fight into a simple inventory; players equip/swap. Each item carries a stat effect. UI is minimal (list + equip button), not a drag-and-drop paperdoll.

## 8. Lobby

Create room → short room code. Others join by code. Each player sets a name and picks Knight or Wizard, then marks ready. When all ready, host starts → everyone enters room 1.

## 9. Deployment

- **Backend** (Colyseus WS + Node) → **Railway**.
- **Frontend** (static Vite build) → **Cloudflare Pages**.
- Client reads the server URL from `VITE_SERVER_URL` (never hardcoded). Server configures CORS + allowed WS origin for the Cloudflare domain. Only cross-host concern; baked in from day one.

## 10. Testing strategy

- **`shared/` logic:** unit tests are the backbone — pure, fast, deterministic (seeded rng). Cover movement legality, card play (energy, targets, effects), draw/discard/reshuffle, upgrade/equipment effects, slop-card modifiers, monster AI, room-clear/defeat.
- **`server/`:** integration tests driving a Colyseus room through a scripted run (join → move → play card → clear → slop → upgrade → next room).
- **`client/`:** thin. A few tests for pure UI helpers (iso projection math, hand layout); real validation is playing with friends. The 3D scene is validated by eye.

## 11. Open items for the planning phase (not blockers)

- Exact energy / hand-size / starter-deck tuning per class.
- Whether upgrades that "add a card" need deck-preview UI in v0 (default: no, just apply).
- Upgrade pick: per-player choice vs. single party vote (the "Budget Cuts" slop card implies party voting exists).
- Reconnect behavior on drop (simplest v0 = seat stays, others continue).
