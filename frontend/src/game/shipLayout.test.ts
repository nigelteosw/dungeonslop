import { adjacentRoomIds, roomDoorLayouts, roomLayouts } from './shipLayout';

const rooms = {
  engineering: { x: 2, y: 3, w: 2, h: 2 },
  shields: { x: 4, y: 2, w: 2, h: 2 },
  oxygen: { x: 4, y: 4, w: 2, h: 2 },
};

const doors = {
  'engineering--shields': { id: 'engineering--shields', x: 3, y: 3, side: 'e' as const, kind: 'interior' as const, state: 'open' as const, roomA: 'engineering', roomB: 'shields' },
  'engineering--oxygen': { id: 'engineering--oxygen', x: 3, y: 4, side: 'e' as const, kind: 'interior' as const, state: 'open' as const, roomA: 'engineering', roomB: 'oxygen' },
};

test('room presentation is layered onto authoritative geometry', () => {
  expect(roomLayouts(rooms).engineering).toEqual({ name: 'Engineering', systemId: 'reactor', x: 2, y: 3, w: 2, h: 2 });
});

test('reachable rooms respect authoritative door state', () => {
  expect(adjacentRoomIds('engineering', doors).sort()).toEqual(['oxygen', 'shields']);
  expect(adjacentRoomIds('engineering', {
    ...doors,
    'engineering--shields': { ...doors['engineering--shields'], state: 'locked' as const },
    'engineering--oxygen': { ...doors['engineering--oxygen'], state: 'closed' as const },
  })).toEqual([]);
});

test('door markers use authoritative tile anchors, including hull vents', () => {
  expect(roomDoorLayouts({
    ...doors,
    'hull-engineering-2-3-w': { id: 'hull-engineering-2-3-w', x: 2, y: 3, side: 'w', kind: 'hull', state: 'locked', roomA: 'engineering' },
  })).toEqual([
    { id: 'engineering--shields', orientation: 'vertical', x: 4, y: 3.5 },
    { id: 'engineering--oxygen', orientation: 'vertical', x: 4, y: 4.5 },
    { id: 'hull-engineering-2-3-w', orientation: 'vertical', x: 2, y: 3.5 },
  ]);
});
