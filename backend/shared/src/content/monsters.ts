import { z } from "zod";

export interface MonsterDef {
  id: string;
  name: string;
  maxHp: number;
  moveRange: number;
  attack: number;
  lootTable: string[];
}

const monsterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  maxHp: z.number().int().positive(),
  moveRange: z.number().int().nonnegative(),
  attack: z.number().int().nonnegative(),
  lootTable: z.array(z.string().min(1)),
}) satisfies z.ZodType<MonsterDef>;

export const MONSTERS = z.record(monsterSchema).parse({
  goblin: { id: "goblin", name: "Goblin", maxHp: 6, moveRange: 4, attack: 3, lootTable: ["rusty_sword", "lucky_tooth"] },
  slime: { id: "slime", name: "Slime", maxHp: 9, moveRange: 2, attack: 2, lootTable: ["gel_amulet", "buckler"] },
  skeleton: { id: "skeleton", name: "Skeleton", maxHp: 8, moveRange: 3, attack: 4, lootTable: ["bone_mail", "ash_staff"] },
  cultist: { id: "cultist", name: "Cultist", maxHp: 10, moveRange: 3, attack: 5, lootTable: ["hex_ring", "moon_robe"] },
  dragon: { id: "dragon", name: "Budget Dragon", maxHp: 28, moveRange: 3, attack: 7, lootTable: ["dragon_spoon"] },
}) as Record<string, MonsterDef>;
