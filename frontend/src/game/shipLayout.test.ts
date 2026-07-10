import { adjacentRoomIds, roomDoorLayouts, roomLayouts } from './shipLayout';

const rooms = {
  engineering: { x: 2, y: 3, w: 2, h: 2 },
  shields: { x: 4, y: 2, w: 2, h: 2 },
  oxygen: { x: 4, y: 4, w: 2, h: 2 },
};

const doors = {
  'engineering--shields': { id: 'engineering--shields', a: 'engineering', b: 'shields', open: true, locked: false },
  'engineering--oxygen': { id: 'engineering--oxygen', a: 'engineering', b: 'oxygen', open: true, locked: false },
};

test('room presentation is layered onto authoritative geometry', () => {
  expect(roomLayouts(rooms).engineering).toEqual({ name: 'Engineering', systemId: 'reactor', x: 2, y: 3, w: 2, h: 2 });
});

test('reachable rooms respect authoritative door state', () => {
  expect(adjacentRoomIds('engineering', doors).sort()).toEqual(['oxygen', 'shields']);
  expect(adjacentRoomIds('engineering', {
    ...doors,
    'engineering--shields': { ...doors['engineering--shields'], locked: true },
    'engineering--oxygen': { ...doors['engineering--oxygen'], open: false },
  })).toEqual([]);
});

test('door markers are placed on the shared wall', () => {
  expect(roomDoorLayouts(rooms, doors)).toEqual([
    { id: 'engineering--shields', orientation: 'vertical', x: 4, y: 3.5 },
    { id: 'engineering--oxygen', orientation: 'vertical', x: 4, y: 4.5 },
  ]);
});
