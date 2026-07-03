import type { GameState } from '../engine';

export const FIXTURE: GameState = {
  board: {
    width: 16,
    height: 16,
    walls: [
      { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 8, y: 6 }, { x: 9, y: 6 },
      { x: 6, y: 9 }, { x: 7, y: 9 }, { x: 8, y: 9 }, { x: 9, y: 9 },
    ],
    exit: { x: 15, y: 15 },
  },
  units: {
    p0: {
      id: 'p0', team: 'player', name: 'Knight', defId: 'knight', pos: { x: 1, y: 1 },
      hp: 14, maxHp: 14, moveRange: 4, attack: 3, energy: 3, maxEnergy: 3, block: 0,
      hasMoved: false, deck: [], hand: ['slash', 'block', 'cleave'], discard: [],
    },
    p1: {
      id: 'p1', team: 'player', name: 'Wizard', defId: 'wizard', pos: { x: 1, y: 3 },
      hp: 9, maxHp: 9, moveRange: 4, attack: 2, energy: 3, maxEnergy: 3, block: 0,
      hasMoved: false, deck: [], hand: ['firebolt', 'frost', 'vulcan'], discard: [],
    },
    m0: {
      id: 'm0', team: 'monster', name: 'Goblin', defId: 'goblin', pos: { x: 13, y: 2 },
      hp: 6, maxHp: 6, moveRange: 4, attack: 3, energy: 0, maxEnergy: 0, block: 0,
      hasMoved: false, deck: [], hand: [], discard: [],
    },
    m1: {
      id: 'm1', team: 'monster', name: 'Slime', defId: 'slime', pos: { x: 13, y: 13 },
      hp: 9, maxHp: 9, moveRange: 2, attack: 2, energy: 0, maxEnergy: 0, block: 0,
      hasMoved: false, deck: [], hand: [], discard: [],
    },
  },
  order: ['p0', 'p1'],
  activeIndex: 0,
  phase: 'player',
  roomIndex: 0,
};
