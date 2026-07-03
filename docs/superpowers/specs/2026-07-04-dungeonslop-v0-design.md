# Dungeonslop v0 — Design

**Status:** approved for planning
**Date:** 2026-07-04
**Goal:** A genuinely playable online co-op tactical dungeon run that 2–4 friends can play together ASAP. Fun over content. Simplify hard.

---

## 1. Product summary

Dungeonslop is a browser-based co-op tactical dungeon crawler. Friends open a link, join a room by code, pick a class, and clear a 3-room dungeon together on an 8×8 grid using an action-point combat system. Between rooms, a **Slop Card** injects a room-wide twist — this chaos is the game's identity. Players grow stronger via post-room **upgrade** picks and **equipment** that drops from monsters.

A run is a single session. When the room closes, the run is gone. That is acceptable for v0.

## 2. Scope (v0)

**In:**
- 2–4 player online co-op, room-code join
- 2 classes
- 5 monster types
- 3 rooms: easy → elite → boss
- 15 slop cards
- 20 upgrades
- 15 equipment items (weapon / armor / trinket slots)
- AP-based tactical combat on an 8×8 CSS-grid board
- Lobby: create/join room, pick name, pick class, ready up

**Explicitly out (deferred, not scaffolded):**
- **Postgres / any persistence.** Runs are in-memory in the Colyseus room and die with it. Needed only for saved history/accounts/leaderboards — none of which v0 requires.
- Phaser (the board is React + CSS grid; Phaser is a later swap-in)
- Discord bot, external "chaos agent"
- Accounts / login / auth

## 3. Architecture

One repository, workspace with three packages:

```
dungeonslop/
  client/    Vite + React + TypeScript   → renders board & UI, sends player intents
  server/    Colyseus + Node + TypeScript → authoritative game state + turn engine
  shared/    TypeScript + Zod            → types, schemas, PURE game-logic functions
```

**Core discipline — logic vs. visuals separation:**
- **All game rules live in `shared/` as pure, side-effect-free functions** (e.g. `canMove`, `resolveAttack`, `applyUpgrade`, `equip`, `drawSlopCard`, `runMonsterAI`). They take state + an action and return the next state or a result. They are trivially unit-testable with no server or client running.
- **The `server/` is the sole authority.** The Colyseus room holds the authoritative state and calls `shared/` functions to mutate it. Clients never decide outcomes.
- **The `client/` renders and sends intents only.** It never computes hits, damage, or legality — it displays the state Colyseus syncs and animates the diff.

**Data flow:**
```
client intent ("move unit A to (3,4)")
  → server room receives message
  → validates via shared logic (is it this player's turn? enough AP? legal tile?)
  → mutates Colyseus state via shared logic
  → Colyseus auto-syncs state to all clients
  → clients animate the change
```

Illegal or out-of-turn intents are rejected server-side and ignored (optionally with a small error message back to the sender).

**Cross-package types:** `shared` is imported by both `client` and `server` via workspace linking, so types and content stay in sync with zero duplication.

## 4. Content is data

Classes, monsters, upgrades, equipment, and slop cards are **plain typed data** in `shared/content/`, validated by Zod at load time. Building content items #6–#35 later is editing a data file, not writing code. The *systems* are built once; the *content* scales for free.

- **Class:** `{ id, name, maxHp, moveRange, baseAttack, skill }`
- **Monster:** `{ id, name, maxHp, moveRange, attack, aiKind, lootTable }`
- **Upgrade:** `{ id, name, description, effect }` (effect applied immediately on pick)
- **Equipment:** `{ id, name, slot: weapon|armor|trinket, effect }` (drops from monsters)
- **SlopCard:** `{ id, name, description, effect }` (room-wide modifier applied on room entry)

## 5. Combat & turn model

- **Action points:** each player activation grants **2 AP**. Move = 1 AP, Attack = 1 AP, Skill = 2 AP, Use item = 1 AP, End turn = 0 AP.
- **Round structure — seat-order turn queue:** P1 activates (spends AP, ends), P2 activates, … then a **monster phase** where each monster runs simple AI (approach nearest player; attack if adjacent). Then the next round begins. This deliberately avoids DnD initiative edge cases.
- **Board:** 8×8 grid of tiles with walls / obstacles and an exit tile. Interaction: click a friendly unit → legal tiles highlight → click to move or attack.
- **Room clear:** all monsters defeated → exit opens → the party advances.
- **Between rooms:** draw 1 **Slop Card** (applies a room-wide modifier for the next room) → then an **upgrade chest** (each player, or the party, picks 1 of 3 — decided in planning). Equipment drops occur *during* fights from monster loot tables.

## 6. Progression (two systems, kept simple)

- **Upgrades:** post-room chest, pick 1 of 3 from the 20-item pool. Applied immediately as a run-scoped buff (e.g. +1 max HP, +1 damage, +1 move, gain cleave). No inventory — picking = applied.
- **Equipment:** three slots (weapon / armor / trinket). Drops from monsters mid-fight into a simple inventory; players can equip/swap. Each item carries a stat effect. UI is intentionally minimal (list + equip button), not a drag-and-drop paperdoll.

## 7. Lobby

Create room → get a short room code. Others join by code. Each player sets a name and picks 1 of 2 classes, then marks ready. When all ready, host starts → everyone enters room 1.

## 8. Deployment

- **Backend** (Colyseus WS + Node) → **Railway**.
- **Frontend** (static Vite build) → **Cloudflare Pages**.
- Client reads the server URL from `VITE_SERVER_URL` (never hardcoded). Server configures CORS + allowed WS origin for the Cloudflare domain. This is the only cross-host concern and it's baked in from day one.

## 9. Testing strategy

- **`shared/` logic:** unit tests are the backbone — pure functions, fast, no I/O. Cover movement legality, attack resolution, AP accounting, upgrade/equipment effects, slop-card modifiers, monster AI decisions, room-clear detection.
- **`server/`:** a few integration tests driving a Colyseus room through a short scripted run (join → move → attack → clear → slop → upgrade → next room).
- **`client/`:** kept thin on purpose; minimal component tests. Real validation is playing with friends.

## 10. Open items for the planning phase (not blockers)

- Upgrade pick: per-player choice vs. single party vote (spec's "Budget Cuts" slop card implies party voting exists as a mechanic).
- Exact starting stats for the 2 classes and 5 monsters (tuning, done during authoring).
- Reconnect behavior if a player drops mid-run (nice-to-have; simplest v0 = seat stays, others continue).
