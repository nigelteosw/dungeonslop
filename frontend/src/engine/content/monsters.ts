export interface MonsterDef { id: string; name: string; maxHp: number; moveRange: number; attack: number; lootTable: string[]; }

export const MONSTERS: Record<string, MonsterDef> = {
  goblin: { id: 'goblin', name: 'Goblin', maxHp: 6, moveRange: 4, attack: 3, lootTable: [] },
  slime:  { id: 'slime',  name: 'Slime',  maxHp: 9, moveRange: 2, attack: 2, lootTable: [] },
};
