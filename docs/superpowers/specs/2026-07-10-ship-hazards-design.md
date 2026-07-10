# Ship Hazards — Doors, Venting, Fire, Oxygen, Room Damage

**Status:** approved direction
**Date:** 2026-07-10
**Relates to:** `2026-07-04-dungeonslop-v0-design.md`, sections 6 ("Ship simulation") and 7 ("Enemy behavior")

## 1. Purpose

The v0 design describes rooms tracking oxygen, fire, and breaches at a high level, with doors that equalize oxygen when open. The current implementation (`backend/shared/src/ship.ts`, `types.ts`) only partially matches that: fire and oxygen are per-room scalars, doors are abstract room-to-room edges with no position, oxygen regenerates automatically without requiring a crewed station, and only 5 of 6 rooms have any damage stat (via their system). This spec replaces those stubs with the detailed mechanics below. It does not change lobby, voting, sector map, or upgrade systems.

## 2. Scope

### Included
- Tile-positioned doors with three states (open / closed / locked), controllable ship-wide from a crewed bridge.
- Hull-vent doors derived from ship geometry, and the venting mechanic (near-instant, lethal to occupants).
- Per-tile fire tokens with multi-step extinguishing, spread, oxygen consumption, and room-integrity damage.
- Oxygen depletion tied to room occupancy and replenishment tied to a crewed oxygen station, with equalization through open doors.
- A new per-room integrity stat, room destruction, and its consequences (system offline, auto-breach, doors auto-lock).
- Updated weapon hit resolution: shield gate (unchanged), random room targeting (unchanged), room-integrity damage (new), tile-positioned fire placement (updated).

### Explicitly deferred
- Per-tile oxygen simulation (oxygen stays one number per room; only door/vent position is tile-granular).
- Any change to voting, sector map, ship-layout rebuild, or upgrade systems. (During this design session the user raised a related but separate idea — no vote timers, unanimous-style agreement, one player manually triggering resolution, and rebuilding the ship layout by moving rooms around after the default start — this belongs to the layout/vote system, not ship hazards, and is not covered here.)
- Non-system rooms beyond medbay (v0 still has exactly 6 rooms; nothing here assumes more).
- Balancing/tuning numbers (depletion rates, spread probability, damage-per-tick) — implemented with placeholder values matched to today's constants and adjusted after playtest, per the "we can always fix after playtest" call.

## 3. Data model changes

`ShipDoor` changes from an abstract room-pair edge to a tile-anchored object:

```ts
interface ShipDoor {
  id: string;
  x: number;
  y: number;
  side: "n" | "s" | "e" | "w";   // which edge of tile (x,y) the door sits on
  kind: "interior" | "hull";
  state: "open" | "closed" | "locked";
  roomA: string;                  // room owning tile (x,y)
  roomB?: string;                 // adjacent room, absent for hull vents (leads to space)
}
```

`ShipRoomState` gains an integrity stat and switches `fire` from a scalar to a token list:

```ts
interface FireToken { id: string; roomId: string; x: number; y: number; stepsDone: 0 | 1 | 2 | 3; }

interface ShipRoomState {
  id: string;
  x: number; y: number; w: number; h: number;
  oxygen: number;
  integrity: number;
  maxIntegrity: number;
  destroyed: boolean;
  breached: boolean;
  // fire tokens live in a separate top-level collection (see ShipState), keyed by roomId
}

interface ShipState {
  // ...existing fields...
  fires: Record<string, FireToken>;
}
```

Every room gets `integrity`/`maxIntegrity`, including medbay, independent of whether it hosts a system.

## 4. Doors, hull vents, and bridge control

**Positioning.** Interior doors are authored per ship layout at a specific matching tile pair on the shared wall between two rooms (same authoring shape as today's `doors` list, but each entry now carries a tile coordinate instead of being a bare room pair). Hull vents are *derived*, not authored: for every room, any boundary tile edge that isn't shared with another room's bounding box becomes an implicit hull-vent door at that tile. A room with a long exposed wall can have several independent vent tiles.

**States.**
- **Open** — crew pass through freely; the room's oxygen equalizes with whatever is on the other side each tick (another room, for interior doors).
- **Closed** — blocks movement and airflow; any crew member standing at that tile can interact with it to open it themselves.
- **Locked** — blocks movement and airflow; only the ship-wide bridge panel can change it.

Hull vents start **locked**.

**Bridge control.** A crew member must be actively `operate`-ing the bridge/helm station (same pattern as weapons/shields) to access a ship-wide door panel. While operating it, they can set the state of any door or hull vent anywhere on the ship. Leaving the station drops this access. This is the only way to open a hull vent.

**Venting.** Opening a hull vent tile resolves immediately: that room's oxygen drops to 0, every fire token in that room is cleared, and any crew currently in the room are killed and removed. The vent's tile position determines where a crew member must stand to interact with the physical door object and how it renders — the effect is room-scoped, not tile-scoped, because oxygen remains a per-room stat (see §6).

Venting is distinct from a **breach** (§7), which is a gradual, repairable leak caused by damage, not deliberate crew action.

## 5. Fire

Fire is a set of tokens, each pinned to one tile, with a per-room cap equal to that room's tile count (e.g. 4 in a 2x2 room). Each simulation tick, every fire token:

1. burns any crew standing on or adjacent to its tile;
2. consumes a small, fixed amount of its room's oxygen;
3. damages its room's integrity by a small, fixed amount;
4. has a small chance to spawn a new token on an adjacent open tile — within the same room, or into a neighboring room if the connecting door is **open** (fire needs airflow, same gate as oxygen equalization; closed/locked doors block spread).

**Self-extinguishing.** If a room's oxygen reaches 0, every fire token in that room is removed — no oxidizer, no fire. Because fire has been damaging the room's integrity the whole time it burned, a room that "ran out of air" has typically also taken heavy integrity damage; self-extinguishing is not a rescue.

**Extinguishing (crew action).** A fire token needs 3 discrete steps, roughly 2 seconds each, to be put out. A crew member must remain on or adjacent to that exact tile and hold the extinguish action to advance its steps. Moving away or switching to a different fire token resets that token's progress to step 0. Taking damage while channeling (from that fire's own burn, a boarder, etc.) does **not** interrupt progress — only leaving does.

## 6. Oxygen

Oxygen remains one scalar per room (0–100). Each tick:

- A room with **no crew present** does not lose oxygen on its own — only fire, breach, or venting drain it.
- A room with crew present loses a small fixed amount **per crew member** in it (more occupants drain it faster).
- Producing oxygen requires a crew member actively `operate`-ing the oxygen station in the oxygen room (standing in the room is not sufficient). While crewed, the oxygen room's own level rises, and any surplus equalizes outward each tick to adjacent rooms through **open** doors only — closed or locked doors block equalization, letting the bridge deliberately starve or protect a room.
- Crew standing in a room at very low oxygen (existing threshold, ≤10) continue taking periodic damage, unchanged from the current implementation.

## 7. Room damage and destruction

Every room has `integrity`/`maxIntegrity`, independent of any system it hosts. Integrity is reduced by:
- sustained fire damage (§5), and
- weapon hits that land on that room (§8).

**Destroyed** (integrity reaches 0):
- any system housed in that room drops to 0 health and goes fully offline — it needs sustained repair from zero, not a quick top-up;
- the room becomes **breached**, leaking oxygen gradually until sealed, same as a weapon-caused breach;
- every door leading to that room — interior and hull — **auto-locks**. Crew already inside are not ejected, but nobody can enter or leave until the bridge deliberately unlocks a door again (e.g. to send an engineer in to repair it).

A **breach** (from destruction or a direct weapon hit) is the softer hazard: gradual oxygen leak, repairable via the existing `sealBreach` crew action, no instant kill. It is distinct from deliberate venting (§4), which is near-instant and lethal to anyone inside.

## 8. Weapon hit resolution

Unchanged from the current implementation except where noted:

1. **Shield check** (unchanged): each enemy volley first checks `ship.shields > 0`. If shields remain, decrement one layer; nothing else happens.
2. **Random room targeting** (unchanged): if shields are down, uniformly pick one of the 6 rooms.
3. **Room integrity damage** (new): the hit reduces the target room's integrity directly. If the room also hosts a system, that system's health is reduced too (as today).
4. **Fire or breach** (updated): the existing 45%-fire / else-breach split is unchanged, but a resulting fire now spawns as a single new fire token at a random tile within the hit room, instead of setting a scalar.

## 9. Timing

The server ticks every 400ms (`DungeonRoom.ts`). "~2 seconds per extinguish step" is therefore ~5 ticks per step, ~15 ticks (~6s) to fully extinguish one fire token. This and all other rates in this spec (oxygen drain/production per tick, fire spread chance, integrity damage per tick) are implementation-level constants to be tuned after playtest, not fixed requirements.
