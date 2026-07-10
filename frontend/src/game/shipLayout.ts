// Deck coordinates (room x/y/w/h, door positions, crew deckX/deckY) are all
// 0-indexed cell units on a DECK_COLUMNS x DECK_ROWS grid, so any position
// converts to a fraction of the board as value / DECK_COLUMNS (or _ROWS).
// CSS grid lines are 1-indexed, so grid-column/row placement must add 1.
export const DECK_COLUMNS = 10;
export const DECK_ROWS = 6;

export interface RoomGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoomLayout extends RoomGeometry {
  name: string;
  systemId?: 'helm' | 'reactor' | 'weapons' | 'shields' | 'oxygen';
}

export interface DoorLike {
  id: string;
  a: string;
  b: string;
  open: boolean;
  locked: boolean;
}

export interface DoorLayout {
  id: string;
  orientation: 'horizontal' | 'vertical';
  x: number;
  y: number;
}

const ROOM_PRESENTATION: Record<string, Pick<RoomLayout, 'name' | 'systemId'>> = {
  engineering: { name: 'Engineering', systemId: 'reactor' },
  shields: { name: 'Shields', systemId: 'shields' },
  oxygen: { name: 'Oxygen', systemId: 'oxygen' },
  weapons: { name: 'Weapons', systemId: 'weapons' },
  medbay: { name: 'Medbay' },
  bridge: { name: 'Bridge', systemId: 'helm' },
};

export function roomLayouts(rooms: Record<string, RoomGeometry>): Record<string, RoomLayout> {
  return Object.fromEntries(Object.entries(rooms).map(([id, room]) => [id, {
    ...room,
    ...(ROOM_PRESENTATION[id] ?? { name: id }),
  }]));
}

export function adjacentRoomIds(roomId: string, doors: Record<string, DoorLike>): string[] {
  return Object.values(doors).flatMap((door) => {
    if (!door.open || door.locked) return [];
    if (door.a === roomId) return [door.b];
    if (door.b === roomId) return [door.a];
    return [];
  });
}

export function roomDoorLayouts(rooms: Record<string, RoomGeometry>, doors: Record<string, DoorLike>): DoorLayout[] {
  return Object.values(doors).map((door) => {
    const a = rooms[door.a];
    const b = rooms[door.b];
    if (!a || !b) throw new Error(`Missing room for door ${door.id}`);

    const verticalX = a.x + a.w === b.x ? b.x : b.x + b.w === a.x ? a.x : undefined;
    if (verticalX !== undefined) {
      const overlapStart = Math.max(a.y, b.y);
      const overlapEnd = Math.min(a.y + a.h, b.y + b.h);
      if (overlapEnd > overlapStart) {
        return { id: door.id, orientation: 'vertical', x: verticalX, y: overlapStart + (overlapEnd - overlapStart) / 2 };
      }
    }

    const horizontalY = a.y + a.h === b.y ? b.y : b.y + b.h === a.y ? a.y : undefined;
    if (horizontalY !== undefined) {
      const overlapStart = Math.max(a.x, b.x);
      const overlapEnd = Math.min(a.x + a.w, b.x + b.w);
      if (overlapEnd > overlapStart) {
        return { id: door.id, orientation: 'horizontal', x: overlapStart + (overlapEnd - overlapStart) / 2, y: horizontalY };
      }
    }

    throw new Error(`Connected rooms ${door.a} and ${door.b} do not share a wall`);
  });
}
