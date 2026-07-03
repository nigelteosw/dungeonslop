# Dungeonslop v0 — BACKEND Plan (`shared` engine + `server` + Railway)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> **Parallel work:** one of two plans (see `2026-07-04-dungeonslop-frontend.md`). Both share the **Shared Contract** below — identical in each file, it is the coordination surface. **Backend owns the contract**: `shared`'s API + the Colyseus protocol are defined and implemented here; the frontend consumes them.

**Goal:** an authoritative multiplayer server — pure card/tactics rules in `shared`, a Colyseus room in `server` that validates every intent through them — deployed on Railway.

**Architecture:** `shared` is a build-step-free TS package of pure, deterministic functions (randomness injected as `rng`). `server` is the sole authority: it holds `GameState` in a Colyseus room, mutates it only via `shared`, rejects illegal/out-of-turn/non-owner intents, and syncs a Schema projection.

**Tech Stack:** TypeScript (`strict`) · pnpm workspaces · Vitest · Colyseus + Node 20 via `tsx` · Zod. No Postgres. Deploy: Railway.

## Global Constraints

- **TS `strict: true` everywhere. No `any` in `shared`.**
- **All rules pure & deterministic** — no `Math.random`/`Date.now` in rule functions; randomness is injected `rng: () => number`.
- **`shared` consumed as raw TS** — `package.json` `main`/`types` → `src/index.ts`.
- **Server is sole authority** — every mutation goes through a `shared` function in try/catch; a throw = rejected intent.
- **Board is 16×16.** Movement/ranges tuned for it.
- **Server binds `process.env.PORT`**; CORS + Colyseus transport allow the Cloudflare origin from env.
- **Node 20+ · pnpm 9+.** Test: `pnpm test`. **Commit after every task.**

---

## Shared Contract (v0) — identical in both plans

### `shared` public API (Backend implements · Frontend consumes)

```ts
// ---- Types ----
interface Pos { x: number; y: number; }
type Team = 'player' | 'monster';
interface Unit {
  id: string; team: Team; name: string; defId: string; pos: Pos;
  hp: number; maxHp: number; moveRange: number; attack: number;
  energy: number; maxEnergy: number; block: number; hasMoved: boolean;
  deck: string[]; hand: string[]; discard: string[];
  inventory?: string[]; equipment?: { weapon?: string; armor?: string; trinket?: string };
}
interface Board { width: number; height: number; walls: Pos[]; exit: Pos; } // 16×16
type Phase = 'lobby' | 'player' | 'monster' | 'slop' | 'reward' | 'roomClear' | 'defeat';
interface RoomModifiers { moveRangeDelta?: number; monsterHpDelta?: number; energyDelta?: number; }
interface GameState { board: Board; units: Record<string, Unit>; order: string[];
  activeIndex: number; phase: Phase; roomIndex: number; modifiers?: RoomModifiers; }

const HAND_SIZE = 5;
type Dir = { x: -1|0|1; y: -1|0|1 };        // 4 orthogonal dirs used for line cards

// ---- Content (Zod-validated records, keyed by id) ----
CLASSES   // { id,name,maxHp,moveRange,attack,maxEnergy,startingDeck:string[] }
MONSTERS  // { id,name,maxHp,moveRange,attack,lootTable }
CARDS     // { id,name,cost, effect:'damage'|'heal'|'block', shape:'melee'|'ranged'|'line'|'self', power, range? }
UPGRADES  // { id,name,description,effect }           (M4)
EQUIPMENT // { id,name,slot:'weapon'|'armor'|'trinket',effect } (M4)
SLOP_CARDS// { id,name,description,effect }           (M5)

// ---- Pure functions (illegal actions THROW Error) ----
createRoom(roomIndex: number, playerSeed: {name:string;classId:string}[], rng: () => number): GameState
keyOf(p: Pos): string
inBounds(b: Board, p: Pos): boolean
isWall(b: Board, p: Pos): boolean
occupant(s: GameState, p: Pos): Unit | undefined
isBlocked(s: GameState, p: Pos): boolean            // wall OR unit
legalMoves(s: GameState, unitId: string): Pos[]
applyMove(s: GameState, unitId: string, to: Pos): GameState
lineOfSight(s: GameState, from: Pos, to: Pos): boolean          // walls block; endpoints excluded
traceLine(s: GameState, from: Pos, dir: Dir, range: number): { tiles: Pos[]; hitUnitIds: string[] }
cardTargets(s: GameState, unitId: string, cardId: string): Pos[]
playCard(s: GameState, unitId: string, cardId: string, target: Pos): GameState
startTurn(s: GameState, rng: () => number): GameState           // refill energy, reset move/block, draw to HAND_SIZE
endTurn(s: GameState, runMonsterPhase: (s: GameState) => GameState, rng: () => number): GameState
runMonsterPhase(s: GameState): GameState
isRoomClear(s: GameState): boolean
isDefeat(s: GameState): boolean
// M4/M5
applyUpgrade(s: GameState, unitId: string, upgradeId: string): GameState
equip(s: GameState, unitId: string, itemId: string): GameState
drawSlopCard(rng: () => number): string
```

### Colyseus network protocol (Backend implements · Frontend consumes)

- **Room name:** `"dungeon"`. Each `sessionId` ↔ one player unit id (client learns its own via `mySessionId`).
- **Client → Server:**
  - Lobby: `setName {name}` · `setClass {classId}` · `toggleReady` · `start` (host; all-ready gate)
  - Game: `intent {kind:'move', to:{x,y}}` · `intent {kind:'playCard', cardId, target:{x,y}}` · `intent {kind:'endTurn'}`
  - Rewards: `pickUpgrade {upgradeId}` · `equip {itemId}`
- **Server → Client (synced Schema, projection of `GameState` + lobby):**
  `phase` · `players[] {sessionId,name,classId,ready}` · `units{}` (incl. `hand` only for the owning client — or full; v0 may sync full state) · `board` · `order[]` · `activeIndex` · `roomIndex` · `currentSlopCardId` · `rewardOptions[]`.
- **Authority:** reject any intent from a non-owner, for a non-active unit, or that throws inside a `shared` function.

---

# B-M0 — Repo scaffold (backend owns root)

**Deliverable:** `pnpm test` green across a workspace with `shared` + `server` (and a `client` glob the frontend fills). **Must land before the frontend's client scaffold — the one ordering dependency between plans.**

### Task B0.1: Init workspace + `shared` + `server`

**Files:** Create `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `tsconfig.base.json`, `vitest.config.ts`, `shared/{package.json,tsconfig.json,src/index.ts}`, `server/{package.json,tsconfig.json,src/index.ts}`. Test: `server/src/smoke.test.ts`.

- [ ] **Step 1: Failing test**
```ts
// server/src/smoke.test.ts
import { VERSION } from 'shared';
test('server imports shared', () => { expect(VERSION).toBe('0.0.0'); });
```
- [ ] **Step 2: Run — expect FAIL** (`pnpm test`, cannot resolve `shared`).
- [ ] **Step 3: Create files**
```yaml
# pnpm-workspace.yaml
packages: ['shared', 'client', 'server']
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
  "main": "src/index.ts", "types": "src/index.ts", "dependencies": { "zod": "^3.23.0" } }
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

# B-M1 — Game engine in `shared` (card + tactics core)

**Deliverable:** every pure function in the contract, unit-tested. This is what the frontend hotseat and the server both run. **Highest priority — deliver early so the frontend can play the fun-check.** Build with TDD.

### Task B1.1: Types + content (classes, cards, monsters) + `createRoom`

**Files:** Create `shared/src/types.ts`, `shared/src/rng.ts`, `shared/src/content/{classes,cards,monsters}.ts`, `shared/src/rooms.ts`; modify `shared/src/index.ts`. Test: `shared/src/rooms.test.ts`.

- [ ] **Step 1: Failing test**
```ts
// shared/src/rooms.test.ts
import { createRoom } from './rooms';
import { HAND_SIZE } from './types';
const rng = () => 0.42;
test('createRoom: players full hp/energy, opening hand drawn, monsters present', () => {
  const s = createRoom(0, [{ name: 'Ann', classId: 'knight' }], rng);
  const p = s.units.p0!;
  expect(p.hp).toBe(p.maxHp);
  expect(p.energy).toBe(p.maxEnergy);
  expect(p.hand).toHaveLength(HAND_SIZE);
  expect(p.hasMoved).toBe(false);
  expect(Object.values(s.units).some(u => u.team === 'monster')).toBe(true);
  expect(s.board.width).toBe(16);
  expect(s.phase).toBe('player');
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
  hp: number; maxHp: number; moveRange: number; attack: number;
  energy: number; maxEnergy: number; block: number; hasMoved: boolean;
  deck: string[]; hand: string[]; discard: string[];
  inventory?: string[]; equipment?: { weapon?: string; armor?: string; trinket?: string };
}
export interface Board { width: number; height: number; walls: Pos[]; exit: Pos; }
export type Phase = 'lobby' | 'player' | 'monster' | 'slop' | 'reward' | 'roomClear' | 'defeat';
export interface RoomModifiers { moveRangeDelta?: number; monsterHpDelta?: number; energyDelta?: number; }
export interface GameState { board: Board; units: Record<string, Unit>; order: string[];
  activeIndex: number; phase: Phase; roomIndex: number; modifiers?: RoomModifiers; }
export const HAND_SIZE = 5;
export type Dir = { x: -1 | 0 | 1; y: -1 | 0 | 1 };
export const ORTHO: Dir[] = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
```
```ts
// shared/src/rng.ts  (pure helpers taking injected rng)
export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
```
```ts
// shared/src/content/cards.ts
export type CardEffect = 'damage' | 'heal' | 'block';
export type CardShape = 'melee' | 'ranged' | 'line' | 'self';
export interface CardDef { id: string; name: string; cost: number; effect: CardEffect; shape: CardShape; power: number; range?: number; }
export const CARDS: Record<string, CardDef> = {
  slash:    { id: 'slash',    name: 'Slash',        cost: 1, effect: 'damage', shape: 'melee',  power: 2 },
  cleave:   { id: 'cleave',   name: 'Cleave',       cost: 2, effect: 'damage', shape: 'line',   power: 1, range: 3 },
  block:    { id: 'block',    name: 'Shield Block', cost: 1, effect: 'block',  shape: 'self',   power: 5 },
  firebolt: { id: 'firebolt', name: 'Firebolt',     cost: 1, effect: 'damage', shape: 'ranged', power: 2, range: 6 },
  frost:    { id: 'frost',    name: 'Frost Shard',  cost: 1, effect: 'damage', shape: 'ranged', power: 1, range: 5 },
  vulcan:   { id: 'vulcan',   name: 'AK-47 Vulcan', cost: 2, effect: 'damage', shape: 'line',   power: 2, range: 9 },
  heal:     { id: 'heal',     name: 'Mend',         cost: 1, effect: 'heal',   shape: 'ranged', power: 4, range: 6 },
};
```
```ts
// shared/src/content/classes.ts
export interface ClassDef { id: string; name: string; maxHp: number; moveRange: number; attack: number; maxEnergy: number; startingDeck: string[]; }
export const CLASSES: Record<string, ClassDef> = {
  knight: { id: 'knight', name: 'Knight', maxHp: 14, moveRange: 4, attack: 3, maxEnergy: 3,
    startingDeck: ['slash','slash','slash','block','block','cleave'] },
  wizard: { id: 'wizard', name: 'Wizard', maxHp: 9, moveRange: 4, attack: 2, maxEnergy: 3,
    startingDeck: ['firebolt','firebolt','frost','frost','heal','vulcan'] },
};
```
```ts
// shared/src/content/monsters.ts
export interface MonsterDef { id: string; name: string; maxHp: number; moveRange: number; attack: number; lootTable: string[]; }
export const MONSTERS: Record<string, MonsterDef> = {
  goblin: { id: 'goblin', name: 'Goblin', maxHp: 6, moveRange: 4, attack: 3, lootTable: [] },
  slime:  { id: 'slime',  name: 'Slime',  maxHp: 9, moveRange: 2, attack: 2, lootTable: [] },
};
```
```ts
// shared/src/rooms.ts
import { Board, GameState, Unit, Pos, HAND_SIZE } from './types';
import { CLASSES } from './content/classes';
import { MONSTERS } from './content/monsters';
import { shuffle } from './rng';

function board(): Board {
  const walls: Pos[] = [
    { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 8, y: 6 }, { x: 9, y: 6 },
    { x: 6, y: 9 }, { x: 7, y: 9 }, { x: 8, y: 9 }, { x: 9, y: 9 },
  ];
  return { width: 16, height: 16, walls, exit: { x: 15, y: 15 } };
}
const ROOM_MONSTERS: Record<number, { defId: string; pos: Pos }[]> = {
  0: [{ defId: 'goblin', pos: { x: 13, y: 2 } }, { defId: 'goblin', pos: { x: 13, y: 13 } }],
};

export function createRoom(
  roomIndex: number,
  playerSeed: { name: string; classId: string }[],
  rng: () => number,
): GameState {
  const units: Record<string, Unit> = {};
  const order: string[] = [];
  playerSeed.forEach((p, i) => {
    const def = CLASSES[p.classId]!;
    const id = `p${i}`;
    order.push(id);
    const deck = shuffle(def.startingDeck, rng);
    const hand = deck.splice(0, HAND_SIZE);
    units[id] = { id, team: 'player', name: p.name, defId: def.id, pos: { x: 1, y: 1 + i * 2 },
      hp: def.maxHp, maxHp: def.maxHp, moveRange: def.moveRange, attack: def.attack,
      energy: def.maxEnergy, maxEnergy: def.maxEnergy, block: 0, hasMoved: false,
      deck, hand, discard: [], inventory: [], equipment: {} };
  });
  (ROOM_MONSTERS[roomIndex] ?? []).forEach((m, i) => {
    const def = MONSTERS[m.defId]!;
    units[`m${i}`] = { id: `m${i}`, team: 'monster', name: def.name, defId: def.id, pos: m.pos,
      hp: def.maxHp, maxHp: def.maxHp, moveRange: def.moveRange, attack: def.attack,
      energy: 0, maxEnergy: 0, block: 0, hasMoved: false, deck: [], hand: [], discard: [] };
  });
  return { board: board(), units, order, activeIndex: 0, phase: 'player', roomIndex };
}
```
```ts
// shared/src/index.ts
export const VERSION = '0.0.0';
export * from './types';
export * from './rng';
export * from './content/classes';
export * from './content/cards';
export * from './content/monsters';
export * from './rooms';
export * from './board';
export * from './cards';
export * from './turn';
export * from './ai';
```
> Create empty stubs `board.ts`, `cards.ts`, `turn.ts`, `ai.ts` (`export {};`) so index resolves; fill each in its task.
- [ ] **Step 4: Run — expect PASS** (`pnpm test rooms`).
- [ ] **Step 5: Commit** — `git commit -am "feat(shared): types + card/class/monster content + createRoom"`

### Task B1.2: Board geometry — moves, line-of-sight, line trace

**Files:** `shared/src/board.ts`; test `shared/src/board.test.ts`.

- [ ] **Step 1: Failing tests**
```ts
// shared/src/board.test.ts
import { createRoom } from './rooms';
import { legalMoves, inBounds, lineOfSight, traceLine } from './board';
const rng = () => 0.42;
test('inBounds respects 16×16', () => {
  const s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng);
  expect(inBounds(s.board, { x: 15, y: 15 })).toBe(true);
  expect(inBounds(s.board, { x: 16, y: 0 })).toBe(false);
});
test('legalMoves for range-4 knight excludes start, includes 4 east, excludes 5 east', () => {
  const s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng); // p0 at (1,1)
  const m = legalMoves(s, 'p0');
  expect(m).not.toContainEqual({ x: 1, y: 1 });
  expect(m).toContainEqual({ x: 5, y: 1 });
  expect(m).not.toContainEqual({ x: 6, y: 1 });
});
test('lineOfSight blocked by a wall between two points', () => {
  const s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng); // wall at (6,6)
  expect(lineOfSight(s, { x: 5, y: 6 }, { x: 8, y: 6 })).toBe(false); // passes (6,6)
  expect(lineOfSight(s, { x: 1, y: 1 }, { x: 1, y: 4 })).toBe(true);
});
test('traceLine stops at a wall and collects tiles', () => {
  const s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng);
  const r = traceLine(s, { x: 3, y: 6 }, { x: 1, y: 0 }, 9); // eastward toward wall at (6,6)
  expect(r.tiles).toContainEqual({ x: 5, y: 6 });
  expect(r.tiles).not.toContainEqual({ x: 6, y: 6 }); // wall not included, trace stops
});
```
- [ ] **Step 2: Run — expect FAIL** (`pnpm test board`).
- [ ] **Step 3: Implement**
```ts
// shared/src/board.ts
import { Board, GameState, Pos, Unit, Dir, ORTHO } from './types';
export function keyOf(p: Pos): string { return `${p.x},${p.y}`; }
export function inBounds(b: Board, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < b.width && p.y < b.height;
}
export function isWall(b: Board, p: Pos): boolean { return b.walls.some(w => w.x === p.x && w.y === p.y); }
export function occupant(s: GameState, p: Pos): Unit | undefined {
  return Object.values(s.units).find(u => u.pos.x === p.x && u.pos.y === p.y);
}
export function isBlocked(s: GameState, p: Pos): boolean {
  return isWall(s.board, p) || occupant(s, p) !== undefined;
}
export function legalMoves(s: GameState, unitId: string): Pos[] {
  const unit = s.units[unitId]!; const start = unit.pos;
  const dist = new Map<string, number>([[keyOf(start), 0]]);
  const queue: Pos[] = [start]; const out: Pos[] = [];
  while (queue.length) {
    const cur = queue.shift()!; const d = dist.get(keyOf(cur))!;
    if (d >= unit.moveRange) continue;
    for (const st of ORTHO) {
      const nx = { x: cur.x + st.x, y: cur.y + st.y };
      if (!inBounds(s.board, nx) || dist.has(keyOf(nx)) || isBlocked(s, nx)) continue;
      dist.set(keyOf(nx), d + 1); queue.push(nx); out.push(nx);
    }
  }
  return out;
}
// Bresenham supercover-ish: walls strictly between from and to block LoS.
export function lineOfSight(s: GameState, from: Pos, to: Pos): boolean {
  let x0 = from.x, y0 = from.y; const x1 = to.x, y1 = to.y;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (!(x0 === x1 && y0 === y1)) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx)  { err += dx; y0 += sy; }
    if (x0 === x1 && y0 === y1) break;           // reached target: endpoints excluded
    if (isWall(s.board, { x: x0, y: y0 })) return false;
  }
  return true;
}
export function traceLine(s: GameState, from: Pos, dir: Dir, range: number): { tiles: Pos[]; hitUnitIds: string[] } {
  const tiles: Pos[] = []; const hitUnitIds: string[] = [];
  for (let i = 1; i <= range; i++) {
    const p = { x: from.x + dir.x * i, y: from.y + dir.y * i };
    if (!inBounds(s.board, p) || isWall(s.board, p)) break; // stop at wall / edge
    tiles.push(p);
    const u = occupant(s, p); if (u) hitUnitIds.push(u.id);  // pierces (does not stop)
  }
  return { tiles, hitUnitIds };
}
```
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(shared): legalMoves + lineOfSight + traceLine (walls block)"`

### Task B1.3: `applyMove`

**Files:** `shared/src/cards.ts` (shared combat internals live here too); test `shared/src/move.test.ts`.

- [ ] **Step 1: Failing test**
```ts
// shared/src/move.test.ts
import { createRoom } from './rooms';
import { applyMove } from './cards';
const rng = () => 0.42;
test('applyMove moves once and sets hasMoved; second move throws', () => {
  const s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng); // p0 at (1,1)
  const n = applyMove(s, 'p0', { x: 3, y: 1 });
  expect(n.units.p0!.pos).toEqual({ x: 3, y: 1 });
  expect(n.units.p0!.hasMoved).toBe(true);
  expect(() => applyMove(n, 'p0', { x: 4, y: 1 })).toThrow();
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement**
```ts
// shared/src/cards.ts  (accumulates B1.3 + B1.4)
import { GameState, Pos } from './types';
import { legalMoves, keyOf } from './board';
export const clone = (s: GameState): GameState => structuredClone(s);
export function requireActivePlayer(s: GameState, id: string): void {
  if (s.phase !== 'player') throw new Error('not player phase');
  if (s.order[s.activeIndex] !== id) throw new Error('not this unit\'s turn');
}
export function applyMove(s: GameState, unitId: string, to: Pos): GameState {
  requireActivePlayer(s, unitId);
  const u = s.units[unitId]!;
  if (u.hasMoved) throw new Error('already moved this turn');
  if (!legalMoves(s, unitId).some(p => keyOf(p) === keyOf(to))) throw new Error('illegal move');
  const n = clone(s); n.units[unitId]!.pos = { ...to }; n.units[unitId]!.hasMoved = true; return n;
}
```
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(shared): applyMove (once per turn, grid-legal)"`

### Task B1.4: `cardTargets` + `playCard` (damage/heal/block · melee/ranged/line/self)

**Files:** extend `shared/src/cards.ts`; test `shared/src/cards.test.ts`.

- [ ] **Step 1: Failing tests**
```ts
// shared/src/cards.test.ts
import { createRoom } from './rooms';
import { cardTargets, playCard } from './cards';
import { keyOf } from './board';
const rng = () => 0.42;
function withMonsterAt(s: any, id: string, pos: any, hp: number) {
  return { ...s, units: { ...s.units, [id]: { ...s.units[id], pos, hp } } };
}
test('melee card targets an adjacent enemy and deals attack+power', () => {
  let s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng); // knight attack 3
  s = withMonsterAt(s, 'm0', { x: 2, y: 1 }, 10); // adjacent to p0 at (1,1)
  s = { ...s, units: { ...s.units, p0: { ...s.units.p0, hand: ['slash'] } } };
  expect(cardTargets(s, 'p0', 'slash').map(keyOf)).toContain(keyOf({ x: 2, y: 1 }));
  const n = playCard(s, 'p0', 'slash', { x: 2, y: 1 }); // 3+2 = 5
  expect(n.units.m0!.hp).toBe(5);
  expect(n.units.p0!.energy).toBe(s.units.p0!.energy - 1);
  expect(n.units.p0!.hand).not.toContain('slash');
  expect(n.units.p0!.discard).toContain('slash');
});
test('line card (vulcan) pierces enemies until a wall', () => {
  let s = createRoom(0, [{ name: 'A', classId: 'wizard' }], rng); // wizard at (1,1)
  s = { ...s, units: { ...s.units, p0: { ...s.units.p0, pos: { x: 3, y: 6 }, hand: ['vulcan'] } } };
  s = withMonsterAt(s, 'm0', { x: 4, y: 6 }, 10);
  s = withMonsterAt(s, 'm1', { x: 5, y: 6 }, 10); // wall at (6,6) stops the line
  const n = playCard(s, 'p0', 'vulcan', { x: 5, y: 6 }); // dir east; 2+2 = 4 to each
  expect(n.units.m0!.hp).toBe(6);
  expect(n.units.m1!.hp).toBe(6);
});
test('block card shields the caster', () => {
  const s0 = createRoom(0, [{ name: 'A', classId: 'knight' }], rng);
  const s = { ...s0, units: { ...s0.units, p0: { ...s0.units.p0, hand: ['block'] } } };
  const n = playCard(s, 'p0', 'block', s.units.p0!.pos);
  expect(n.units.p0!.block).toBe(5);
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement**
```ts
// add to shared/src/cards.ts
import { Unit } from './types';
import { CARDS } from './content/cards';
import { inBounds, isWall, occupant, lineOfSight, traceLine, keyOf as keyOfPos } from './board';
import { ORTHO } from './types';

function damageUnit(s: GameState, id: string, amount: number): void {
  const u = s.units[id]; if (!u) return;
  const absorbed = Math.min(u.block, amount);
  u.block -= absorbed; u.hp -= (amount - absorbed);
  if (u.hp <= 0) delete s.units[id];
}
function enemiesOf(s: GameState, unit: Unit): Unit[] {
  return Object.values(s.units).filter(o => o.team !== unit.team);
}

export function cardTargets(s: GameState, unitId: string, cardId: string): Pos[] {
  const u = s.units[unitId]!; const c = CARDS[cardId]!;
  if (c.shape === 'self') return [u.pos];
  if (c.effect === 'heal') { // allies within range with LoS
    const range = c.range ?? 1;
    return Object.values(s.units).filter(o => o.team === u.team)
      .filter(o => Math.abs(o.pos.x - u.pos.x) + Math.abs(o.pos.y - u.pos.y) <= range)
      .filter(o => lineOfSight(s, u.pos, o.pos)).map(o => ({ ...o.pos }));
  }
  if (c.shape === 'melee') {
    return enemiesOf(s, u).filter(o =>
      Math.abs(o.pos.x - u.pos.x) + Math.abs(o.pos.y - u.pos.y) === 1).map(o => ({ ...o.pos }));
  }
  if (c.shape === 'ranged') {
    const range = c.range ?? 1;
    return enemiesOf(s, u)
      .filter(o => Math.abs(o.pos.x - u.pos.x) + Math.abs(o.pos.y - u.pos.y) <= range)
      .filter(o => lineOfSight(s, u.pos, o.pos)).map(o => ({ ...o.pos }));
  }
  // line: every reachable tile along the 4 orthogonal rays (up to range, stopping at walls)
  const tiles: Pos[] = [];
  for (const dir of ORTHO) tiles.push(...traceLine(s, u.pos, dir, c.range ?? 1).tiles);
  return tiles;
}

export function playCard(s: GameState, unitId: string, cardId: string, target: Pos): GameState {
  requireActivePlayer(s, unitId);
  const u = s.units[unitId]!; const c = CARDS[cardId]!;
  if (!u.hand.includes(cardId)) throw new Error('card not in hand');
  if (u.energy < c.cost) throw new Error('not enough energy');
  if (!cardTargets(s, unitId, cardId).some(p => keyOfPos(p) === keyOfPos(target))) throw new Error('illegal target');
  const n = clone(s);
  const nu = n.units[unitId]!;
  nu.energy -= c.cost;
  nu.hand.splice(nu.hand.indexOf(cardId), 1);
  nu.discard.push(cardId);
  const dmg = nu.attack + c.power;
  if (c.effect === 'block') { nu.block += c.power; }
  else if (c.effect === 'heal') {
    const ally = occupant(n, target); if (ally) ally.hp = Math.min(ally.maxHp, ally.hp + c.power);
  } else if (c.shape === 'line') {
    const dir = { x: Math.sign(target.x - nu.pos.x) as -1|0|1, y: Math.sign(target.y - nu.pos.y) as -1|0|1 };
    const { hitUnitIds } = traceLine(n, nu.pos, dir, c.range ?? 1);
    for (const id of hitUnitIds) if (n.units[id] && n.units[id]!.team !== nu.team) damageUnit(n, id, dmg);
  } else { // melee / ranged single
    const enemy = occupant(n, target); if (enemy && enemy.team !== nu.team) damageUnit(n, enemy.id, dmg);
  }
  return n;
}
```
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(shared): cardTargets + playCard (melee/ranged/line/self, block)"`

### Task B1.5: `startTurn` / `endTurn` / draw+reshuffle / room-clear / defeat

**Files:** `shared/src/turn.ts`; test `shared/src/turn.test.ts`.

- [ ] **Step 1: Failing tests**
```ts
// shared/src/turn.test.ts
import { createRoom } from './rooms';
import { endTurn, isRoomClear, startTurn } from './turn';
import { HAND_SIZE } from './types';
const rng = () => 0.42;
const noMonsters = (s: any) => s;
test('startTurn refills energy, resets move/block, draws to hand size', () => {
  let s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng);
  s = { ...s, units: { ...s.units, p0: { ...s.units.p0, energy: 0, hasMoved: true, block: 3, hand: [] } } };
  const n = startTurn(s, rng);
  expect(n.units.p0!.energy).toBe(n.units.p0!.maxEnergy);
  expect(n.units.p0!.hasMoved).toBe(false);
  expect(n.units.p0!.block).toBe(0);
  expect(n.units.p0!.hand).toHaveLength(HAND_SIZE);
});
test('endTurn on a solo player runs a new round (player phase again)', () => {
  const s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng);
  const n = endTurn(s, noMonsters, rng);
  expect(n.phase).toBe('player');
  expect(n.activeIndex).toBe(0);
});
test('room clears when no monsters remain', () => {
  let s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng);
  s = { ...s, units: { p0: s.units.p0! } };
  const n = endTurn(s, noMonsters, rng);
  expect(isRoomClear(n)).toBe(true);
  expect(n.phase).toBe('roomClear');
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement**
```ts
// shared/src/turn.ts
import { GameState, Unit, HAND_SIZE } from './types';
import { shuffle } from './rng';
const clone = (s: GameState): GameState => structuredClone(s);
function drawTo(u: Unit, n: number, rng: () => number): void {
  while (u.hand.length < n) {
    if (u.deck.length === 0) {
      if (u.discard.length === 0) break;
      u.deck = shuffle(u.discard, rng); u.discard = [];
    }
    u.hand.push(u.deck.shift()!);
  }
}
export function isRoomClear(s: GameState): boolean { return !Object.values(s.units).some(u => u.team === 'monster'); }
export function isDefeat(s: GameState): boolean { return !Object.values(s.units).some(u => u.team === 'player'); }
function settle(s: GameState): GameState {
  if (isDefeat(s)) return { ...s, phase: 'defeat' };
  if (isRoomClear(s)) return { ...s, phase: 'roomClear' };
  return s;
}
export function startTurn(s: GameState, rng: () => number): GameState {
  const n = clone(s);
  const u = n.units[n.order[n.activeIndex]!]; if (!u) return n;
  u.energy = u.maxEnergy; u.hasMoved = false; u.block = 0;
  drawTo(u, HAND_SIZE, rng);
  return n;
}
export function endTurn(s: GameState, runMonsterPhase: (s: GameState) => GameState, rng: () => number): GameState {
  let n = clone(s);
  const cur = n.units[n.order[n.activeIndex]!];
  if (cur) { cur.discard.push(...cur.hand); cur.hand = []; } // discard remaining hand (StS)
  n.activeIndex += 1;
  if (n.activeIndex >= n.order.length) {
    n.phase = 'monster'; n = runMonsterPhase(n); n.activeIndex = 0;
    const settled = settle(n); if (settled.phase !== n.phase) return settled;
    n.phase = 'player';
  }
  const afterClear = settle(n); if (afterClear.phase !== 'player' && afterClear.phase !== n.phase) return afterClear;
  return startTurn(n, rng);
}
```
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(shared): startTurn/endTurn, draw+reshuffle, clear/defeat"`

### Task B1.6: Monster AI phase

**Files:** `shared/src/ai.ts`; test `shared/src/ai.test.ts`.

- [ ] **Step 1: Failing tests**
```ts
// shared/src/ai.test.ts
import { createRoom } from './rooms';
import { runMonsterPhase } from './ai';
const rng = () => 0.42;
test('adjacent monster attacks a player (respecting block)', () => {
  let s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng); // knight 14hp at (1,1)
  s = { ...s, units: { ...s.units, m0: { ...s.units.m0, pos: { x: 2, y: 1 }, attack: 3 } } };
  const n = runMonsterPhase(s);
  expect(n.units.p0!.hp).toBe(11);
});
test('distant monster steps toward nearest player', () => {
  const s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng); // m0 at (13,2)
  const n = runMonsterPhase(s);
  expect(n.units.m0!.pos.x).toBeLessThan(13);
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement**
```ts
// shared/src/ai.ts
import { GameState, Pos, ORTHO } from './types';
import { inBounds, isBlocked } from './board';
const manhattan = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
function nearestPlayer(s: GameState, from: Pos): Pos | undefined {
  const ps = Object.values(s.units).filter(u => u.team === 'player');
  if (!ps.length) return undefined;
  ps.sort((a, b) => manhattan(from, a.pos) - manhattan(from, b.pos));
  return ps[0]!.pos;
}
function damageUnit(s: GameState, id: string, amount: number): void {
  const u = s.units[id]; if (!u) return;
  const absorbed = Math.min(u.block, amount); u.block -= absorbed; u.hp -= (amount - absorbed);
  if (u.hp <= 0) delete s.units[id];
}
export function runMonsterPhase(state: GameState): GameState {
  const s: GameState = structuredClone(state);
  const ids = Object.values(s.units).filter(u => u.team === 'monster').map(u => u.id);
  for (const id of ids) {
    const m = s.units[id]; if (!m) continue;
    const adjPlayer = Object.values(s.units).find(o => o.team === 'player' && manhattan(o.pos, m.pos) === 1);
    if (adjPlayer) { damageUnit(s, adjPlayer.id, m.attack); continue; }
    const goal = nearestPlayer(s, m.pos); if (!goal) continue;
    let best: Pos | undefined; let bestDist = manhattan(m.pos, goal);
    for (const st of ORTHO) {
      const nx = { x: m.pos.x + st.x, y: m.pos.y + st.y };
      if (!inBounds(s.board, nx) || isBlocked(s, nx)) continue;
      const d = manhattan(nx, goal); if (d < bestDist) { bestDist = d; best = nx; }
    }
    if (best) m.pos = best;
  }
  return s;
}
```
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(shared): monster AI phase (approach + attack, block-aware)"`

**Deliver checkpoint:** with B1.1–B1.6 green, notify the frontend agent — `shared` is ready for the hotseat fun-check (their F-M1).

---

# B-M2 — Colyseus server (roadmap → detail after B-M1)
1. Add `colyseus` + `@colyseus/core`; boot HTTP+WS on `process.env.PORT` (default 2567).
2. Colyseus `Schema` projecting `GameState` + lobby. Keep a plain `GameState` as the room's source of truth (call `shared` on it); re-project after each mutation. Inject the room's `rng` (a seeded PRNG) so runs are reproducible server-side.
3. `DungeonRoom`: `onJoin` seats a player; `onMessage('intent')` maps `sessionId→unitId`, verifies ownership + active unit, dispatches `move`→`applyMove`, `playCard`→`playCard`, `endTurn`→`endTurn(…, rng)` in try/catch, rejects on throw.
4. Authority tests: non-owner intent rejected; out-of-turn rejected; a legal `playCard` updates synced state.
5. Integration test: scripted join → move → playCard → clear.

# B-M3 — Lobby server (roadmap)
`phase: 'lobby'→in-game`; `setName`/`setClass`(knight|wizard)/`toggleReady`/`start`(host + all-ready) → `createRoom(0, seated, rng)`. Short join code.

# B-M4 — Progression content + logic (roadmap)
`content/upgrades.ts` (20; effects incl. stat buffs and `addCard`) + `applyUpgrade`; `content/equipment.ts` (15) + `equip` (recompute derived stats); monster `lootTable` drop on kill inside `playCard` (inject rng); `pickUpgrade`/`equip` messages + `reward` phase (roll 3).

# B-M5 — Slop cards + full run content (roadmap)
`content/slopcards.ts` (15) as `RoomModifiers` read by the engine (e.g. Gravity Tax → `moveRangeDelta`, Goblin Union → `monsterHpDelta`, Broken Torch → reduced LoS range). Fill 5 monsters + rooms 1/2/3 (elite + boss stat block). `drawSlopCard(rng)` + `slop` phase. Zod-validate all content at load; a test asserts counts (2 classes / 5 monsters / 20 upgrades / 15 equipment / 15 slop cards + starter-deck card ids resolve).

# B-M6 — Deploy backend (roadmap)
Bind `PORT`; CORS + Colyseus transport allow the Cloudflare origin from env; Railway service (root `server`, `start` = `tsx src/index.ts`, or a Dockerfile); publish the public `wss://` URL to the frontend for `VITE_SERVER_URL`.

---

## Self-Review notes
- **Contract coverage:** every function/message in the contract has an implementing task (B1.x; server/lobby/progression/slop in B-M2..M5). No `any` in shown code.
- **Determinism:** `shuffle`, `createRoom`, `startTurn`, `endTurn` all take injected `rng`; tests pass a fixed rng and assert sizes/effects, not deck order (non-brittle).
- **Obstacle rules unified:** walls block movement (`isBlocked`), ranged LoS (`lineOfSight`), and line paths (`traceLine`) — one source each, reused by `cardTargets`/`playCard`.
- **Type consistency:** `Unit` (with `energy/block/hasMoved/deck/hand/discard`), `GameState`, `Dir`/`ORTHO`, `HAND_SIZE` defined once in B1.1 and used verbatim through B1.2–B1.6, server (B-M2), and the frontend hotseat.
