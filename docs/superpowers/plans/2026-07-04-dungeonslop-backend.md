# Dungeonslop v0 — BACKEND Plan (`shared` engine + `server` + Railway)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Parallel work:** This is one of two plans (see also `2026-07-04-dungeonslop-frontend.md`). The two share the **Shared Contract** section below — it is identical in both files and is the coordination surface. **Backend owns the contract**: `shared`'s public API and the Colyseus protocol are defined and implemented here. The frontend consumes them.

**Goal:** A running, authoritative multiplayer server: pure game rules in `shared`, a Colyseus room in `server` that validates every player intent through those rules, deployed on Railway.

**Architecture:** `shared` is a build-step-free TypeScript package of pure, deterministic game-logic functions. `server` is the sole authority — it holds `GameState` in a Colyseus room, mutates it only via `shared` functions, rejects illegal/out-of-turn intents, and syncs a Schema projection to clients.

**Tech Stack:** TypeScript (`strict`) · pnpm workspaces · Vitest · Colyseus + Node 20, run with `tsx` · Zod. No Postgres. Deploy: Railway.

## Global Constraints

- **TypeScript `strict: true` everywhere. No `any` in `shared`.**
- **All game rules live in `shared/` as pure, side-effect-free functions.** No `Math.random` inside rule functions — randomness is injected as `rng: () => number`.
- **`shared` is consumed as raw TS** (no dev build step): `package.json` points `main`/`types` at `src/index.ts`.
- **Server is the sole authority.** Every mutation goes through a `shared` function inside a try/catch; a thrown error = rejected intent.
- **Server binds `process.env.PORT`**; CORS + Colyseus transport allow the Cloudflare origin (env-driven, never hardcoded).
- **Node 20+ · pnpm 9+.** Test command: `pnpm test` (Vitest) from repo root.
- **Commit after every task.**

---

## Shared Contract (v0) — identical in both plans

### `shared` package public API (Backend implements · Frontend consumes)

```ts
// Types
interface Pos { x: number; y: number; }
type Team = 'player' | 'monster';
interface Unit { id: string; team: Team; name: string; defId: string; pos: Pos;
  hp: number; maxHp: number; moveRange: number; attack: number; ap: number;
  inventory?: string[]; equipment?: { weapon?: string; armor?: string; trinket?: string }; }
interface Board { width: number; height: number; walls: Pos[]; exit: Pos; }
type Phase = 'lobby' | 'player' | 'monster' | 'slop' | 'reward' | 'roomClear' | 'defeat';
interface GameState { board: Board; units: Record<string, Unit>; order: string[];
  activeIndex: number; phase: Phase; roomIndex: number; modifiers?: RoomModifiers; }

const AP_PER_TURN = 2, MOVE_COST = 1, ATTACK_COST = 1, SKILL_COST = 2;

// Content records (keyed by id)
CLASSES, MONSTERS, UPGRADES, EQUIPMENT, SLOP_CARDS

// Pure functions (illegal actions THROW Error)
createRoom(roomIndex: number, playerSeed: {name:string; classId:string}[]): GameState
keyOf(p: Pos): string
legalMoves(state: GameState, unitId: string): Pos[]
legalAttacks(state: GameState, unitId: string): string[]
applyMove(state: GameState, unitId: string, to: Pos): GameState
applyAttack(state: GameState, attackerId: string, targetId: string): GameState
applySkill(state: GameState, unitId: string, targetId: string): GameState
endTurn(state: GameState, runMonsterPhase: (s: GameState) => GameState): GameState
runMonsterPhase(state: GameState): GameState
isRoomClear(state: GameState): boolean
isDefeat(state: GameState): boolean
// M4/M5
applyUpgrade(state: GameState, unitId: string, upgradeId: string): GameState
equip(state: GameState, unitId: string, itemId: string): GameState
drawSlopCard(rng: () => number): string   // returns a SLOP_CARDS id
```

### Colyseus network protocol (Backend implements · Frontend consumes)

- **Room name:** `"dungeon"`. Each `client.sessionId` maps to exactly one player unit id.
- **Client → Server:**
  - Lobby: `setName {name}` · `setClass {classId}` · `toggleReady` · `start` (host only; requires all ready)
  - Game: `intent {kind:'move', to:{x,y}}` · `intent {kind:'attack', targetId}` · `intent {kind:'skill', targetId}` · `intent {kind:'endTurn'}`
  - Rewards: `pickUpgrade {upgradeId}` · `equip {itemId}`
- **Server → Client (synced Schema, projection of `GameState` + lobby):**
  `phase` · `players[] {sessionId,name,classId,ready}` · `units{}` · `board` · `order[]` · `activeIndex` · `roomIndex` · `currentSlopCardId` · `rewardOptions[]` · plus each client learns its own unit id via `mySessionId`.
- **Authority rule:** server rejects any intent from a client that does not own the referenced unit, or whose unit is not the active one, or that throws inside a `shared` function.

---

# B-M0 — Repo scaffold (backend owns root)

**Deliverable:** `pnpm test` green across a workspace containing `shared` + `server` (and a `client` glob the frontend agent will fill). **This task must land before the frontend agent's client scaffold; it is the one ordering dependency between the plans.**

### Task B0.1: Initialize workspace + `shared` + `server`

**Files:** Create `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `tsconfig.base.json`, `vitest.config.ts`, `shared/package.json`, `shared/tsconfig.json`, `shared/src/index.ts`, `server/package.json`, `server/tsconfig.json`, `server/src/index.ts`. Test: `server/src/smoke.test.ts`.

**Interfaces:** Produces the workspace, a raw-TS `shared` package (entry `src/index.ts`), and a `server` package that can import `shared`.

- [ ] **Step 1: Failing test**

```ts
// server/src/smoke.test.ts
import { VERSION } from 'shared';
test('server imports shared', () => { expect(VERSION).toBe('0.0.0'); });
```

- [ ] **Step 2: Run — expect FAIL** (`pnpm test` — cannot resolve `shared`).

- [ ] **Step 3: Create root + package files**

```yaml
# pnpm-workspace.yaml
packages:
  - 'shared'
  - 'client'
  - 'server'
```
```json
// package.json (root)
{ "name": "dungeonslop", "private": true, "type": "module",
  "scripts": { "test": "vitest run", "test:watch": "vitest" },
  "devDependencies": { "typescript": "^5.5.0", "vitest": "^2.0.0", "tsx": "^4.16.0" } }
```
```json
// tsconfig.base.json
{ "compilerOptions": { "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
  "strict": true, "noUncheckedIndexedAccess": true, "esModuleInterop": true,
  "skipLibCheck": true, "resolveJsonModule": true, "types": ["vitest/globals"] } }
```
```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { globals: true, include: ['**/*.test.ts'], exclude: ['**/node_modules/**'] } });
```
```gitignore
# .gitignore
node_modules/
dist/
.env
.env.local
*.log
```
```json
// shared/package.json
{ "name": "shared", "version": "0.0.0", "private": true, "type": "module",
  "main": "src/index.ts", "types": "src/index.ts",
  "dependencies": { "zod": "^3.23.0" } }
```
```json
// shared/tsconfig.json
{ "extends": "../tsconfig.base.json", "include": ["src"] }
```
```ts
// shared/src/index.ts
export const VERSION = '0.0.0';
```
```json
// server/package.json
{ "name": "server", "version": "0.0.0", "private": true, "type": "module",
  "scripts": { "dev": "tsx watch src/index.ts", "start": "tsx src/index.ts" },
  "dependencies": { "shared": "workspace:*" } }
```
```json
// server/tsconfig.json
{ "extends": "../tsconfig.base.json", "include": ["src"] }
```
```ts
// server/src/index.ts
import { VERSION } from 'shared';
console.log(`server booting, shared v${VERSION}`);
```

- [ ] **Step 4: Run — expect PASS** (`pnpm install && pnpm test`).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "chore: scaffold workspace + shared + server"`

---

# B-M1 — Game engine in `shared` (the contract, implemented)

**Deliverable:** every pure function in the Shared Contract, unit-tested. This is what the frontend's hotseat mode and the server both run. **Highest priority for the frontend agent** — deliver this early so they can play the fun-check.

> The following tasks (types + content, board/pathing, move, attack, turn/round, monster AI, skill) are the engine. Implement each with TDD.

### Task B1.1: Types + content seed + `createRoom`

**Files:** Create `shared/src/types.ts`, `shared/src/content/classes.ts`, `shared/src/content/monsters.ts`, `shared/src/rooms.ts`; modify `shared/src/index.ts`. Test: `shared/src/rooms.test.ts`.

**Interfaces:** Produces `CLASSES`, `MONSTERS`, `createRoom(...)` per contract; the `types.ts` block below is the single source of the shared types.

- [ ] **Step 1: Failing test**

```ts
// shared/src/rooms.test.ts
import { createRoom } from './rooms';
test('createRoom places players + monsters at full hp, player phase', () => {
  const s = createRoom(0, [{ name: 'Ann', classId: 'knight' }]);
  const players = Object.values(s.units).filter(u => u.team === 'player');
  expect(players).toHaveLength(1);
  expect(Object.values(s.units).some(u => u.team === 'monster')).toBe(true);
  expect(players[0]!.hp).toBe(players[0]!.maxHp);
  expect(s.phase).toBe('player');
  expect(s.order).toEqual([players[0]!.id]);
});
```

- [ ] **Step 2: Run — expect FAIL** (`pnpm test rooms`).

- [ ] **Step 3: Implement**

```ts
// shared/src/types.ts
export interface Pos { x: number; y: number; }
export type Team = 'player' | 'monster';
export interface Unit {
  id: string; team: Team; name: string; defId: string; pos: Pos;
  hp: number; maxHp: number; moveRange: number; attack: number; ap: number;
  inventory?: string[];
  equipment?: { weapon?: string; armor?: string; trinket?: string };
}
export interface Board { width: number; height: number; walls: Pos[]; exit: Pos; }
export type Phase = 'lobby' | 'player' | 'monster' | 'slop' | 'reward' | 'roomClear' | 'defeat';
export interface RoomModifiers { moveCostDelta?: number; monsterHpDelta?: number; visionRange?: number; }
export interface GameState {
  board: Board; units: Record<string, Unit>; order: string[];
  activeIndex: number; phase: Phase; roomIndex: number; modifiers?: RoomModifiers;
}
export const AP_PER_TURN = 2;
export const MOVE_COST = 1;
export const ATTACK_COST = 1;
export const SKILL_COST = 2;
```
```ts
// shared/src/content/classes.ts
export interface ClassDef { id: string; name: string; maxHp: number; moveRange: number; attack: number; }
export const CLASSES: Record<string, ClassDef> = {
  knight: { id: 'knight', name: 'Knight', maxHp: 12, moveRange: 3, attack: 4 },
  archer: { id: 'archer', name: 'Archer', maxHp: 8, moveRange: 4, attack: 3 },
};
```
```ts
// shared/src/content/monsters.ts
export interface MonsterDef { id: string; name: string; maxHp: number; moveRange: number; attack: number; }
export const MONSTERS: Record<string, MonsterDef> = {
  goblin: { id: 'goblin', name: 'Goblin', maxHp: 5, moveRange: 3, attack: 2 },
  slime:  { id: 'slime',  name: 'Slime',  maxHp: 8, moveRange: 2, attack: 1 },
};
```
```ts
// shared/src/rooms.ts
import { Board, GameState, Unit, AP_PER_TURN } from './types';
import { CLASSES } from './content/classes';
import { MONSTERS } from './content/monsters';

function board(): Board {
  return { width: 8, height: 8, walls: [{ x: 3, y: 3 }, { x: 4, y: 3 }], exit: { x: 7, y: 7 } };
}
const ROOM_MONSTERS: Record<number, { defId: string; pos: Pos }[]> = {
  0: [{ defId: 'goblin', pos: { x: 6, y: 1 } }, { defId: 'goblin', pos: { x: 6, y: 5 } }],
};
type Pos = { x: number; y: number };

export function createRoom(
  roomIndex: number,
  playerSeed: { name: string; classId: string }[],
): GameState {
  const units: Record<string, Unit> = {};
  const order: string[] = [];
  playerSeed.forEach((p, i) => {
    const def = CLASSES[p.classId]!;
    const id = `p${i}`;
    order.push(id);
    units[id] = { id, team: 'player', name: p.name, defId: def.id, pos: { x: 0, y: i },
      hp: def.maxHp, maxHp: def.maxHp, moveRange: def.moveRange, attack: def.attack,
      ap: AP_PER_TURN, inventory: [], equipment: {} };
  });
  (ROOM_MONSTERS[roomIndex] ?? []).forEach((m, i) => {
    const def = MONSTERS[m.defId]!;
    const id = `m${i}`;
    units[id] = { id, team: 'monster', name: def.name, defId: def.id, pos: m.pos,
      hp: def.maxHp, maxHp: def.maxHp, moveRange: def.moveRange, attack: def.attack, ap: 0 };
  });
  return { board: board(), units, order, activeIndex: 0, phase: 'player', roomIndex };
}
```
```ts
// shared/src/index.ts
export const VERSION = '0.0.0';
export * from './types';
export * from './content/classes';
export * from './content/monsters';
export * from './rooms';
export * from './board';
export * from './combat';
export * from './ai';
```
> Create empty stubs `shared/src/board.ts`, `combat.ts`, `ai.ts` (`export {};`) so index re-exports resolve; fill them in the next tasks.

- [ ] **Step 4: Run — expect PASS** (`pnpm test rooms`).
- [ ] **Step 5: Commit** — `git commit -am "feat(shared): types + content seed + createRoom"`

### Task B1.2 – B1.7 (engine functions — same TDD structure)

Implement these exactly as specified in the Shared Contract, each with a failing test → minimal impl → passing test → commit. Full reference code for each is below; keep signatures verbatim (the frontend and server both call them).

- [ ] **B1.2 `board.ts`:** `keyOf`, `inBounds`, `occupant`, `isBlocked`, `legalMoves` (BFS within `moveRange`, walls+units block, excludes start), `legalAttacks` (orthogonally adjacent enemies, team-agnostic).

```ts
// shared/src/board.ts
import { Board, GameState, Pos, Unit } from './types';
export function keyOf(p: Pos): string { return `${p.x},${p.y}`; }
export function inBounds(b: Board, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < b.width && p.y < b.height;
}
export function occupant(s: GameState, p: Pos): Unit | undefined {
  return Object.values(s.units).find(u => u.pos.x === p.x && u.pos.y === p.y);
}
export function isBlocked(s: GameState, p: Pos): boolean {
  if (s.board.walls.some(w => w.x === p.x && w.y === p.y)) return true;
  return occupant(s, p) !== undefined;
}
const STEPS: Pos[] = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
export function legalMoves(s: GameState, unitId: string): Pos[] {
  const unit = s.units[unitId]!; const start = unit.pos;
  const dist = new Map<string, number>([[keyOf(start), 0]]);
  const queue: Pos[] = [start]; const result: Pos[] = [];
  while (queue.length) {
    const cur = queue.shift()!; const d = dist.get(keyOf(cur))!;
    if (d >= unit.moveRange) continue;
    for (const st of STEPS) {
      const next = { x: cur.x + st.x, y: cur.y + st.y };
      if (!inBounds(s.board, next) || dist.has(keyOf(next)) || isBlocked(s, next)) continue;
      dist.set(keyOf(next), d + 1); queue.push(next); result.push(next);
    }
  }
  return result;
}
export function legalAttacks(s: GameState, unitId: string): string[] {
  const u = s.units[unitId]!;
  const adj: Pos[] = [{x:u.pos.x+1,y:u.pos.y},{x:u.pos.x-1,y:u.pos.y},{x:u.pos.x,y:u.pos.y+1},{x:u.pos.x,y:u.pos.y-1}];
  return Object.values(s.units)
    .filter(o => o.team !== u.team && adj.some(a => a.x === o.pos.x && a.y === o.pos.y))
    .map(o => o.id);
}
```
Tests: `inBounds` on the 8×8 grid; `legalMoves` for a range-3 knight from a corner excludes start, includes 3-east, excludes 4-east; `legalAttacks` finds an adjacent enemy.

- [ ] **B1.3 `combat.ts` → `applyMove`:** pure, clones via `structuredClone`, checks active player + AP + `legalMoves`, spends `MOVE_COST`.
- [ ] **B1.4 `combat.ts` → `applyAttack`:** checks active + AP + `legalAttacks`, deals `attacker.attack`, deletes target at hp≤0, spends `ATTACK_COST`.
- [ ] **B1.5 `combat.ts` → `endTurn(state, runMonsterPhase)` + `isRoomClear` + `isDefeat`:** advance `activeIndex`; after last player, set phase `monster`, run injected `runMonsterPhase`, reset `activeIndex=0`, refill player AP to `AP_PER_TURN`, then settle to `roomClear`/`defeat`/`player`.
- [ ] **B1.6 `ai.ts` → `runMonsterPhase`:** for each living monster, attack an adjacent player else step toward nearest (Manhattan) player along a legal tile; deterministic tie-break by fixed step order.
- [ ] **B1.7 `combat.ts` → `applySkill`:** costs `SKILL_COST`, Power Strike = adjacent enemy takes `attacker.attack + 3`.

```ts
// shared/src/combat.ts  (accumulated across B1.3–B1.7 & B1.5)
import { GameState, Pos, MOVE_COST, ATTACK_COST, SKILL_COST, AP_PER_TURN } from './types';
import { legalMoves, legalAttacks, keyOf } from './board';
const clone = (s: GameState): GameState => structuredClone(s);
function requireActivePlayer(s: GameState, id: string): void {
  if (s.phase !== 'player') throw new Error('not player phase');
  if (s.order[s.activeIndex] !== id) throw new Error('not this unit\'s turn');
}
export function applyMove(s: GameState, unitId: string, to: Pos): GameState {
  requireActivePlayer(s, unitId);
  const u = s.units[unitId]!;
  if (u.ap < MOVE_COST) throw new Error('not enough AP');
  if (!legalMoves(s, unitId).some(p => keyOf(p) === keyOf(to))) throw new Error('illegal move');
  const n = clone(s); n.units[unitId]!.pos = { ...to }; n.units[unitId]!.ap -= MOVE_COST; return n;
}
export function applyAttack(s: GameState, attackerId: string, targetId: string): GameState {
  requireActivePlayer(s, attackerId);
  const a = s.units[attackerId]!;
  if (a.ap < ATTACK_COST) throw new Error('not enough AP');
  if (!legalAttacks(s, attackerId).includes(targetId)) throw new Error('target not adjacent');
  const n = clone(s); n.units[attackerId]!.ap -= ATTACK_COST;
  const t = n.units[targetId]!; t.hp -= a.attack; if (t.hp <= 0) delete n.units[targetId]; return n;
}
export function applySkill(s: GameState, unitId: string, targetId: string): GameState {
  requireActivePlayer(s, unitId);
  const u = s.units[unitId]!;
  if (u.ap < SKILL_COST) throw new Error('not enough AP');
  if (!legalAttacks(s, unitId).includes(targetId)) throw new Error('target not adjacent');
  const n = clone(s); n.units[unitId]!.ap -= SKILL_COST;
  const t = n.units[targetId]!; t.hp -= u.attack + 3; if (t.hp <= 0) delete n.units[targetId]; return n;
}
export function isRoomClear(s: GameState): boolean {
  return !Object.values(s.units).some(u => u.team === 'monster');
}
export function isDefeat(s: GameState): boolean {
  return !Object.values(s.units).some(u => u.team === 'player');
}
function settle(s: GameState): GameState {
  if (isDefeat(s)) return { ...s, phase: 'defeat' };
  if (isRoomClear(s)) return { ...s, phase: 'roomClear' };
  return s;
}
export function endTurn(s: GameState, runMonsterPhase: (s: GameState) => GameState): GameState {
  let n = clone(s); n.activeIndex += 1;
  if (n.activeIndex < n.order.length) return settle(n);
  n.phase = 'monster'; n = runMonsterPhase(n); n.activeIndex = 0;
  for (const u of Object.values(n.units)) if (u.team === 'player') u.ap = AP_PER_TURN;
  n.phase = 'player'; return settle(n);
}
```
```ts
// shared/src/ai.ts
import { GameState, Pos } from './types';
import { inBounds, isBlocked, legalAttacks } from './board';
const STEPS: Pos[] = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
const manhattan = (a: Pos, b: Pos) => Math.abs(a.x-b.x) + Math.abs(a.y-b.y);
function nearestPlayerPos(s: GameState, from: Pos): Pos | undefined {
  const players = Object.values(s.units).filter(u => u.team === 'player');
  if (!players.length) return undefined;
  players.sort((a, b) => manhattan(from, a.pos) - manhattan(from, b.pos));
  return players[0]!.pos;
}
export function runMonsterPhase(state: GameState): GameState {
  const s: GameState = structuredClone(state);
  const ids = Object.values(s.units).filter(u => u.team === 'monster').map(u => u.id);
  for (const id of ids) {
    const m = s.units[id]; if (!m) continue;
    const targets = legalAttacks(s, id);
    if (targets.length) {
      const t = s.units[targets[0]!]!; t.hp -= m.attack; if (t.hp <= 0) delete s.units[t.id]; continue;
    }
    const goal = nearestPlayerPos(s, m.pos); if (!goal) continue;
    let best: Pos | undefined; let bestDist = manhattan(m.pos, goal);
    for (const st of STEPS) {
      const nx = { x: m.pos.x + st.x, y: m.pos.y + st.y };
      if (!inBounds(s.board, nx) || isBlocked(s, nx)) continue;
      const d = manhattan(nx, goal); if (d < bestDist) { bestDist = d; best = nx; }
    }
    if (best) m.pos = best;
  }
  return s;
}
```

**Deliver checkpoint:** once B1.1–B1.7 pass, tell the frontend agent `shared` is ready — they can wire the hotseat fun-check (their F-M1).

---

# B-M2 — Colyseus server (roadmap → detail after B-M1)

**Deliverable:** a `"dungeon"` room that runs the engine authoritatively and enforces the protocol.

**Tasks:**
1. Add `colyseus` + `@colyseus/core` to `server`; boot HTTP+WS on `process.env.PORT` (default 2567).
2. Colyseus `Schema` classes projecting `GameState` + lobby (`players`, `phase`, `units`, `board`, `order`, `activeIndex`, `roomIndex`, `currentSlopCardId`, `rewardOptions`). Keep a plain `GameState` as the room's internal source of truth; re-project into the Schema after each mutation.
3. `DungeonRoom.onJoin`: seat the client into `players`. `onMessage('intent', …)`: map `sessionId → unitId`, verify ownership + active unit, call the matching `shared` function in try/catch, reject on throw, re-project on success.
4. Authority tests: an intent from a non-owner is rejected; an out-of-turn intent is rejected; a legal move updates synced state.
5. Integration test: scripted room join → move → attack → clear.

# B-M3 — Lobby server (roadmap)
State machine `phase: 'lobby' → in-game`; `setName`/`setClass`/`toggleReady`/`start` (host + all-ready gate) → `createRoom(0, seatedPlayers)`. Short join code.

# B-M4 — Progression content + logic (roadmap)
`shared/content/upgrades.ts` (20) + `applyUpgrade`; `shared/content/equipment.ts` (15) + `equip` + `inventory`/slot handling; monster `lootTable` drops on kill (inject `rng`); `pickUpgrade`/`equip` messages + `reward` phase (roll 3 options).

# B-M5 — Slop cards + full run content (roadmap)
`shared/content/slopcards.ts` (15) modeled as `RoomModifiers` read by the engine (Gravity Tax → `moveCostDelta`; Goblin Union → `monsterHpDelta`; etc.); thread modifiers into `applyMove`/`createRoom`; fill 5 monsters + rooms 1/2/3 incl. boss + elite; `drawSlopCard(rng)` + `slop` phase; a Zod-validated content test asserting counts (2/5/20/15/15).

# B-M6 — Deploy backend (roadmap)
Bind `PORT`; CORS + Colyseus transport allow the Cloudflare origin from env; Railway service (root `server`, start `pnpm --filter server... start` or a Dockerfile); publish the public `wss://` URL to the frontend agent for `VITE_SERVER_URL`.

---

## Self-Review notes
- **Contract ownership:** every `shared` function + protocol message in the contract has an implementing task (B1.x, B-M2..M5). No `any` in the shown code.
- **Purity:** all engine functions clone via `structuredClone` and take injected `rng` where randomness is needed (loot, slop draw).
- **Type consistency:** `GameState`/`Unit`/`Phase` + AP constants defined once in B1.1; `endTurn(state, runMonsterPhase)` signature matches its call in the server (B-M2) and the frontend hotseat.
- **Cross-plan:** B0.1 (root scaffold) is the sole ordering dependency for the frontend; B1.x delivery unblocks the frontend hotseat.
