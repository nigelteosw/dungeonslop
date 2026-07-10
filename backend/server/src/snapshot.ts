import type { RunState, ShipDoor, ShipRoomState } from "shared";

export interface ShipSnapshotProjection {
  rooms: ShipRoomState[];
  doors: ShipDoor[];
}

export function projectShipSnapshot(run: RunState): ShipSnapshotProjection {
  return {
    rooms: Object.values(run.ship.rooms),
    doors: Object.values(run.ship.doors),
  };
}
