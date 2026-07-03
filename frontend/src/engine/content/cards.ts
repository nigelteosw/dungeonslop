export type CardEffect = 'damage' | 'heal' | 'block';
export type CardShape = 'melee' | 'ranged' | 'line' | 'self';
export interface CardDef { id: string; name: string; cost: number; effect: CardEffect; shape: CardShape; power: number; range?: number; }

export const CARDS: Record<string, CardDef> = {
  slash:    { id: 'slash',    name: 'Slash',        cost: 1, effect: 'damage', shape: 'melee',  power: 2 },
  cleave:   { id: 'cleave',   name: 'Cleave',       cost: 2, effect: 'damage', shape: 'line',   power: 1, range: 3 },
  block:    { id: 'block',    name: 'Shield Block', cost: 1, effect: 'block',  shape: 'self',   power: 5 },
  firebolt: { id: 'firebolt', name: 'Firebolt',     cost: 1, effect: 'damage', shape: 'ranged', power: 2, range: 6 },
  frost:    { id: 'frost',    name: 'Frost Shard',  cost: 1, effect: 'damage', shape: 'ranged', power: 1, range: 5 },
  vulcan:   { id: 'vulcan',   name: 'AK-47 Vulcan', cost: 2, effect: 'damage', shape: 'line',   power: 2, range: 9 },
  heal:     { id: 'heal',     name: 'Mend',         cost: 1, effect: 'heal',   shape: 'ranged', power: 4, range: 6 },
};
