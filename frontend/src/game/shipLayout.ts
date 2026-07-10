import type { ShipDoorView, SystemId } from '../net/schemaAdapter';

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
  systemId?: SystemId;
}

export type DoorLike = ShipDoorView;

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
    if (door.kind !== 'interior' || door.state !== 'open' || !door.roomB) return [];
    if (door.roomA === roomId) return [door.roomB];
    if (door.roomB === roomId) return [door.roomA];
    return [];
  });
}

export function roomDoorLayouts(doors: Record<string, DoorLike>): DoorLayout[] {
  return Object.values(doors).map((door) => {
    if (door.side === 'e') return { id: door.id, orientation: 'vertical', x: door.x + 1, y: door.y + .5 };
    if (door.side === 'w') return { id: door.id, orientation: 'vertical', x: door.x, y: door.y + .5 };
    if (door.side === 's') return { id: door.id, orientation: 'horizontal', x: door.x + .5, y: door.y + 1 };
    return { id: door.id, orientation: 'horizontal', x: door.x + .5, y: door.y };
  });
}
