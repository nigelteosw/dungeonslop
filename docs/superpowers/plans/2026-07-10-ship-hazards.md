# Ship Hazards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement tile-positioned doors with hull venting, per-tile multi-step fire, occupancy/station-driven oxygen, and per-room integrity/destruction in the ship simulation, per `docs/superpowers/specs/2026-07-10-ship-hazards-design.md`.

**Architecture:** All simulation logic lives in `backend/shared/src/ship.ts` (pure functions operating on `RunState`), driven by `backend/shared/src/run.ts` for event/slop effects and `backend/server/src/rooms/DungeonRoom.ts` for the network command surface. The Colyseus `DungeonState` schema (`backend/server/src/schema.ts`) and `projectShipSnapshot` (`backend/server/src/snapshot.ts`) mirror the authoritative `RunState` for clients. Frontend rendering (`frontend/src/game/*`) is **out of scope** for this plan — it will need a follow-up pass once this ships, since it currently reads the old door/fire field shapes.

**Tech Stack:** TypeScript, Bun test runner, Colyseus schema (`@colyseus/schema`).

## Global Constraints

- Server tick is 400ms (`backend/server/src/rooms/DungeonRoom.ts:50`); "~2 seconds per extinguish step" = 5 ticks per step, 15 ticks to fully extinguish one fire token (spec §9).
- All simulation functions remain pure: take `RunState`, return a new `structuredClone`d `RunState`. Never mutate the input.
- Every numeric constant introduced (drain rates, spread chance, damage-per-tick) is a placeholder tuned to roughly match today's existing constants, explicitly expected to change after playtest (spec §2, "Explicitly deferred").
- Run `bun test` from the repo root after every task; it must stay green (currently 28 passing tests across 5 files).
- This plan does not touch lobby, voting, sector map, or upgrade selection logic beyond the two `room.fire = 1` call sites in `run.ts` that must migrate to the new fire-token model.

---

## Task 1: Tile-anchored, 3-state doors + hull vent derivation

**Files:**
- Modify: `backend/shared/src/types.ts:14-20` (`ShipDoor` interface)
- Modify: `backend/shared/src/ship.ts` (door geometry helpers, `createShip`, `applyShipLayout`, `adjacentRooms`)
- Modify: `backend/server/src/schema.ts:55-66` (`ShipDoorSchema`)
- Modify: `backend/shared/src/ship.test.ts` (door-shape and movement tests)
- Modify: `backend/server/src/session.test.ts:24-37` (snapshot door assertion)

**Interfaces:**
- Produces: `ShipDoor { id: string; x: number; y: number; side: DoorSide; kind: DoorKind; state: DoorState; roomA: string; roomB?: string }`, exported types `DoorState`, `DoorSide`, `DoorKind`. `adjacentRooms(ship: ShipState, roomId: string): string[]` keeps its existing signature and behavior (room-graph adjacency), now driven by `door.kind === "interior" && door.state === "open"`.
- Consumes: nothing new from other tasks.

- [ ] **Step 1: Write the failing tests**

Replace the door-movement test and add two new tests in `backend/shared/src/ship.test.ts` (right after the existing `"every authoritative layout uses square rooms"` test):

```ts
test("closed and locked doors are excluded from movement", () => {
  const closed = encounter("pilot");
  closed.ship.doors["bridge--weapons"]!.state = "closed";
  expect(() => applyShipCommand(closed, { kind: "move", crewId: "c0", roomId: "weapons" })).toThrow("not directly reachable");

  const locked = encounter("pilot");
  locked.ship.doors["bridge--weapons"]!.state = "locked";
  expect(() => applyShipCommand(locked, { kind: "move", crewId: "c0", roomId: "weapons" })).toThrow("not directly reachable");
});

test("doors are anchored to a specific tile-to-tile junction", () => {
  const ship = createShip();
  const door = ship.doors["bridge--weapons"];
  expect(door).toMatchObject({ kind: "interior", state: "open", roomA: "weapons", roomB: "bridge" });
  expect(door!.x).toBe(7);
  expect(door!.y).toBe(3);
  expect(door!.side).toBe("e");
});

test("every room boundary tile not touching another room gets a locked hull vent", () => {
  const ship = createShip();
  const hullVents = Object.values(ship.doors).filter((door) => door.kind === "hull");
  expect(hullVents.length).toBeGreaterThan(0);
  for (const vent of hullVents) {
    expect(vent.state).toBe("locked");
    expect(vent.roomB).toBeUndefined();
  }
  const weaponsVents = hullVents.filter((door) => door.roomA === "weapons");
  expect(weaponsVents.length).toBeGreaterThan(0);
});
```

This replaces the existing (now-stale) `"closed and locked doors are excluded from movement"` test in place — remove the old version that sets `.open`/`.locked`.

Then update `backend/server/src/session.test.ts:24-37`:

```ts
test("schema snapshot includes authoritative room geometry and doors", () => {
  const session = startedSession();
  const run = session.snapshot().run;
  if (!run) throw new Error("expected run snapshot");
  const state = projectShipSnapshot(run);

  expect(state.rooms.find((room) => room.id === "bridge")).toMatchObject({ x: 8, y: 3, w: 2, h: 2 });
  expect(state.doors.find((door) => door.id === "bridge--weapons")).toMatchObject({
    roomA: "weapons",
    roomB: "bridge",
    kind: "interior",
    state: "open",
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test backend/shared/src/ship.test.ts backend/server/src/session.test.ts`
Expected: FAIL — `door.state` is `undefined`, `ShipDoor` has no `x`/`y`/`side`/`kind`/`roomA`/`roomB`.

- [ ] **Step 3: Update the `ShipDoor` type**

In `backend/shared/src/types.ts`, replace lines 14-20:

```ts
export type DoorState = "open" | "closed" | "locked";
export type DoorSide = "n" | "s" | "e" | "w";
export type DoorKind = "interior" | "hull";

export interface ShipDoor {
  id: string;
  x: number;
  y: number;
  side: DoorSide;
  kind: DoorKind;
  state: DoorState;
  roomA: string;
  roomB?: string;
}
```

- [ ] **Step 4: Implement door geometry and rebuild door construction in `ship.ts`**

In `backend/shared/src/ship.ts`, add these imports to the top `import type { ... } from "./types"` line: add `DoorKind, DoorSide, DoorState` to the named imports.

Add these constants and helpers right after the `doorId` function (currently line 42):

```ts
const SIDE_DELTA: Record<DoorSide, { dx: number; dy: number }> = {
  n: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  e: { dx: 1, dy: 0 },
  w: { dx: -1, dy: 0 },
};
const OPPOSITE_SIDE: Record<DoorSide, DoorSide> = { n: "s", s: "n", e: "w", w: "e" };

function computeInteriorDoorAnchor(boundsA: RoomBounds, boundsB: RoomBounds): { x: number; y: number; side: DoorSide } {
  if (boundsA.x + boundsA.w === boundsB.x) return { x: boundsA.x + boundsA.w - 1, y: Math.max(boundsA.y, boundsB.y), side: "e" };
  if (boundsB.x + boundsB.w === boundsA.x) return { x: boundsA.x, y: Math.max(boundsA.y, boundsB.y), side: "w" };
  if (boundsA.y + boundsA.h === boundsB.y) return { x: Math.max(boundsA.x, boundsB.x), y: boundsA.y + boundsA.h - 1, side: "s" };
  if (boundsB.y + boundsB.h === boundsA.y) return { x: Math.max(boundsA.x, boundsB.x), y: boundsA.y, side: "n" };
  throw new Error("rooms do not share a wall");
}

function deriveHullVents(layoutId: string, rooms: Record<string, { id: string } & RoomBounds>): ShipDoor[] {
  const vents: ShipDoor[] = [];
  for (const room of Object.values(rooms)) {
    for (let x = room.x; x < room.x + room.w; x += 1) {
      for (let y = room.y; y < room.y + room.h; y += 1) {
        for (const side of ["n", "s", "e", "w"] as DoorSide[]) {
          const delta = SIDE_DELTA[side];
          if (roomAtDeckPosition(layoutId, x + delta.dx, y + delta.dy)) continue;
          vents.push({ id: `hull-${room.id}-${x}-${y}-${side}`, x, y, side, kind: "hull", state: "locked", roomA: room.id });
        }
      }
    }
  }
  return vents;
}

function buildDoors(layoutId: string, layout: ShipLayoutDef, rooms: Record<string, { id: string } & RoomBounds>): Record<string, ShipDoor> {
  const interiorDoors = layout.doors.map(([a, b]): ShipDoor => {
    const boundsA = layout.rooms[a];
    const boundsB = layout.rooms[b];
    if (!boundsA || !boundsB) throw new Error(`door references unknown room ${a} or ${b}`);
    const anchor = computeInteriorDoorAnchor(boundsA, boundsB);
    return { id: doorId(a, b), ...anchor, kind: "interior", state: "open", roomA: a, roomB: b };
  });
  const hullVents = deriveHullVents(layoutId, rooms);
  return Object.fromEntries([...interiorDoors, ...hullVents].map((door) => [door.id, door]));
}
```

Note: `deriveHullVents` and `buildDoors` are declared above `roomAtDeckPosition`'s call site but reference it — since these are all top-level `function` declarations, hoisting makes this fine regardless of order; keep `roomAtDeckPosition` where it already is (below `applyShipLayout`, currently line ~73).

Replace `createShip` (currently lines 44-65) — only the door construction line changes:

```ts
export function createShip(layoutId = "balanced"): ShipState {
  const layout = SHIP_LAYOUTS[layoutId];
  if (!layout) throw new Error("unknown ship layout");
  const rooms = Object.fromEntries(SHIP_ROOM_IDS.map((id) => {
    const bounds = layout.rooms[id];
    if (!bounds) throw new Error(`room ${id} missing from ship layout`);
    return [id, { id, ...bounds, oxygen: 100, fire: 0, breached: false }];
  }));
  const doors = buildDoors(layoutId, layout, rooms);
  const systems = Object.fromEntries(
    (Object.entries(SYSTEM_ROOMS) as [SystemId, string][]).map(([id, roomId]) => [
      id,
      { id, roomId, health: 4, maxHealth: 4, power: id === "reactor" ? 0 : 1, maxPower: id === "reactor" ? 0 : 3 },
    ]),
  ) as ShipState["systems"];
  return { layoutId, hull: 50, maxHull: 50, shields: 2, maxShields: 3, scrap: 0, reactorCapacity: 5, rooms, doors, systems };
}
```

Replace `applyShipLayout` (currently lines 79-95) — room bounds must update *before* doors are rebuilt, since hull-vent derivation reads current room geometry:

```ts
export function applyShipLayout(state: RunState, layoutId: string): RunState {
  const layout = SHIP_LAYOUTS[layoutId];
  if (!layout) throw new Error("unknown ship layout");
  const next = structuredClone(state);
  next.ship.layoutId = layoutId;
  for (const [roomId, bounds] of Object.entries(layout.rooms)) {
    const room = next.ship.rooms[roomId];
    if (room) Object.assign(room, bounds);
  }
  next.ship.doors = buildDoors(layoutId, layout, next.ship.rooms);
  for (const crew of Object.values(next.crew)) {
    const center = roomCenter(layoutId, crew.roomId);
    crew.deckX = center.x;
    crew.deckY = center.y;
  }
  return next;
}
```

Replace `adjacentRooms` (currently lines 135-140):

```ts
export function adjacentRooms(ship: ShipState, roomId: string): string[] {
  if (!ship.rooms[roomId]) throw new Error("unknown ship room");
  return Object.values(ship.doors)
    .filter((door) => door.kind === "interior" && door.state === "open" && (door.roomA === roomId || door.roomB === roomId))
    .map((door) => (door.roomA === roomId ? door.roomB! : door.roomA));
}
```

- [ ] **Step 5: Update `ShipDoorSchema` in the server schema**

In `backend/server/src/schema.ts`, replace `ShipDoorSchema` (currently lines 55-66):

```ts
export class ShipDoorSchema extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("string") side = "";
  @type("string") kind = "";
  @type("string") state = "";
  @type("string") roomA = "";
  @type("string") roomB = "";

  constructor(door?: ShipDoor) {
    super();
    if (!door) return;
    Object.assign(this, door);
    this.roomB = door.roomB ?? "";
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test`
Expected: all tests pass (28+ tests).

- [ ] **Step 7: Commit**

```bash
git add backend/shared/src/types.ts backend/shared/src/ship.ts backend/shared/src/ship.test.ts backend/server/src/schema.ts backend/server/src/session.test.ts
git commit -m "feat(ship): tile-anchored 3-state doors with derived hull vents"
```

---

## Task 2: `setDoorState` command (bridge ship-wide panel + crew self-open)

**Files:**
- Modify: `backend/shared/src/types.ts` (`ShipCommand` union)
- Modify: `backend/shared/src/ship.ts` (`applyShipCommand`)
- Modify: `backend/server/src/rooms/DungeonRoom.ts` (`parseCommand`)
- Modify: `backend/shared/src/ship.test.ts`

**Interfaces:**
- Consumes: `ShipDoor` from Task 1 (`kind`, `state`, `roomA`, `roomB`).
- Produces: `ShipCommand` variant `{ kind: "setDoorState"; crewId: string; doorId: string; state: DoorState }`.

- [ ] **Step 1: Write the failing tests**

Add to `backend/shared/src/ship.test.ts`:

```ts
test("a crew member can open a closed interior door from either side", () => {
  const run = encounter("pilot");
  run.ship.doors["bridge--weapons"]!.state = "closed";
  const opened = applyShipCommand(run, { kind: "setDoorState", crewId: "c0", doorId: "bridge--weapons", state: "open" });
  expect(opened.ship.doors["bridge--weapons"]?.state).toBe("open");
});

test("only a crew member at the door can open it, and only the bridge can close or lock it", () => {
  const run = encounter("pilot", "engineering");
  run.ship.doors["bridge--weapons"]!.state = "closed";
  expect(() => applyShipCommand(run, { kind: "setDoorState", crewId: "c0", doorId: "bridge--weapons", state: "open" })).toThrow(
    "not at that door",
  );
  expect(() => applyShipCommand(run, { kind: "setDoorState", crewId: "c0", doorId: "bridge--weapons", state: "closed" })).toThrow(
    "only the bridge",
  );
});

test("bridge operator controls any door or hull vent ship-wide", () => {
  let run = encounter("pilot", "bridge");
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "helm" });
  const hullVentId = Object.values(run.ship.doors).find((door) => door.kind === "hull")!.id;
  const opened = applyShipCommand(run, { kind: "setDoorState", crewId: "c0", doorId: hullVentId, state: "open" });
  expect(opened.ship.doors[hullVentId]?.state).toBe("open");
  const relocked = applyShipCommand(run, { kind: "setDoorState", crewId: "c0", doorId: "bridge--weapons", state: "locked" });
  expect(relocked.ship.doors["bridge--weapons"]?.state).toBe("locked");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test backend/shared/src/ship.test.ts`
Expected: FAIL — `"invalid ship command"` / `"setDoorState"` not a recognized command kind.

- [ ] **Step 3: Add the command type**

In `backend/shared/src/types.ts`, in the `ShipCommand` union, add a new variant right after `repair`:

```ts
  | { kind: "setDoorState"; crewId: string; doorId: string; state: DoorState }
```

- [ ] **Step 4: Implement the command handler**

In `backend/shared/src/ship.ts`, in `applyShipCommand`, insert this block right after the `repair` block (currently ends at line 211, before `const room = next.ship.rooms[crew.roomId];`):

```ts
  if (command.kind === "setDoorState") {
    const door = next.ship.doors[command.doorId];
    if (!door) throw new Error("unknown door");
    const atBridge = next.ship.systems.helm.operatorCrewId === crew.id;
    const bridgeOnly = door.kind === "hull" || door.state === "locked" || command.state === "locked" || command.state === "closed";
    if (bridgeOnly && !atBridge) throw new Error("only the bridge can control that door");
    if (!atBridge) {
      const atDoor = crew.roomId === door.roomA || crew.roomId === door.roomB;
      if (!atDoor) throw new Error("crew member is not at that door");
    }
    door.state = command.state;
    return next;
  }
```

- [ ] **Step 5: Wire up the network command parser**

In `backend/server/src/rooms/DungeonRoom.ts`, insert this into `parseCommand`, right after the `repair`/`operate` block (currently line 26):

```ts
  if (kind === "setDoorState" && typeof value.doorId === "string" && typeof value.state === "string" && ["open", "closed", "locked"].includes(value.state)) {
    return { kind, crewId, doorId: value.doorId, state: value.state as "open" | "closed" | "locked" };
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/shared/src/types.ts backend/shared/src/ship.ts backend/server/src/rooms/DungeonRoom.ts backend/shared/src/ship.test.ts
git commit -m "feat(ship): setDoorState command with bridge-wide and self-service rules"
```

---

## Task 3: Hull venting effect

**Files:**
- Modify: `backend/shared/src/ship.ts` (`ventRoom` helper, wired into `setDoorState`)
- Modify: `backend/shared/src/ship.test.ts`

**Interfaces:**
- Consumes: `setDoorState` from Task 2.
- Produces: `ventRoom(next: RunState, roomId: string): void` (module-private).

- [ ] **Step 1: Write the failing test**

Add to `backend/shared/src/ship.test.ts`:

```ts
test("opening a hull vent kills anyone inside and empties the room's oxygen", () => {
  let run = encounter("pilot", "bridge");
  run.crew.c1 = createCrew("c1", "s1", "Riko", "engineer", "weapons");
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "helm" });
  const hullVentId = Object.values(run.ship.doors).find((door) => door.kind === "hull" && door.roomA === "weapons")!.id;
  run.ship.rooms.weapons!.oxygen = 90;
  const vented = applyShipCommand(run, { kind: "setDoorState", crewId: "c0", doorId: hullVentId, state: "open" });
  expect(vented.ship.rooms.weapons?.oxygen).toBe(0);
  expect(vented.crew.c1).toBeUndefined();
  expect(vented.crew.c0).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test backend/shared/src/ship.test.ts`
Expected: FAIL — `vented.ship.rooms.weapons?.oxygen` is still `90`, `vented.crew.c1` is still defined.

- [ ] **Step 3: Implement `ventRoom` and wire it in**

In `backend/shared/src/ship.ts`, add this helper right after `buildDoors`:

```ts
function ventRoom(next: RunState, roomId: string): void {
  const room = next.ship.rooms[roomId];
  if (!room) return;
  room.oxygen = 0;
  room.fire = 0;
  for (const crew of Object.values(next.crew)) {
    if (crew.roomId === roomId) delete next.crew[crew.id];
  }
}
```

Update the `setDoorState` block from Task 2 to call it:

```ts
    door.state = command.state;
    if (door.kind === "hull" && command.state === "open") ventRoom(next, door.roomA);
    return next;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/shared/src/ship.ts backend/shared/src/ship.test.ts
git commit -m "feat(ship): opening a hull vent instantly vents oxygen and kills occupants"
```

---

## Task 4: Room integrity + destruction

**Files:**
- Modify: `backend/shared/src/types.ts` (`ShipRoomState`)
- Modify: `backend/shared/src/ship.ts` (constants, `createShip`, weapon-hit block, destruction check)
- Modify: `backend/server/src/schema.ts` (`ShipRoomSchema`)
- Modify: `backend/shared/src/ship.test.ts`

**Interfaces:**
- Produces: `ShipRoomState.integrity: number`, `.maxIntegrity: number`, `.destroyed: boolean`.

- [ ] **Step 1: Write the failing tests**

Add to `backend/shared/src/ship.test.ts`:

```ts
test("a room at zero integrity is destroyed: its system dies, it breaches, and its doors lock", () => {
  let run = encounter("engineer", "engineering");
  run.ship.rooms.engineering!.integrity = 0;
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.rooms.engineering?.destroyed).toBe(true);
  expect(run.ship.rooms.engineering?.breached).toBe(true);
  expect(run.ship.systems.reactor.health).toBe(0);
  const touchingDoors = Object.values(run.ship.doors).filter((door) => door.roomA === "engineering" || door.roomB === "engineering");
  expect(touchingDoors.length).toBeGreaterThan(0);
  expect(touchingDoors.every((door) => door.state === "locked")).toBe(true);
});

test("a weapon hit reduces the target room's integrity", () => {
  let run = encounter("pilot");
  run.enemy!.weaponChargeTicks = run.enemy!.weaponChargeMaxTicks - 1;
  run.ship.shields = 0;
  const before = { ...run.ship.rooms.bridge! };
  run = stepShipSimulation(run, () => 0.99);
  const hitRoom = Object.values(run.ship.rooms).find((room, index) => room.integrity < Object.values(before as never)[index]);
  expect(Object.values(run.ship.rooms).some((room) => room.integrity < room.maxIntegrity)).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test backend/shared/src/ship.test.ts`
Expected: FAIL — `integrity`/`maxIntegrity`/`destroyed` are `undefined` on `ShipRoomState`.

- [ ] **Step 3: Update `ShipRoomState` and add constants**

In `backend/shared/src/types.ts`, replace `ShipRoomState` (currently lines 32-41):

```ts
export interface ShipRoomState {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  oxygen: number;
  fire: number;
  breached: boolean;
  integrity: number;
  maxIntegrity: number;
  destroyed: boolean;
}
```

In `backend/shared/src/ship.ts`, add near the top (after the `SYSTEM_ROOMS` const):

```ts
const ROOM_MAX_INTEGRITY = 4;
const HIT_INTEGRITY_DAMAGE = 1;
```

- [ ] **Step 4: Update `createShip` and the weapon-hit block**

In `createShip`, update the room construction line:

```ts
    return [id, { id, ...bounds, oxygen: 100, fire: 0, breached: false, integrity: ROOM_MAX_INTEGRITY, maxIntegrity: ROOM_MAX_INTEGRITY, destroyed: false }];
```

In `stepShipSimulation`, in the weapon-hit block (currently around line 322-333), update:

```ts
        const system = systemId ? next.ship.systems[systemId] : undefined;
        if (system) {
          system.health = Math.max(0, system.health - 1);
          const room = next.ship.rooms[system.roomId];
          if (room) {
            room.integrity = Math.max(0, room.integrity - HIT_INTEGRITY_DAMAGE);
            if (rng() < 0.45) room.fire = Math.max(1, room.fire);
            else room.breached = true;
          }
        }
```

- [ ] **Step 5: Add the destruction check**

In `stepShipSimulation`, insert this loop right after the existing per-room oxygen/fire loop (the `for (const room of Object.values(next.ship.rooms)) { ... }` block that currently ends around line 281), before the crew-damage loop:

```ts
  for (const room of Object.values(next.ship.rooms)) {
    if (room.destroyed || room.integrity > 0) continue;
    room.destroyed = true;
    room.breached = true;
    for (const system of Object.values(next.ship.systems)) {
      if (system.roomId === room.id) system.health = 0;
    }
    for (const door of Object.values(next.ship.doors)) {
      if (door.roomA === room.id || door.roomB === room.id) door.state = "locked";
    }
  }
```

- [ ] **Step 6: Update `ShipRoomSchema`**

In `backend/server/src/schema.ts`, replace `ShipRoomSchema` (currently lines 39-53):

```ts
export class ShipRoomSchema extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") w = 0;
  @type("number") h = 0;
  @type("number") oxygen = 100;
  @type("number") fire = 0;
  @type("boolean") breached = false;
  @type("number") integrity = 0;
  @type("number") maxIntegrity = 0;
  @type("boolean") destroyed = false;

  constructor(room?: ShipRoomState) {
    super();
    if (room) Object.assign(this, room);
  }
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `bun test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add backend/shared/src/types.ts backend/shared/src/ship.ts backend/server/src/schema.ts backend/shared/src/ship.test.ts
git commit -m "feat(ship): per-room integrity stat and destruction (system offline, auto-breach, doors lock)"
```

---

## Task 5: Fire tokens data model — replace the scalar everywhere

**Files:**
- Modify: `backend/shared/src/types.ts` (`FireToken`, `ShipState.fires`, `ShipCommand.extinguish`, drop `ShipRoomState.fire`)
- Modify: `backend/shared/src/ship.ts` (all `.fire` call sites, `ventRoom`)
- Modify: `backend/shared/src/run.ts` (event-effect fire call sites)
- Modify: `backend/server/src/schema.ts` (`FireSchema`, `DungeonState.fires`)
- Modify: `backend/server/src/snapshot.ts` (`fires` in projection)
- Modify: `backend/server/src/rooms/DungeonRoom.ts` (`parseCommand` for `extinguish`)
- Modify: `backend/shared/src/ship.test.ts`, `backend/shared/src/run.test.ts`

**Interfaces:**
- Produces: `FireToken { id: string; roomId: string; x: number; y: number; stepsDone: number; channelTicks: number }`, `ShipState.fires: Record<string, FireToken>`, `ShipCommand` variant `{ kind: "extinguish"; crewId: string; fireId: string }`, exported `igniteRoomOrigin(ship: ShipState, roomId: string): void`.

- [ ] **Step 1: Write the failing tests**

In `backend/shared/src/ship.test.ts`, replace the `"same state and rng produce the same tick"` test:

```ts
test("same state and rng produce the same tick", () => {
  const run = encounter("medic");
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 0, channelTicks: 0 };
  expect(stepShipSimulation(run, () => 0.9)).toEqual(stepShipSimulation(run, () => 0.9));
});
```

Replace the engineer section of `"each role ability creates a distinct authoritative effect"`:

```ts
  let engineer = encounter("engineer", "engineering");
  engineer.ship.systems.reactor.health = 1;
  const engRoom = engineer.ship.rooms.engineering!;
  engineer.ship.fires.f0 = { id: "f0", roomId: "engineering", x: engRoom.x, y: engRoom.y, stepsDone: 0, channelTicks: 0 };
  engineer.ship.fires.f1 = { id: "f1", roomId: "engineering", x: engRoom.x + 1, y: engRoom.y, stepsDone: 0, channelTicks: 0 };
  engineer = applyShipCommand(engineer, { kind: "useAbility", crewId: "c0" });
  expect(engineer.ship.systems.reactor.health).toBe(3);
  expect(Object.values(engineer.ship.fires).filter((fire) => fire.roomId === "engineering")).toHaveLength(1);
```

Add a new test for the extinguish command:

```ts
test("extinguish removes the targeted fire token", () => {
  let run = encounter("pilot", "bridge");
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 0, channelTicks: 0 };
  run = applyShipCommand(run, { kind: "extinguish", crewId: "c0", fireId: "f0" });
  expect(run.ship.fires.f0).toBeUndefined();
});
```

In `backend/shared/src/run.test.ts`, add:

```ts
test("purge buoy event ignites the oxygen room", () => {
  let run = createRun("seed", [createCrew("c0", "s0", "Ada", "medic")]);
  run = castVote(run, "s0", "quarantine-buoy");
  run = castVote(run, "s0", "purge-buoy");
  expect(Object.values(run.ship.fires).some((fire) => fire.roomId === "oxygen")).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test backend/shared/src/ship.test.ts backend/shared/src/run.test.ts`
Expected: FAIL — `ship.fires` is `undefined`, `extinguish` command rejects (missing `fireId` in the type), `room.fire` still exists as a stale field.

- [ ] **Step 3: Update types**

In `backend/shared/src/types.ts`:

Remove `fire: number;` from `ShipRoomState`.

Add after `ShipRoomState`:

```ts
export interface FireToken {
  id: string;
  roomId: string;
  x: number;
  y: number;
  stepsDone: number;
  channelTicks: number;
}
```

In `ShipState`, add a field: `fires: Record<string, FireToken>;` (add it next to `rooms`/`doors`/`systems`).

In `ShipCommand`, replace the `extinguish` variant:

```ts
  | { kind: "extinguish"; crewId: string; fireId: string }
```

- [ ] **Step 4: Update `ship.ts`**

Add constants near the top (with the Task 4 constants):

```ts
const FIRE_OXY_DRAIN_PER_TOKEN = 2;
const FIRE_INTEGRITY_DAMAGE_PER_TOKEN = 1;
const FIRE_CREW_DAMAGE_PER_TOKEN = 2;
```

Add these helpers after `ventRoom`:

```ts
function igniteRandomTile(ship: ShipState, roomId: string, rng: Rng, tick: number): void {
  const room = ship.rooms[roomId];
  if (!room) return;
  for (let attempt = 0; attempt < room.w * room.h; attempt += 1) {
    const x = room.x + Math.floor(rng() * room.w);
    const y = room.y + Math.floor(rng() * room.h);
    const occupied = Object.values(ship.fires).some((fire) => fire.roomId === roomId && fire.x === x && fire.y === y);
    if (occupied) continue;
    const id = `fire-${roomId}-${x}-${y}-${tick}`;
    ship.fires[id] = { id, roomId, x, y, stepsDone: 0, channelTicks: 0 };
    return;
  }
}

function extinguishOneToken(ship: ShipState, roomId: string): void {
  const target = Object.values(ship.fires).find((fire) => fire.roomId === roomId);
  if (target) delete ship.fires[target.id];
}

export function igniteRoomOrigin(ship: ShipState, roomId: string): void {
  const room = ship.rooms[roomId];
  if (!room) return;
  const occupied = Object.values(ship.fires).some((fire) => fire.roomId === roomId && fire.x === room.x && fire.y === room.y);
  if (occupied) return;
  const id = `fire-${roomId}-${room.x}-${room.y}-vote`;
  ship.fires[id] = { id, roomId, x: room.x, y: room.y, stepsDone: 0, channelTicks: 0 };
}
```

Update `createShip`'s room construction line (drop `fire: 0`):

```ts
    return [id, { id, ...bounds, oxygen: 100, breached: false, integrity: ROOM_MAX_INTEGRITY, maxIntegrity: ROOM_MAX_INTEGRITY, destroyed: false }];
```

Update `createShip`'s return statement to add `fires: {}`:

```ts
  return { layoutId, hull: 50, maxHull: 50, shields: 2, maxShields: 3, scrap: 0, reactorCapacity: 5, rooms, doors, fires: {}, systems };
```

Update `ventRoom` (from Task 3) to clear fire tokens instead of the scalar:

```ts
function ventRoom(next: RunState, roomId: string): void {
  const room = next.ship.rooms[roomId];
  if (!room) return;
  room.oxygen = 0;
  for (const fireId of Object.keys(next.ship.fires)) {
    if (next.ship.fires[fireId]?.roomId === roomId) delete next.ship.fires[fireId];
  }
  for (const crew of Object.values(next.crew)) {
    if (crew.roomId === roomId) delete next.crew[crew.id];
  }
}
```

Replace the `extinguish` branch in `applyShipCommand` (currently `room.fire = Math.max(0, room.fire - 1); return next;`):

```ts
  if (command.kind === "extinguish") {
    const fire = next.ship.fires[command.fireId];
    if (!fire || fire.roomId !== crew.roomId) throw new Error("no fire there to extinguish");
    delete next.ship.fires[fire.id];
    return next;
  }
```

Update the engineer ability branch (`room.fire = Math.max(0, room.fire - 1);` inside `useAbility`):

```ts
    } else if (crew.role === "engineer") {
      const system = Object.values(next.ship.systems).find((candidate) => candidate.roomId === crew.roomId);
      if (!system) throw new Error("engineer ability requires a system room");
      system.health = Math.min(system.maxHealth, system.health + 2);
      extinguishOneToken(next.ship, crew.roomId);
```

Replace the room oxygen/fire loop in `stepShipSimulation` (currently the block starting `for (const room of Object.values(next.ship.rooms)) { const thinAir = ...`):

```ts
  for (const room of Object.values(next.ship.rooms)) {
    const thinAir = next.slopEffectId === "thin-air";
    if (room.breached) room.oxygen = Math.max(0, room.oxygen - (thinAir ? 4 : 3));
    else if (next.ship.systems.oxygen.health > 0 && next.ship.systems.oxygen.power > 0) room.oxygen = Math.min(100, room.oxygen + (thinAir ? 1 : 2));
    const roomFireCount = Object.values(next.ship.fires).filter((fire) => fire.roomId === room.id).length;
    if (roomFireCount > 0) {
      room.oxygen = Math.max(0, room.oxygen - FIRE_OXY_DRAIN_PER_TOKEN * roomFireCount);
      room.integrity = Math.max(0, room.integrity - FIRE_INTEGRITY_DAMAGE_PER_TOKEN * roomFireCount);
    }
  }
```

Update the crew fire-damage lines (currently `const fireDamage = (room?.fire ?? 0) * 2;`):

```ts
    const roomFireCount = room ? Object.values(next.ship.fires).filter((fire) => fire.roomId === room.id).length : 0;
    const fireDamage = roomFireCount * FIRE_CREW_DAMAGE_PER_TOKEN;
```

Update the volatile-weapons ignite line (`next.ship.rooms.weapons!.fire = 1;`):

```ts
      if (next.slopEffectId === "volatile-weapons" && rng() < 0.2) igniteRandomTile(next.ship, "weapons", rng, next.tick);
```

Update the weapon-hit fire placement (`if (rng() < 0.45) room.fire = Math.max(1, room.fire);`):

```ts
            if (rng() < 0.45) igniteRandomTile(next.ship, room.id, rng, next.tick);
```

Update the medbay-foam suppression (`if (medbay) medbay.fire = Math.max(0, medbay.fire - 1);`):

```ts
    if (medbay) extinguishOneToken(next.ship, medbay.id);
```

Update the hot-reactor-summer ignite (`next.ship.rooms.engineering!.fire = Math.max(1, next.ship.rooms.engineering!.fire);`):

```ts
  if (next.slopEffectId === "hot-reactor-summer" && next.tick % 20 === 0 && rng() < 0.35) {
    igniteRandomTile(next.ship, "engineering", rng, next.tick);
  }
```

- [ ] **Step 5: Update `run.ts`**

Add `igniteRoomOrigin` to the import from `./ship`:

```ts
import { applyShipLayout, igniteRoomOrigin, stepShipSimulation } from "./ship";
```

Replace `next.ship.rooms.oxygen!.fire = 1;` (purge-buoy):

```ts
    } else if (winner === "purge-buoy") {
      next.ship.scrap += 4;
      igniteRoomOrigin(next.ship, "oxygen");
```

Replace `next.ship.rooms.engineering!.fire = 1;` (cross-picket-line):

```ts
    } else if (winner === "cross-picket-line") {
      next.ship.scrap += 6;
      next.ship.rooms.engineering!.breached = true;
      igniteRoomOrigin(next.ship, "engineering");
```

- [ ] **Step 6: Update the server schema and snapshot**

In `backend/server/src/schema.ts`, remove `@type("number") fire = 0;` from `ShipRoomSchema`. Import `FireToken` in the top import line. Add a new schema class after `BoarderSchema`:

```ts
export class FireSchema extends Schema {
  @type("string") id = "";
  @type("string") roomId = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") stepsDone = 0;
  @type("number") channelTicks = 0;

  constructor(fire?: FireToken) {
    super();
    if (fire) Object.assign(this, fire);
  }
}
```

Add to `DungeonState`: `@type({ map: FireSchema }) fires = new MapSchema<FireSchema>();`

In `applySnapshot`, add `this.fires.clear();` next to the other `.clear()` calls, and add to the population section:

```ts
    for (const fire of Object.values(run.ship.fires)) this.fires.set(fire.id, new FireSchema(fire));
```

In `backend/server/src/snapshot.ts`, update:

```ts
import type { FireToken, RunState, ShipDoor, ShipRoomState } from "shared";

export interface ShipSnapshotProjection {
  rooms: ShipRoomState[];
  doors: ShipDoor[];
  fires: FireToken[];
}

export function projectShipSnapshot(run: RunState): ShipSnapshotProjection {
  return {
    rooms: Object.values(run.ship.rooms),
    doors: Object.values(run.ship.doors),
    fires: Object.values(run.ship.fires),
  };
}
```

- [ ] **Step 7: Update the network command parser**

In `backend/server/src/rooms/DungeonRoom.ts`, replace the combined `extinguish`/`sealBreach` line:

```ts
  if (kind === "extinguish" && typeof value.fireId === "string") return { kind, crewId, fireId: value.fireId };
  if (kind === "sealBreach") return { kind, crewId };
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `bun test`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add backend/shared/src/types.ts backend/shared/src/ship.ts backend/shared/src/run.ts backend/server/src/schema.ts backend/server/src/snapshot.ts backend/server/src/rooms/DungeonRoom.ts backend/shared/src/ship.test.ts backend/shared/src/run.test.ts
git commit -m "feat(ship): replace scalar room fire with positioned fire tokens"
```

---

## Task 6: Multi-step extinguish with interrupt/reset behavior

**Files:**
- Modify: `backend/shared/src/types.ts` (`CrewState.extinguishingFireId`)
- Modify: `backend/shared/src/ship.ts` (`applyShipCommand`, `stepShipSimulation`)
- Modify: `backend/shared/src/ship.test.ts`

**Interfaces:**
- Consumes: `FireToken.stepsDone`/`.channelTicks` from Task 5.
- Produces: `CrewState.extinguishingFireId?: string`.

- [ ] **Step 1: Write the failing tests**

Add to `backend/shared/src/ship.test.ts`:

```ts
test("extinguishing a fire takes three channeled steps", () => {
  let run = encounter("pilot", "bridge");
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 0, channelTicks: 0 };
  run = applyShipCommand(run, { kind: "extinguish", crewId: "c0", fireId: "f0" });
  for (let i = 0; i < 14; i += 1) run = stepShipSimulation(run, () => 1);
  expect(run.ship.fires.f0).toBeDefined();
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.fires.f0).toBeUndefined();
});

test("moving away from a fire resets its extinguish progress", () => {
  let run = encounter("pilot", "bridge");
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 0, channelTicks: 0 };
  run = applyShipCommand(run, { kind: "extinguish", crewId: "c0", fireId: "f0" });
  run = stepShipSimulation(run, () => 1);
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.fires.f0?.channelTicks).toBe(2);
  run = applyShipCommand(run, { kind: "moveVector", crewId: "c0", dx: -1, dy: 0 });
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.fires.f0).toMatchObject({ stepsDone: 0, channelTicks: 0 });
});

test("taking damage while channeling does not interrupt extinguish progress", () => {
  let run = encounter("pilot", "bridge");
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 0, channelTicks: 0 };
  run.ship.rooms.bridge!.oxygen = 5;
  run = applyShipCommand(run, { kind: "extinguish", crewId: "c0", fireId: "f0" });
  run = stepShipSimulation(run, () => 1);
  expect(run.crew.c0!.health).toBeLessThan(100);
  expect(run.ship.fires.f0?.channelTicks).toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test backend/shared/src/ship.test.ts`
Expected: FAIL — the fire token is removed instantly by the current `extinguish` handler instead of accumulating steps.

- [ ] **Step 3: Add the crew field**

In `backend/shared/src/types.ts`, add to `CrewState` (next to `carryingItemId`):

```ts
  extinguishingFireId?: string;
```

- [ ] **Step 4: Update `applyShipCommand`**

In `backend/shared/src/ship.ts`, right after `const crew = activeCrew(next, command.crewId);` in `applyShipCommand`, add:

```ts
  if (command.kind !== "extinguish") crew.extinguishingFireId = undefined;
```

Replace the `extinguish` branch (added in Task 5) with:

```ts
  if (command.kind === "extinguish") {
    const fire = next.ship.fires[command.fireId];
    if (!fire || fire.roomId !== crew.roomId) throw new Error("no fire there to extinguish");
    if (Math.max(Math.abs(fire.x - crew.deckX), Math.abs(fire.y - crew.deckY)) > 1) throw new Error("too far from the fire to extinguish it");
    crew.extinguishingFireId = fire.id;
    return next;
  }
```

- [ ] **Step 5: Add the channel-progress tick loop**

Add constants near the top of `ship.ts` (with the other Task 4/5 constants):

```ts
const STEP_TICKS = 5;
const STEPS_TO_EXTINGUISH = 3;
```

In `stepShipSimulation`, insert this loop right after the destruction-check loop (added in Task 4), before the crew-damage loop:

```ts
  for (const fire of Object.values(next.ship.fires)) {
    const channeler = Object.values(next.crew).find(
      (candidate) => candidate.extinguishingFireId === fire.id && !candidate.incapacitated,
    );
    const stillChanneling = channeler
      && channeler.roomId === fire.roomId
      && Math.max(Math.abs(fire.x - channeler.deckX), Math.abs(fire.y - channeler.deckY)) <= 1;
    if (stillChanneling) {
      fire.channelTicks += 1;
      if (fire.channelTicks >= STEP_TICKS) {
        fire.stepsDone += 1;
        fire.channelTicks = 0;
      }
    } else {
      fire.stepsDone = 0;
      fire.channelTicks = 0;
    }
  }
  for (const [id, fire] of Object.entries(next.ship.fires)) {
    if (fire.stepsDone >= STEPS_TO_EXTINGUISH) delete next.ship.fires[id];
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/shared/src/types.ts backend/shared/src/ship.ts backend/shared/src/ship.test.ts
git commit -m "feat(ship): three-step channeled fire extinguishing with move-to-reset"
```

---

## Task 7: Fire spread + self-extinguish at zero oxygen

**Files:**
- Modify: `backend/shared/src/ship.ts` (`interiorDoorAt`, spread loop, self-extinguish loop)
- Modify: `backend/shared/src/ship.test.ts`

**Interfaces:**
- Consumes: `SIDE_DELTA`, `OPPOSITE_SIDE`, `roomAtDeckPosition` from Task 1.

- [ ] **Step 1: Write the failing tests**

Add to `backend/shared/src/ship.test.ts`:

```ts
test("fire self-extinguishes once its room runs out of oxygen", () => {
  let run = encounter("pilot", "bridge");
  run.ship.rooms.bridge!.oxygen = 0;
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 1, channelTicks: 2 };
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.fires.f0).toBeUndefined();
});

test("fire can spread into an adjacent room only through an open door", () => {
  let run = encounter("pilot", "weapons");
  run.ship.fires.f0 = { id: "f0", roomId: "weapons", x: 7, y: 3, stepsDone: 0, channelTicks: 0 };
  run = stepShipSimulation(run, () => 0);
  const spread = Object.values(run.ship.fires).some((fire) => fire.roomId === "bridge" && fire.x === 8 && fire.y === 3);
  expect(spread).toBe(true);
});

test("fire does not spread through a closed door", () => {
  let run = encounter("pilot", "weapons");
  run.ship.doors["bridge--weapons"]!.state = "closed";
  run.ship.fires.f0 = { id: "f0", roomId: "weapons", x: 7, y: 3, stepsDone: 0, channelTicks: 0 };
  run = stepShipSimulation(run, () => 0);
  const spread = Object.values(run.ship.fires).some((fire) => fire.roomId === "bridge");
  expect(spread).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test backend/shared/src/ship.test.ts`
Expected: FAIL — no self-extinguish or spread logic exists yet.

- [ ] **Step 3: Add the spread chance constant and `interiorDoorAt` helper**

Add near the other constants:

```ts
const FIRE_SPREAD_CHANCE = 0.0125;
const SPREAD_SIDES: DoorSide[] = ["e", "n", "s", "w"];
```

Add this helper after `deriveHullVents`:

```ts
function interiorDoorAt(doors: Record<string, ShipDoor>, x: number, y: number, side: DoorSide): ShipDoor | undefined {
  const delta = SIDE_DELTA[side];
  return Object.values(doors).find((door) => {
    if (door.kind !== "interior") return false;
    if (door.x === x && door.y === y && door.side === side) return true;
    return door.x === x + delta.dx && door.y === y + delta.dy && door.side === OPPOSITE_SIDE[side];
  });
}
```

- [ ] **Step 4: Add self-extinguish and spread loops**

In `stepShipSimulation`, insert right after the destruction-check loop (Task 4) and before the channel-progress loop (Task 6):

```ts
  for (const [id, fire] of Object.entries(next.ship.fires)) {
    if ((next.ship.rooms[fire.roomId]?.oxygen ?? 0) <= 0) delete next.ship.fires[id];
  }

  for (const fire of Object.values(next.ship.fires)) {
    if (rng() >= FIRE_SPREAD_CHANCE) continue;
    const side = SPREAD_SIDES[Math.floor(rng() * SPREAD_SIDES.length)]!;
    const delta = SIDE_DELTA[side];
    const nx = fire.x + delta.dx;
    const ny = fire.y + delta.dy;
    const neighborRoomId = roomAtDeckPosition(next.ship.layoutId, nx, ny);
    if (!neighborRoomId) continue;
    if (neighborRoomId !== fire.roomId) {
      const door = interiorDoorAt(next.ship.doors, fire.x, fire.y, side);
      if (!door || door.state !== "open") continue;
    }
    const alreadyBurning = Object.values(next.ship.fires).some(
      (candidate) => candidate.roomId === neighborRoomId && candidate.x === nx && candidate.y === ny,
    );
    if (alreadyBurning) continue;
    const id = `fire-${neighborRoomId}-${nx}-${ny}-${next.tick}`;
    next.ship.fires[id] = { id, roomId: neighborRoomId, x: nx, y: ny, stepsDone: 0, channelTicks: 0 };
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/shared/src/ship.ts backend/shared/src/ship.test.ts
git commit -m "feat(ship): fire spreads through open doors and self-extinguishes at zero oxygen"
```

---

## Task 8: Occupancy-driven oxygen drain, station-crewed production, door equalization

**Files:**
- Modify: `backend/shared/src/ship.ts` (`stepShipSimulation` oxygen handling)
- Modify: `backend/shared/src/ship.test.ts`

**Interfaces:**
- Consumes: `ShipSystemState.operatorCrewId` (existing), `ShipDoor.state`/`.kind` from Task 1.

- [ ] **Step 1: Write the failing tests**

In `backend/shared/src/ship.test.ts`, update the existing `"breach drains oxygen and low oxygen incapacitates crew deterministically"` test to isolate the room from equalization:

```ts
test("breach drains oxygen and low oxygen incapacitates crew deterministically", () => {
  let run = encounter("engineer", "engineering");
  for (const door of Object.values(run.ship.doors)) {
    if (door.roomA === "engineering" || door.roomB === "engineering") door.state = "locked";
  }
  run.ship.rooms.engineering!.breached = true;
  run.ship.rooms.engineering!.oxygen = 8;
  run.crew.c0!.health = 4;
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.rooms.engineering?.oxygen).toBe(5);
  expect(run.crew.c0?.incapacitated).toBe(true);
  expect(run.crew.c0?.bleedoutTicks).toBe(40);
});
```

Add new tests:

```ts
test("an empty room's oxygen does not change on its own", () => {
  let run = encounter("pilot", "bridge");
  for (const door of Object.values(run.ship.doors)) {
    if (door.roomA === "shields" || door.roomB === "shields") door.state = "locked";
  }
  run.ship.rooms.shields!.oxygen = 42;
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.rooms.shields?.oxygen).toBe(42);
});

test("occupied rooms drain oxygen faster with more crew present", () => {
  let solo = encounter("pilot", "shields");
  for (const door of Object.values(solo.ship.doors)) {
    if (door.roomA === "shields" || door.roomB === "shields") door.state = "locked";
  }
  solo = stepShipSimulation(solo, () => 1);
  expect(solo.ship.rooms.shields?.oxygen).toBe(99);

  let crewed = createRun("seed", [
    createCrew("c0", "s0", "Ada", "pilot", "shields"),
    createCrew("c1", "s1", "Bo", "gunner", "shields"),
  ]);
  crewed = castVote(crewed, "s0", "scrap-raider");
  crewed = castVote(crewed, "s1", "scrap-raider");
  for (const door of Object.values(crewed.ship.doors)) {
    if (door.roomA === "shields" || door.roomB === "shields") door.state = "locked";
  }
  crewed = stepShipSimulation(crewed, () => 1);
  expect(crewed.ship.rooms.shields?.oxygen).toBe(98);
});

test("oxygen only regenerates in the oxygen room while it is operated, and equalizes through its open door", () => {
  let run = encounter("engineer", "oxygen");
  for (const door of Object.values(run.ship.doors)) {
    if (door.id !== "medbay--oxygen") door.state = "locked";
  }
  run.ship.rooms.oxygen!.oxygen = 50;
  run.ship.rooms.medbay!.oxygen = 50;
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.rooms.oxygen?.oxygen).toBe(50);

  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "oxygen" });
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.rooms.oxygen?.oxygen).toBe(49);
  expect(run.ship.rooms.medbay?.oxygen).toBe(51);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test backend/shared/src/ship.test.ts`
Expected: FAIL — oxygen still auto-regenerates ship-wide without an operator, and the breach test's exact numbers no longer match without equalization isolation.

- [ ] **Step 3: Implement occupancy drain, station-crewed production, and door equalization**

Add constants near the others:

```ts
const OXY_DRAIN_PER_CREW = 1;
const OXY_PRODUCE_PER_TICK = 2;
const OXY_EQUALIZE_RATE = 2;
```

Replace the Task 5 room loop's oxygen branch. The full loop becomes:

```ts
  const occupancy = new Map<string, number>();
  for (const crew of Object.values(next.crew)) {
    if (crew.incapacitated) continue;
    occupancy.set(crew.roomId, (occupancy.get(crew.roomId) ?? 0) + 1);
  }

  for (const room of Object.values(next.ship.rooms)) {
    const thinAir = next.slopEffectId === "thin-air";
    if (room.breached) {
      room.oxygen = Math.max(0, room.oxygen - (thinAir ? 4 : 3));
    } else {
      const crewCount = occupancy.get(room.id) ?? 0;
      if (crewCount > 0) room.oxygen = Math.max(0, room.oxygen - crewCount * OXY_DRAIN_PER_CREW);
    }
    const roomFireCount = Object.values(next.ship.fires).filter((fire) => fire.roomId === room.id).length;
    if (roomFireCount > 0) {
      room.oxygen = Math.max(0, room.oxygen - FIRE_OXY_DRAIN_PER_TOKEN * roomFireCount);
      room.integrity = Math.max(0, room.integrity - FIRE_INTEGRITY_DAMAGE_PER_TOKEN * roomFireCount);
    }
  }

  const oxygenSystem = next.ship.systems.oxygen;
  const oxygenRoom = next.ship.rooms[oxygenSystem.roomId];
  if (oxygenRoom && oxygenSystem.health > 0 && oxygenSystem.power > 0 && oxygenSystem.operatorCrewId) {
    const thinAir = next.slopEffectId === "thin-air";
    oxygenRoom.oxygen = Math.min(100, oxygenRoom.oxygen + (thinAir ? 1 : OXY_PRODUCE_PER_TICK));
  }

  for (const door of Object.values(next.ship.doors)) {
    if (door.kind !== "interior" || door.state !== "open" || !door.roomB) continue;
    const roomA = next.ship.rooms[door.roomA];
    const roomB = next.ship.rooms[door.roomB];
    if (!roomA || !roomB) continue;
    const diff = roomA.oxygen - roomB.oxygen;
    if (Math.abs(diff) < 1) continue;
    const flow = Math.sign(diff) * Math.min(OXY_EQUALIZE_RATE, Math.abs(diff));
    roomA.oxygen = Math.max(0, Math.min(100, roomA.oxygen - flow));
    roomB.oxygen = Math.max(0, Math.min(100, roomB.oxygen + flow));
  }
```

This replaces both the old ship-wide auto-regen branch and the Task 5 fire-only loop — they're merged into one pass.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/shared/src/ship.ts backend/shared/src/ship.test.ts
git commit -m "feat(ship): occupancy-based oxygen drain, station-crewed production, door equalization"
```

---

## Task 9: Full regression sweep

**Files:** none new — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `bun test`
Expected: all tests pass (baseline was 28; this plan adds roughly 20 more).

- [ ] **Step 2: Grep for any stale references to the old door/fire shapes**

Run: `grep -rn "\.locked\b\|door\.a\b\|door\.b\b\|room\.fire\b\|\.fire = " backend/shared/src backend/server/src`
Expected: no output (everything migrated in Tasks 1-5).

- [ ] **Step 3: Type-check both packages**

Run: `cd backend/shared && bunx tsc --noEmit && cd ../server && bunx tsc --noEmit`
Expected: no errors. If either package has no `tsconfig.json` suited to standalone `tsc --noEmit`, run `bun run build` (or whatever build script exists in that package's `package.json`) instead — check `backend/shared/package.json` and `backend/server/package.json` scripts first.

- [ ] **Step 4: Commit if anything was left uncommitted**

```bash
git status
```

If clean, no action needed — every task already committed its own changes.

---

## Explicitly out of scope

Frontend rendering (`frontend/src/net/schemaAdapter.ts`, `frontend/src/game/ShipScreen.tsx`, `frontend/src/game/shipLayout.ts`, `frontend/src/game/useShipAudio.ts`) still expects the old door (`a`/`b`/`open`/`locked`) and room (`fire: number`) shapes, and has no concept of fire tokens, hull vents, or room integrity. It will render stale/incorrect data against the new schema until updated. This was out of scope per the design spec (which only covers `backend/shared` and `backend/server`) and needs its own follow-up plan.
