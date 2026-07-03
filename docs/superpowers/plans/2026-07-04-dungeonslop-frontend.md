# Dungeonslop v0 — FRONTEND Plan (`client` 3D iso + card hand + Cloudflare)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> **Parallel work:** one of two plans (see `2026-07-04-dungeonslop-backend.md`). Both share the **Shared Contract** below — identical in each file. **Backend owns the contract**; this plan consumes it. You can build ALL rendering/UI against fixtures + the contract types immediately; you only need the backend's `shared` package to run the live hotseat, and the `server` for real multiplayer.

**Goal:** a browser client that renders the game in 3D and drives it — a 16×16 tactical board on a fixed XCOM 45° isometric camera with simple low-poly Knight/Wizard/monster models, a Slay-the-Spire card hand, click-to-move and card→grid-target — first playable single-device (hotseat), then wired to Colyseus, deployed to Cloudflare Pages.

**Architecture:** the 3D scene and card hand are **presentational** — they take `GameState` + callbacks and never compute outcomes. A swappable **driver** supplies state + actions: `useHotseatGame` (imports `shared`) or `useColyseusGame` (network). The r3f render tech is invisible to `shared` — the board is just grid data.

**Tech Stack:** TypeScript (`strict`) · Vite + React 18 · `three` + `@react-three/fiber` + `@react-three/drei` · `colyseus.js` · pnpm workspace. Deploy: Cloudflare Pages.

## Global Constraints

- **TS `strict: true`.**
- **Client never decides outcomes** — renders given `GameState`, sends intents; all legality/damage from `shared` (hotseat) or server.
- **Server URL from `import.meta.env.VITE_SERVER_URL`** — never hardcode `localhost` (env default only).
- **Presentational components take state + callbacks**; only drivers touch `shared`/network.
- **Board is 16×16.** Fixed isometric orthographic camera (no free camera in v0).
- **Node 20+ · pnpm 9+.** Test: `pnpm test`. **Commit after every task.**

**Ordering dependency (only one):** the root workspace must exist before `client` installs — Backend Task **B0.1**. If starting first, create the root files from the Shared Contract plan's B0.1 yourself.

---

## Shared Contract (v0) — identical in both plans

### `shared` public API (Backend implements · Frontend consumes)

```ts
// Types
interface Pos { x: number; y: number; }
type Team = 'player' | 'monster';
interface Unit { id: string; team: Team; name: string; defId: string; pos: Pos;
  hp: number; maxHp: number; moveRange: number; attack: number;
  energy: number; maxEnergy: number; block: number; hasMoved: boolean;
  deck: string[]; hand: string[]; discard: string[];
  inventory?: string[]; equipment?: { weapon?: string; armor?: string; trinket?: string }; }
interface Board { width: number; height: number; walls: Pos[]; exit: Pos; } // 16×16
type Phase = 'lobby'|'player'|'monster'|'slop'|'reward'|'roomClear'|'defeat';
interface GameState { board: Board; units: Record<string, Unit>; order: string[];
  activeIndex: number; phase: Phase; roomIndex: number; modifiers?: RoomModifiers; }
const HAND_SIZE = 5;

// Content: CLASSES, MONSTERS, CARDS (+ UPGRADES, EQUIPMENT, SLOP_CARDS in M4/M5)
//   CardDef { id,name,cost, effect:'damage'|'heal'|'block', shape:'melee'|'ranged'|'line'|'self', power, range? }

// Pure functions (illegal actions THROW):
createRoom(roomIndex, playerSeed:{name,classId}[], rng:()=>number): GameState
keyOf(p): string · inBounds(b,p) · isWall(b,p) · isBlocked(s,p) · occupant(s,p)
legalMoves(s, unitId): Pos[]
applyMove(s, unitId, to): GameState
lineOfSight(s, from, to): boolean · traceLine(s, from, dir, range): {tiles, hitUnitIds}
cardTargets(s, unitId, cardId): Pos[]
playCard(s, unitId, cardId, target): GameState
startTurn(s, rng): GameState · endTurn(s, runMonsterPhase, rng): GameState
runMonsterPhase(s): GameState · isRoomClear(s) · isDefeat(s)
```

### Colyseus network protocol (Backend implements · Frontend consumes)

- **Room:** `"dungeon"`; each `sessionId` ↔ one player unit (`mySessionId`).
- **Client → Server:** lobby `setName`/`setClass`(knight|wizard)/`toggleReady`/`start`; game `intent {kind:'move', to}` · `intent {kind:'playCard', cardId, target}` · `intent {kind:'endTurn'}`; rewards `pickUpgrade`/`equip`.
- **Server → Client (synced):** `phase` · `players[]` · `units{}` · `board` · `order[]` · `activeIndex` · `roomIndex` · `currentSlopCardId` · `rewardOptions[]`.
- **Authority:** server rejects illegal/out-of-turn/non-owner intents; the client shows only legal affordances but tolerates rejection (state simply won't change).

---

# F-M0 — Client scaffold (r3f)

**Deliverable:** `pnpm --filter client dev` serves a React+r3f page importing from `shared`. (Requires Backend B0.1.)

### Task F0.1: Create the `client` package

**Files:** `client/{package.json,tsconfig.json,vite.config.ts,index.html}`, `client/src/{main.tsx,App.tsx,vite-env.d.ts}`.

- [ ] **Step 1: Create files**
```json
// client/package.json
{ "name": "client", "version": "0.0.0", "private": true, "type": "module",
  "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview" },
  "dependencies": { "react": "^18.3.0", "react-dom": "^18.3.0",
    "three": "^0.167.0", "@react-three/fiber": "^8.17.0", "@react-three/drei": "^9.109.0",
    "colyseus.js": "^0.15.0", "shared": "workspace:*" },
  "devDependencies": { "@vitejs/plugin-react": "^4.3.0", "vite": "^5.3.0",
    "@types/react": "^18.3.0", "@types/react-dom": "^18.3.0", "@types/three": "^0.167.0" } }
```
```ts
// client/vite.config.ts
import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()] });
```
```json
// client/tsconfig.json
{ "extends": "../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022", "DOM", "DOM.Iterable"], "types": ["@react-three/fiber"] },
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
<!doctype html><html><head><meta charset="utf-8" /><title>Dungeonslop</title>
<style>html,body,#root{margin:0;height:100%;background:#0b0b12;color:#eee;font-family:system-ui}</style>
</head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
```
```tsx
// client/src/main.tsx
import { createRoot } from 'react-dom/client'; import { App } from './App';
createRoot(document.getElementById('root')!).render(<App />);
```
```tsx
// client/src/App.tsx
export function App() { return <h1 style={{ padding: 24 }}>Dungeonslop</h1>; }
```
- [ ] **Step 2: Install + run** — `pnpm install && pnpm --filter client dev` → see "Dungeonslop". Stop.
- [ ] **Step 3: Commit** — `git add client && git commit -m "chore(client): scaffold Vite + r3f app"`

---

# F-M1 — Iso board + models + card hand + hotseat (fun-check)

**Deliverable:** the playable single-device game in 3D. Build the presentational scene against a **fixture** first (no backend), then wire the hotseat driver once `shared` lands (Backend B1.x). This is the fun-check.

### Task F1.1: Fixture + isometric board scene

**Files:** `client/src/game/fixtures.ts`, `client/src/game/gridToWorld.ts`, `client/src/game/BoardScene.tsx`; modify `client/src/App.tsx`. Test: `client/src/game/gridToWorld.test.ts`.

**Interfaces:** `BoardScene` is presentational:
```ts
interface BoardSceneProps {
  state: GameState; activeId: string;
  highlightKeys: Set<string>;          // keyOf(pos) tiles to highlight (move tiles or card targets)
  onTileClick: (p: Pos) => void;
}
```

- [ ] **Step 1: gridToWorld helper + test** (grid (x,y) → three world (x,0,y); the only pure math worth a unit test)
```ts
// client/src/game/gridToWorld.ts
import type { Pos } from 'shared';
export const TILE = 1;
export function gridToWorld(p: Pos): [number, number, number] { return [p.x * TILE, 0, p.y * TILE]; }
export function boardCenter(w: number, h: number): [number, number, number] { return [(w - 1) / 2, 0, (h - 1) / 2]; }
```
```ts
// client/src/game/gridToWorld.test.ts
import { gridToWorld, boardCenter } from './gridToWorld';
test('gridToWorld maps grid to x/z plane', () => { expect(gridToWorld({ x: 3, y: 5 })).toEqual([3, 0, 5]); });
test('boardCenter of 16×16', () => { expect(boardCenter(16, 16)).toEqual([7.5, 0, 7.5]); });
```
- [ ] **Step 2: Fixture (zero backend)**
```ts
// client/src/game/fixtures.ts
import type { GameState } from 'shared';
export const FIXTURE: GameState = {
  board: { width: 16, height: 16,
    walls: [{x:6,y:6},{x:7,y:6},{x:8,y:6},{x:9,y:6},{x:6,y:9},{x:7,y:9},{x:8,y:9},{x:9,y:9}],
    exit: { x: 15, y: 15 } },
  units: {
    p0: { id:'p0', team:'player', name:'Knight', defId:'knight', pos:{x:1,y:1}, hp:14, maxHp:14, moveRange:4, attack:3, energy:3, maxEnergy:3, block:0, hasMoved:false, deck:[], hand:['slash','block','cleave'], discard:[] },
    m0: { id:'m0', team:'monster', name:'Goblin', defId:'goblin', pos:{x:13,y:2}, hp:6, maxHp:6, moveRange:4, attack:3, energy:0, maxEnergy:0, block:0, hasMoved:false, deck:[], hand:[], discard:[] },
  },
  order: ['p0'], activeIndex: 0, phase: 'player', roomIndex: 0,
};
```
> If `shared` types aren't published yet, inline a local `GameState` type from the contract, then switch to the import on integration.

- [ ] **Step 3: BoardScene — iso camera, floor tiles, walls, exit, units-as-boxes (models come in F1.2)**
```tsx
// client/src/game/BoardScene.tsx
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import type { GameState, Pos } from 'shared';
import { keyOf } from 'shared';
import { gridToWorld, boardCenter } from './gridToWorld';

interface Props { state: GameState; activeId: string; highlightKeys: Set<string>; onTileClick: (p: Pos) => void; }

export function BoardScene({ state, activeId, highlightKeys, onTileClick }: Props) {
  const { board } = state;
  const [cx, , cz] = boardCenter(board.width, board.height);
  const tiles: Pos[] = [];
  for (let y = 0; y < board.height; y++) for (let x = 0; x < board.width; x++) tiles.push({ x, y });
  const wallKeys = new Set(board.walls.map(keyOf));
  return (
    <Canvas style={{ position: 'absolute', inset: 0 }}>
      {/* Fixed isometric: orthographic camera offset equally on X/Z, elevated → XCOM 45° look */}
      <OrthographicCamera makeDefault position={[cx + 14, 18, cz + 14]} zoom={34} onUpdate={(c) => c.lookAt(cx, 0, cz)} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 6]} intensity={1.1} />
      {tiles.map((p) => {
        const k = keyOf(p); const isWall = wallKeys.has(k);
        const isExit = board.exit.x === p.x && board.exit.y === p.y;
        const hl = highlightKeys.has(k);
        const [wx, , wz] = gridToWorld(p);
        return (
          <mesh key={k} position={[wx, isWall ? 0.5 : 0, wz]}
            onClick={(e) => { e.stopPropagation(); if (!isWall) onTileClick(p); }}>
            <boxGeometry args={[0.94, isWall ? 1 : 0.2, 0.94]} />
            <meshStandardMaterial color={isWall ? '#4b5563' : isExit ? '#a16207' : hl ? '#2563eb' : '#20232e'} />
          </mesh>
        );
      })}
      {Object.values(state.units).map((u) => {
        const [wx, , wz] = gridToWorld(u.pos);
        return (
          <mesh key={u.id} position={[wx, 0.6, wz]}>
            <boxGeometry args={[0.5, 1, 0.5]} />
            <meshStandardMaterial color={u.team === 'player' ? (u.id === activeId ? '#22d3ee' : '#3b82f6') : '#ef4444'} />
          </mesh>
        );
      })}
    </Canvas>
  );
}
```
- [ ] **Step 4: Render the fixture** in `App.tsx` with a couple of highlighted tiles; `pnpm --filter client dev` → **the 16×16 iso board renders in 3D with zero backend**, walls raised, exit lit, knight cyan, goblin red. Stop.
```tsx
// client/src/App.tsx
import { keyOf } from 'shared';
import { BoardScene } from './game/BoardScene';
import { FIXTURE } from './game/fixtures';
export function App() {
  const hl = new Set([keyOf({ x: 2, y: 1 }), keyOf({ x: 1, y: 2 })]);
  return <BoardScene state={FIXTURE} activeId="p0" highlightKeys={hl} onTileClick={(p) => console.log('tile', p)} />;
}
```
- [ ] **Step 5: Commit** — `git commit -am "feat(client): isometric 3D BoardScene + fixture"`

### Task F1.2: Low-poly Knight / Wizard / monster models

**Files:** `client/src/game/models/{KnightModel,WizardModel,MonsterModel,UnitModel}.tsx`; modify `BoardScene.tsx` to use `UnitModel`.

**Interfaces:** each model is a `<group>` of primitives, prop `color: string`. `UnitModel` picks the model by `unit.defId`/`team`.

- [ ] **Step 1: Build primitive models**
```tsx
// client/src/game/models/KnightModel.tsx  (blocky armored figure + helm + sword)
export function KnightModel({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.35, 0]}><boxGeometry args={[0.45, 0.6, 0.3]} /><meshStandardMaterial color={color} metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 0.8, 0]}><boxGeometry args={[0.28, 0.28, 0.28]} /><meshStandardMaterial color="#cbd5e1" metalness={0.7} /></mesh>
      <mesh position={[0.3, 0.5, 0]} rotation={[0, 0, Math.PI / 12]}><boxGeometry args={[0.06, 0.7, 0.06]} /><meshStandardMaterial color="#e5e7eb" metalness={0.9} /></mesh>
    </group>
  );
}
```
```tsx
// client/src/game/models/WizardModel.tsx  (robe cone + pointed hat + staff)
export function WizardModel({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.4, 0]}><coneGeometry args={[0.32, 0.8, 8]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
      <mesh position={[0, 0.85, 0]}><sphereGeometry args={[0.14, 12, 12]} /><meshStandardMaterial color="#f1c27d" /></mesh>
      <mesh position={[0, 1.15, 0]}><coneGeometry args={[0.16, 0.5, 8]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0.28, 0.55, 0]}><cylinderGeometry args={[0.03, 0.03, 1.0, 6]} /><meshStandardMaterial color="#8b5a2b" /></mesh>
    </group>
  );
}
```
```tsx
// client/src/game/models/MonsterModel.tsx  (goblin: small green figure; slime: squashed sphere)
export function MonsterModel({ defId, color }: { defId: string; color: string }) {
  if (defId === 'slime') return (<mesh position={[0, 0.25, 0]} scale={[1, 0.6, 1]}><sphereGeometry args={[0.35, 16, 16]} /><meshStandardMaterial color={color} /></mesh>);
  return (
    <group>
      <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.4, 0.5, 0.3]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 0.62, 0]}><sphereGeometry args={[0.16, 12, 12]} /><meshStandardMaterial color={color} /></mesh>
    </group>
  );
}
```
```tsx
// client/src/game/models/UnitModel.tsx
import type { Unit } from 'shared';
import { KnightModel } from './KnightModel'; import { WizardModel } from './WizardModel'; import { MonsterModel } from './MonsterModel';
export function UnitModel({ unit, active }: { unit: Unit; active: boolean }) {
  const teamColor = unit.team === 'player' ? (active ? '#22d3ee' : '#2563eb') : '#16a34a';
  if (unit.team === 'monster') return <MonsterModel defId={unit.defId} color="#4ade80" />;
  return unit.defId === 'wizard' ? <WizardModel color={teamColor} /> : <KnightModel color={teamColor} />;
}
```
- [ ] **Step 2: Use `UnitModel` in `BoardScene`** — replace the unit `<mesh>` with `<group position={[wx,0,wz]}><UnitModel unit={u} active={u.id===activeId} /></group>`, plus a small HP sprite/text via drei `<Html>` or a thin bar mesh (optional in v0).
- [ ] **Step 3: Run** — knight, wizard, goblin visibly distinct low-poly models on the iso board. Stop.
- [ ] **Step 4: Commit** — `git commit -am "feat(client): low-poly Knight/Wizard/monster models"`

### Task F1.3: Slay-the-Spire card hand overlay

**Files:** `client/src/game/CardHand.tsx`, `client/src/game/cardHand.css`.

**Interfaces:** presentational:
```ts
interface CardHandProps {
  hand: string[]; energy: number; maxEnergy: number;
  selectedCardId: string | null;
  onSelectCard: (cardId: string | null) => void;
  onEndTurn: () => void;
  disabled: boolean;             // true when not this client's/active turn
}
```

- [ ] **Step 1: Build the fan-out hand (DOM overlay over the canvas)**
```tsx
// client/src/game/CardHand.tsx
import { CARDS } from 'shared';
import './cardHand.css';
interface Props { hand: string[]; energy: number; maxEnergy: number; selectedCardId: string | null;
  onSelectCard: (id: string | null) => void; onEndTurn: () => void; disabled: boolean; }
export function CardHand({ hand, energy, maxEnergy, selectedCardId, onSelectCard, onEndTurn, disabled }: Props) {
  return (
    <div className="hand-bar">
      <div className="energy">⚡ {energy}/{maxEnergy}</div>
      <div className="fan">
        {hand.map((id, i) => {
          const c = CARDS[id]!; const affordable = energy >= c.cost && !disabled;
          const sel = selectedCardId === id;
          const angle = (i - (hand.length - 1) / 2) * 6;
          return (
            <button key={`${id}-${i}`} className={`card ${sel ? 'sel' : ''} ${affordable ? '' : 'dim'}`}
              style={{ transform: `rotate(${angle}deg) translateY(${sel ? -18 : 0}px)` }}
              disabled={!affordable}
              onClick={() => onSelectCard(sel ? null : id)}>
              <div className="cost">{c.cost}</div>
              <div className="name">{c.name}</div>
              <div className="meta">{c.effect} · {c.shape}{c.range ? ` ${c.range}` : ''} · {c.power}</div>
            </button>
          );
        })}
      </div>
      <button className="end-turn" onClick={onEndTurn} disabled={disabled}>End Turn</button>
    </div>
  );
}
```
```css
/* client/src/game/cardHand.css */
.hand-bar { position: absolute; bottom: 0; left: 0; right: 0; display: flex; align-items: flex-end;
  justify-content: center; gap: 16px; padding: 12px; pointer-events: none; }
.hand-bar > * { pointer-events: auto; }
.energy { align-self: center; font: 700 18px system-ui; color: #fde68a; }
.fan { display: flex; align-items: flex-end; }
.card { width: 96px; height: 132px; margin: 0 -8px; border: 2px solid #334155; border-radius: 10px;
  background: linear-gradient(#1f2937, #111827); color: #e5e7eb; cursor: pointer; transform-origin: bottom center;
  transition: transform .12s; display: flex; flex-direction: column; padding: 6px; }
.card.sel { border-color: #22d3ee; box-shadow: 0 0 12px #22d3ee; }
.card.dim { opacity: .45; cursor: not-allowed; }
.card .cost { align-self: flex-start; background: #fbbf24; color: #111; border-radius: 50%; width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center; font-weight: 700; }
.card .name { margin-top: 8px; font-weight: 700; font-size: 13px; }
.card .meta { margin-top: auto; font-size: 10px; color: #94a3b8; }
.end-turn { align-self: center; padding: 10px 16px; border-radius: 8px; border: 0; background: #dc2626; color: #fff; font-weight: 700; cursor: pointer; }
```
- [ ] **Step 2: Preview** the hand over the fixture board in `App.tsx` (local `useState` for `selectedCardId`). Confirm the fan, energy, hover-lift, disabled dimming. Stop.
- [ ] **Step 3: Commit** — `git commit -am "feat(client): Slay-the-Spire card hand overlay"`

### Task F1.4: Hotseat driver + full interaction (the fun-check — needs Backend B1.x)

**Files:** `client/src/game/useHotseatGame.ts`, `client/src/game/GameScreen.tsx`; modify `App.tsx`.

**Interfaces:** `useHotseatGame()` → `{ state, activeId, legalMoveKeys, hand, cardTargetKeys(cardId), move(to), playCard(cardId,target), endTurn, reset }`. `GameScreen` composes driver + `BoardScene` + `CardHand`, managing move-vs-card selection.

- [ ] **Step 1: Hotseat driver (imports `shared`)**
```ts
// client/src/game/useHotseatGame.ts
import { useState } from 'react';
import { createRoom, applyMove, playCard, endTurn, legalMoves, cardTargets,
  runMonsterPhase, keyOf, type GameState, type Pos } from 'shared';
const rng = Math.random;
const seed = [{ name: 'Knight', classId: 'knight' }, { name: 'Wizard', classId: 'wizard' }];
export function useHotseatGame() {
  const [state, setState] = useState<GameState>(() => createRoom(0, seed, rng));
  const activeId = state.order[state.activeIndex]!;
  return {
    state, activeId,
    hand: state.units[activeId]?.hand ?? [],
    legalMoveKeys: new Set(legalMoves(state, activeId).map(keyOf)),
    cardTargetKeys: (cardId: string) => new Set(cardTargets(state, activeId, cardId).map(keyOf)),
    move: (to: Pos) => setState(s => applyMove(s, activeId, to)),
    playCard: (cardId: string, target: Pos) => setState(s => playCard(s, activeId, cardId, target)),
    endTurn: () => setState(s => endTurn(s, runMonsterPhase, rng)),
    reset: () => setState(createRoom(0, seed, rng)),
  };
}
```
- [ ] **Step 2: `GameScreen` — move/card mode state + click routing**
```tsx
// client/src/game/GameScreen.tsx
import { useState } from 'react';
import { keyOf, type Pos } from 'shared';
import { BoardScene } from './BoardScene';
import { CardHand } from './CardHand';
import { useHotseatGame } from './useHotseatGame';
export function GameScreen() {
  const g = useHotseatGame();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const done = g.state.phase === 'roomClear' || g.state.phase === 'defeat';
  const highlightKeys = selectedCardId ? g.cardTargetKeys(selectedCardId) : g.legalMoveKeys;
  const onTileClick = (p: Pos) => {
    const k = keyOf(p);
    if (selectedCardId) { if (highlightKeys.has(k)) { g.playCard(selectedCardId, p); setSelectedCardId(null); } }
    else if (g.legalMoveKeys.has(k)) g.move(p);
  };
  return (
    <>
      <BoardScene state={g.state} activeId={g.activeId} highlightKeys={highlightKeys} onTileClick={onTileClick} />
      <CardHand hand={g.hand} energy={g.state.units[g.activeId]?.energy ?? 0} maxEnergy={g.state.units[g.activeId]?.maxEnergy ?? 0}
        selectedCardId={selectedCardId} onSelectCard={setSelectedCardId}
        onEndTurn={() => { setSelectedCardId(null); g.endTurn(); }} disabled={done} />
      {done && (
        <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <h2>{g.state.phase === 'roomClear' ? 'ROOM CLEAR!' : 'DEFEATED'}</h2>
          <button onClick={() => { setSelectedCardId(null); g.reset(); }}>Reset</button>
        </div>
      )}
    </>
  );
}
```
- [ ] **Step 3: Mount `GameScreen`** in `App.tsx` (replace preview).
- [ ] **Step 4: Play the fun-check** — `pnpm --filter client dev`. Move (click a blue tile), select a card (targets highlight), click a target to play it, watch energy drop and the goblin take damage; End Turn → monster approaches/attacks; clear the room → "ROOM CLEAR!". Try losing. **Is it fun? Do line cards feel good on 16×16? Note gaps before multiplayer.**
- [ ] **Step 5: Commit** — `git commit -am "feat(client): hotseat playable 3D board + cards (fun-check)"`

**🎉 F-M1 complete — playable 3D card-tactics prototype. STOP and evaluate fun before F-M2.**

---

# F-M2 — Colyseus driver (roadmap → detail after F-M1 + Backend B-M2)
1. `useColyseusGame()` — connect via `colyseus.js` to `import.meta.env.VITE_SERVER_URL`, join `"dungeon"`, subscribe to synced state; expose the same shape as `useHotseatGame`, but `move`/`playCard`/`endTurn` send `intent` messages instead of calling `shared`.
2. Learn own unit via `mySessionId`; `disabled` when it isn't your turn; tolerate rejected intents (no local mutation).
3. `GameScreen` takes a driver so hotseat/Colyseus are interchangeable — no scene/hand changes.
4. Manual test: two tabs share a room and alternate turns.

# F-M3 — Lobby UI (roadmap)
Screens by `phase`: `CreateOrJoin` (enter code) → `Lobby` (roster, name, Knight/Wizard picker, ready, host Start) → `GameScreen`. State-based routing (no react-router). Sends `setName`/`setClass`/`toggleReady`/`start`.

# F-M4 — Reward + inventory UI (roadmap)
`RewardScreen` (`phase==='reward'`: pick 1 of 3 `rewardOptions`, send `pickUpgrade`); minimal inventory panel over `unit.inventory`/`equipment` with equip buttons (send `equip`). List + button, no drag-drop. Show newly-added cards as a small deck notice.

# F-M5 — Slop card reveal (roadmap)
`SlopScreen` on `phase==='slop'` — render `SLOP_CARDS[currentSlopCardId]` (name + description, big StS-style card presentation) with Continue.

# F-M6 — Deploy frontend (roadmap)
`VITE_SERVER_URL` = backend Railway `wss://` URL; `pnpm --filter client build`; Cloudflare Pages (build `pnpm --filter client build`, output `client/dist`, repo root). Smoke test two devices live.

---

## Polish Backlog (post F-M1 playtest feedback)

Not milestones — a running list of "fun and visibility" gaps identified while playing the F-M1 prototype live. Pick up opportunistically; each is small and independent.

1. **Floating damage numbers + hit-flash** (highest priority — cheapest change, biggest feel payoff). Right now damage only shows via the health bar changing value, with no popup number, no flash on the model, no sound. Sketch: watch `unit.hp` deltas the same way `UnitActor` watches `unit.pos` (see its hop-animation pattern), spawn a short-lived billboarded text that rises and fades, and briefly flash the hit model's material color/emissive.
2. **Affordability/cost clarity.** An unaffordable card is only distinguished by CSS dimming (`.dim`) — easy to miss at a glance. Consider a small shake or a tooltip explaining *why* it's disabled (not enough energy vs. no valid targets — the latter is now handled by the "No valid targets" message added after the card-UI fix).
3. **Monster telegraphing.** Enemies silently resolve their whole phase at once with no preview of who's about to move/attack. Even a brief per-monster highlight (target tile or intended victim) before each monster's action resolves would let players plan instead of just reacting.
4. **Phase/turn transition feedback.** Phase changes (player → monster → player, room clear, defeat) are currently a small corner text label only. A brief center-screen banner on transition (reusing the "ROOM CLEAR!"/"DEFEATED" treatment already in `GameScreen`) would make state changes easier to notice, especially in multiplayer where it might not be your turn.
5. **Sound effects.** Card play, hit, hop-landing, room-clear fanfare — cheap to wire up (Web Audio or plain `<audio>`), outsized impact on "fun."
6. **Camera doesn't follow the active unit.** In multiplayer especially, if you've panned away (drag-to-pan) the action can continue off-screen. Consider a gentle auto-recenter (or a "recenter" button) when the active unit changes.
7. **Selection/target legibility on the board itself.** Highlight tinting (`legal-move`/`legal-attack` tile colors in `BoardScene`) is the only spatial feedback; a pulsing outline or ground ring on the *currently selected* unit (distinct from "active unit" cyan tint) would help in a crowded board.

---

## Self-Review notes
- **Standalone-first:** F0.1 + F1.1–F1.3 need no backend (fixture + inline type fallback); only F1.4 onward consume real `shared`/`server`.
- **Presentational boundary:** `BoardScene`, `UnitModel`, `CardHand` take state + callbacks; only drivers (`useHotseatGame`/`useColyseusGame`) touch `shared`/network, so hotseat→multiplayer is one swap.
- **Iso look:** achieved via an orthographic camera offset equally on X/Z and elevated (`BoardScene`), not manual projection — three handles depth. Fixed camera per spec.
- **Contract fidelity:** consumed types/functions/messages (`GameState`, `Unit` with card fields, `cardTargets`, `playCard`, `applyMove`, intent shapes, 16×16) match the backend plan verbatim.
