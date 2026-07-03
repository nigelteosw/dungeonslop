# Dungeonslop v0 — FRONTEND Plan (`client` + Cloudflare)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Parallel work:** This is one of two plans (see also `2026-07-04-dungeonslop-backend.md`). The two share the **Shared Contract** section below — identical in both files. **Backend owns the contract** (`shared` API + Colyseus protocol); this plan consumes it. You can build ALL rendering/UI immediately against fixtures + the contract types; you only need the backend's `shared` package to run the live hotseat fun-check, and the `server` to test real multiplayer.

**Goal:** A browser client that renders the game and drives it — an 8×8 tactical board with click-to-act, a lobby, and reward/inventory screens — first playable single-device (hotseat), then wired to the Colyseus server, deployed to Cloudflare Pages.

**Architecture:** `BoardView` and the screens are **presentational** — they take a `GameState` (and lobby state) plus callbacks, and never compute game outcomes. A swappable **driver** supplies state + actions: `useHotseatGame` (imports `shared` directly, single-device) or `useColyseusGame` (network). Swapping the driver is the only change between hotseat and multiplayer.

**Tech Stack:** TypeScript (`strict`) · Vite + React 18 · `colyseus.js` · pnpm workspace. Deploy: Cloudflare Pages.

## Global Constraints

- **TypeScript `strict: true`.**
- **Client never decides outcomes.** It renders the `GameState` it's given and sends intents. All legality/damage/AP logic comes from `shared` (hotseat) or the server (multiplayer).
- **Server URL from `import.meta.env.VITE_SERVER_URL`** — never hardcode `localhost` (fall back to `ws://localhost:2567` only via the env default).
- **Presentational components take state + callbacks**; drivers are the only place that touches `shared`/network.
- **Node 20+ · pnpm 9+.** Test command: `pnpm test` from repo root.
- **Commit after every task.**

**Ordering dependency (only one):** the root workspace must exist before the `client` package installs — that is Backend Task **B0.1**. If you start before the backend agent has run it, create the root files from the Shared Contract plan's B0.1 yourself, then continue.

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
drawSlopCard(rng: () => number): string
```

### Colyseus network protocol (Backend implements · Frontend consumes)

- **Room name:** `"dungeon"`. Each `sessionId` maps to one player unit id (learned via `mySessionId`).
- **Client → Server:** lobby `setName {name}` · `setClass {classId}` · `toggleReady` · `start`; game `intent {kind:'move', to:{x,y}}` · `intent {kind:'attack', targetId}` · `intent {kind:'skill', targetId}` · `intent {kind:'endTurn'}`; rewards `pickUpgrade {upgradeId}` · `equip {itemId}`.
- **Server → Client (synced state):** `phase` · `players[] {sessionId,name,classId,ready}` · `units{}` · `board` · `order[]` · `activeIndex` · `roomIndex` · `currentSlopCardId` · `rewardOptions[]`.
- **Authority:** the server rejects illegal/out-of-turn/non-owner intents. The client shows only legal affordances but must tolerate rejection (state simply won't change).

---

# F-M0 — Client scaffold

**Deliverable:** `pnpm --filter client dev` serves a React page that imports from `shared`. (Requires Backend B0.1 root workspace.)

### Task F0.1: Create the `client` package

**Files:** Create `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/index.html`, `client/src/main.tsx`, `client/src/App.tsx`, `client/src/vite-env.d.ts`.

**Interfaces:** Produces a runnable Vite app; `import.meta.env.VITE_SERVER_URL` typed.

- [ ] **Step 1: Create package files**

```json
// client/package.json
{ "name": "client", "version": "0.0.0", "private": true, "type": "module",
  "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview" },
  "dependencies": { "react": "^18.3.0", "react-dom": "^18.3.0", "colyseus.js": "^0.15.0", "shared": "workspace:*" },
  "devDependencies": { "@vitejs/plugin-react": "^4.3.0", "vite": "^5.3.0",
    "@types/react": "^18.3.0", "@types/react-dom": "^18.3.0" } }
```
```ts
// client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()] });
```
```json
// client/tsconfig.json
{ "extends": "../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022", "DOM", "DOM.Iterable"] },
  "include": ["src"] }
```
```ts
// client/src/vite-env.d.ts
/// <reference types="vite/client" />
interface ImportMetaEnv { readonly VITE_SERVER_URL: string; }
interface ImportMeta { readonly env: ImportMetaEnv; }
```
```html
<!-- client/index.html -->
<!doctype html><html><head><meta charset="utf-8" /><title>Dungeonslop</title></head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
```
```tsx
// client/src/main.tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';
createRoot(document.getElementById('root')!).render(<App />);
```
```tsx
// client/src/App.tsx
export function App() { return <h1 style={{ fontFamily: 'system-ui', padding: 24 }}>Dungeonslop</h1>; }
```

- [ ] **Step 2: Install + run** — `pnpm install && pnpm --filter client dev` → see "Dungeonslop". Stop the server.
- [ ] **Step 3: Commit** — `git add client && git commit -m "chore(client): scaffold Vite React app"`

---

# F-M1 — Board rendering + hotseat (the fun-check)

**Deliverable:** the playable single-device board. Build the presentational `BoardView` against a **fixture** first (no dependency on backend), then wire the hotseat driver once `shared` lands (Backend B1.x). This is the fun-check.

### Task F1.1: Fixtures + presentational `BoardView`

**Files:** Create `client/src/game/fixtures.ts`, `client/src/game/BoardView.tsx`, `client/src/game/board.css`; modify `client/src/App.tsx`. Test: `client/src/game/BoardView.test.tsx` (optional — see Step 1).

**Interfaces:** `BoardView` props — presentational, driver-agnostic:

```ts
interface BoardViewProps {
  state: GameState;             // from shared contract types
  activeId: string;
  mode: 'move' | 'attack' | 'skill';
  legalMoveKeys: Set<string>;   // keyOf(pos) of legal move tiles
  attackTargetIds: string[];    // unit ids attackable now
  onTile: (p: Pos) => void;
}
```

- [ ] **Step 1: Fixture (works with zero backend)**

```ts
// client/src/game/fixtures.ts
import type { GameState } from 'shared';
export const FIXTURE: GameState = {
  board: { width: 8, height: 8, walls: [{ x: 3, y: 3 }, { x: 4, y: 3 }], exit: { x: 7, y: 7 } },
  units: {
    p0: { id: 'p0', team: 'player', name: 'P1', defId: 'knight', pos: { x: 0, y: 0 }, hp: 12, maxHp: 12, moveRange: 3, attack: 4, ap: 2 },
    m0: { id: 'm0', team: 'monster', name: 'Goblin', defId: 'goblin', pos: { x: 6, y: 1 }, hp: 5, maxHp: 5, moveRange: 3, attack: 2, ap: 0 },
  },
  order: ['p0'], activeIndex: 0, phase: 'player', roomIndex: 0,
};
```
> Note: `import type { GameState } from 'shared'` needs the backend's `shared` types. If they haven't landed yet, temporarily inline a local `GameState` type copied from the Shared Contract, then switch to the import on integration.

- [ ] **Step 2: Presentational `BoardView`** — renders tiles from `state.board`, overlays units, highlights `legalMoveKeys` / attack targets, calls `onTile`. Contains **no game logic**.

```tsx
// client/src/game/BoardView.tsx
import type { GameState, Pos } from 'shared';
import { keyOf } from 'shared';
import './board.css';

interface Props {
  state: GameState; activeId: string; mode: 'move' | 'attack' | 'skill';
  legalMoveKeys: Set<string>; attackTargetIds: string[]; onTile: (p: Pos) => void;
}
export function BoardView({ state, activeId, mode, legalMoveKeys, attackTargetIds, onTile }: Props) {
  const attackPosKeys = new Set(attackTargetIds.map(id => keyOf(state.units[id]!.pos)));
  const tiles = [];
  for (let y = 0; y < state.board.height; y++) for (let x = 0; x < state.board.width; x++) {
    const p = { x, y }; const k = keyOf(p);
    const unit = Object.values(state.units).find(u => u.pos.x === x && u.pos.y === y);
    const wall = state.board.walls.some(w => w.x === x && w.y === y);
    const cls = ['tile', wall ? 'wall' : '',
      mode === 'move' && legalMoveKeys.has(k) ? 'legal-move' : '',
      mode !== 'move' && attackPosKeys.has(k) ? 'legal-attack' : '',
      unit ? `unit ${unit.team}` : '', unit?.id === activeId ? 'active' : ''].join(' ');
    tiles.push(<div key={k} className={cls} onClick={() => onTile(p)}>{unit ? `${unit.name[0]}${unit.hp}` : ''}</div>);
  }
  return <div className="board">{tiles}</div>;
}
```
```css
/* client/src/game/board.css */
.board { display: grid; grid-template-columns: repeat(8, 48px); gap: 2px; }
.tile { width: 48px; height: 48px; background: #222; color: #eee; display: flex; align-items: center;
  justify-content: center; font: 12px monospace; cursor: pointer; user-select: none; }
.tile.wall { background: #555; cursor: default; }
.tile.legal-move { outline: 2px solid #3b82f6; }
.tile.legal-attack { outline: 2px solid #ef4444; }
.tile.unit.player { background: #1d4ed8; }
.tile.unit.monster { background: #b91c1c; }
.tile.active { box-shadow: inset 0 0 0 3px gold; }
```

- [ ] **Step 3: Render the fixture in App** to verify visuals standalone:

```tsx
// client/src/App.tsx
import { useState } from 'react';
import { keyOf } from 'shared';
import { BoardView } from './game/BoardView';
import { FIXTURE } from './game/fixtures';
export function App() {
  const [mode] = useState<'move' | 'attack' | 'skill'>('move');
  const legal = new Set([keyOf({ x: 1, y: 0 }), keyOf({ x: 0, y: 1 })]);
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>Dungeonslop — board preview</h1>
      <BoardView state={FIXTURE} activeId="p0" mode={mode} legalMoveKeys={legal} attackTargetIds={[]} onTile={(p) => console.log('tile', p)} />
    </div>
  );
}
```

- [ ] **Step 4: Run** — `pnpm --filter client dev` → see the board + a range-3 knight, highlighted tiles, a goblin. **The board renders with zero backend.** Stop.
- [ ] **Step 5: Commit** — `git add client/src && git commit -m "feat(client): presentational BoardView + fixture preview"`

### Task F1.2: Hotseat driver + controls (needs Backend B1.x `shared`)

**Files:** Create `client/src/game/useHotseatGame.ts`, `client/src/game/GameScreen.tsx`; modify `client/src/App.tsx`.

**Interfaces:** `useHotseatGame()` returns `{ state, activeId, legalMoveKeys, attackTargetIds, move, attack, skill, endTurn, reset }`. `GameScreen` composes the driver + `BoardView` + mode buttons.

- [ ] **Step 1: Hotseat driver (imports `shared`)**

```ts
// client/src/game/useHotseatGame.ts
import { useState } from 'react';
import { createRoom, applyMove, applyAttack, applySkill, endTurn, legalMoves, legalAttacks,
  runMonsterPhase, keyOf, type GameState, type Pos } from 'shared';
const seed = [{ name: 'P1', classId: 'knight' }, { name: 'P2', classId: 'archer' }];
export function useHotseatGame() {
  const [state, setState] = useState<GameState>(() => createRoom(0, seed));
  const activeId = state.order[state.activeIndex]!;
  return {
    state, activeId,
    legalMoveKeys: new Set(legalMoves(state, activeId).map(keyOf)),
    attackTargetIds: legalAttacks(state, activeId),
    move: (to: Pos) => setState(s => applyMove(s, activeId, to)),
    attack: (t: string) => setState(s => applyAttack(s, activeId, t)),
    skill: (t: string) => setState(s => applySkill(s, activeId, t)),
    endTurn: () => setState(s => endTurn(s, runMonsterPhase)),
    reset: () => setState(createRoom(0, seed)),
  };
}
```

- [ ] **Step 2: `GameScreen` wires driver → BoardView**

```tsx
// client/src/game/GameScreen.tsx
import { useState } from 'react';
import { keyOf } from 'shared';
import { BoardView } from './BoardView';
import { useHotseatGame } from './useHotseatGame';
export function GameScreen() {
  const g = useHotseatGame();
  const [mode, setMode] = useState<'move' | 'attack' | 'skill'>('move');
  const done = g.state.phase === 'roomClear' || g.state.phase === 'defeat';
  const onTile = (p: { x: number; y: number }) => {
    const k = keyOf(p);
    if (mode === 'move' && g.legalMoveKeys.has(k)) return g.move(p);
    const target = g.attackTargetIds.find(id => keyOf(g.state.units[id]!.pos) === k);
    if (target && mode === 'attack') g.attack(target);
    if (target && mode === 'skill') g.skill(target);
  };
  return (
    <div>
      <p>Phase: {g.state.phase} · Active: {g.state.units[g.activeId]?.name} · AP: {g.state.units[g.activeId]?.ap}</p>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <button onClick={() => setMode('move')}>Move</button>
        <button onClick={() => setMode('attack')}>Attack</button>
        <button onClick={() => setMode('skill')}>Skill</button>
        <button onClick={g.endTurn}>End Turn</button>
        {done && <><strong>{g.state.phase === 'roomClear' ? 'ROOM CLEAR!' : 'DEFEATED'}</strong><button onClick={g.reset}>Reset</button></>}
      </div>
      <BoardView state={g.state} activeId={g.activeId} mode={mode}
        legalMoveKeys={g.legalMoveKeys} attackTargetIds={g.attackTargetIds} onTile={onTile} />
    </div>
  );
}
```

- [ ] **Step 3: Mount `GameScreen`** in `App.tsx` (replace the preview).
- [ ] **Step 4: Play the fun-check** — `pnpm --filter client dev`. Full loop: move, attack, skill, End Turn ×2, watch monster AI, clear room → "ROOM CLEAR!"; try losing. **Is it fun? Note gaps before multiplayer.**
- [ ] **Step 5: Commit** — `git commit -am "feat(client): hotseat playable board (fun-check)"`

---

# F-M2 — Colyseus driver (roadmap → detail after F-M1 + Backend B-M2)

**Deliverable:** `BoardView`/`GameScreen` unchanged, driven by the live server across 2+ browsers.

**Tasks:**
1. `useColyseusGame()` — connect via `colyseus.js` to `import.meta.env.VITE_SERVER_URL`, join `"dungeon"`, subscribe to synced state, expose the same shape as `useHotseatGame` but with `move/attack/skill/endTurn` sending `intent` messages instead of calling `shared`.
2. Learn own unit id via `mySessionId`; disable controls when it isn't your turn; tolerate rejected intents (no local mutation).
3. Swap `GameScreen` to accept a driver so hotseat and Colyseus are interchangeable.
4. Manual test: two browser tabs share one room and alternate turns.

# F-M3 — Lobby UI (roadmap)
Screens by `phase`: `CreateOrJoin` (enter code) → `Lobby` (roster, name input, class picker for the 2 classes, ready toggle, host Start) → `GameScreen`. Simple state-based routing (no react-router). Sends `setName`/`setClass`/`toggleReady`/`start`.

# F-M4 — Reward + inventory UI (roadmap)
`RewardScreen` (pick 1 of 3 `rewardOptions`, send `pickUpgrade`); minimal inventory panel listing `unit.inventory` with equip buttons (send `equip`) and current weapon/armor/trinket. List + button, no drag-drop.

# F-M5 — Slop card reveal (roadmap)
`SlopScreen` shown on `phase === 'slop'` — render `SLOP_CARDS[currentSlopCardId]` (name + description) with a Continue button before the reward screen.

# F-M6 — Deploy frontend (roadmap)
Set `VITE_SERVER_URL` to the backend's Railway `wss://` URL; `pnpm --filter client build`; Cloudflare Pages project (build command `pnpm --filter client build`, output dir `client/dist`, root of repo). Smoke test two devices on the live URLs.

---

## Self-Review notes
- **Standalone-first:** F0.1 + F1.1 need no backend (fixture + inline type fallback). Only F1.2 onward consume the real `shared`/`server`.
- **Presentational boundary:** `BoardView` and screens take state + callbacks; only drivers (`useHotseatGame`, `useColyseusGame`) touch `shared`/network — so the hotseat→multiplayer swap is one component.
- **Contract fidelity:** all consumed types/functions/messages match the Shared Contract verbatim; `keyOf`, `GameState`, `Pos`, phase names, and intent shapes align with the backend plan.
- **Env rule:** server URL only ever from `VITE_SERVER_URL`; never hardcoded.
