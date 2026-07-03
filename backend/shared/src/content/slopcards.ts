import { z } from "zod";
import type { RoomModifiers } from "../types";

export interface SlopCardDef {
  id: string;
  name: string;
  description: string;
  effect: RoomModifiers;
}

const slopCardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  effect: z.object({
    moveRangeDelta: z.number().int().optional(),
    monsterHpDelta: z.number().int().optional(),
    energyDelta: z.number().int().optional(),
    losRangeDelta: z.number().int().optional(),
  }),
}) satisfies z.ZodType<SlopCardDef>;

export const SLOP_CARDS = z.record(slopCardSchema).parse({
  gravity_tax: { id: "gravity_tax", name: "Gravity Tax", description: "Everyone moves a little worse.", effect: { moveRangeDelta: -1 } },
  goblin_union: { id: "goblin_union", name: "Goblin Union", description: "Monsters get sturdier.", effect: { monsterHpDelta: 2 } },
  broken_torch: { id: "broken_torch", name: "Broken Torch", description: "Ranged lines of sight are shorter.", effect: { losRangeDelta: -2 } },
  energy_drink: { id: "energy_drink", name: "Energy Drink", description: "Players get extra energy.", effect: { energyDelta: 1 } },
  budget_cuts: { id: "budget_cuts", name: "Budget Cuts", description: "Players lose a step.", effect: { moveRangeDelta: -1 } },
  overtime: { id: "overtime", name: "Dungeon Overtime", description: "Monsters get more HP.", effect: { monsterHpDelta: 1 } },
  good_shoes: { id: "good_shoes", name: "Good Shoes", description: "Players move farther.", effect: { moveRangeDelta: 1 } },
  caffeine_cloud: { id: "caffeine_cloud", name: "Caffeine Cloud", description: "Players gain energy.", effect: { energyDelta: 1 } },
  fog_machine: { id: "fog_machine", name: "Fog Machine", description: "Ranged lines of sight shrink.", effect: { losRangeDelta: -1 } },
  cardboard_walls: { id: "cardboard_walls", name: "Cardboard Walls", description: "Monsters are easier to chew through.", effect: { monsterHpDelta: -1 } },
  heroic_stride: { id: "heroic_stride", name: "Heroic Stride", description: "Players move farther.", effect: { moveRangeDelta: 1 } },
  stale_air: { id: "stale_air", name: "Stale Air", description: "Players have less energy.", effect: { energyDelta: -1 } },
  monster_bulk_day: { id: "monster_bulk_day", name: "Monster Bulk Day", description: "Monsters gain HP.", effect: { monsterHpDelta: 2 } },
  clear_skies: { id: "clear_skies", name: "Clear Skies Underground", description: "Ranged lines of sight extend.", effect: { losRangeDelta: 2 } },
  suspicious_floor: { id: "suspicious_floor", name: "Suspicious Floor", description: "Movement gets worse.", effect: { moveRangeDelta: -1 } },
}) as Record<string, SlopCardDef>;
