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
