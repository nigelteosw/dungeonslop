import { z } from "zod";

export type UpgradeEffect =
  | { kind: "maxHp"; amount: number }
  | { kind: "attack"; amount: number }
  | { kind: "moveRange"; amount: number }
  | { kind: "maxEnergy"; amount: number }
  | { kind: "addCard"; cardId: string };

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  effect: UpgradeEffect;
}

const upgradeEffectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("maxHp"), amount: z.number().int() }),
  z.object({ kind: z.literal("attack"), amount: z.number().int() }),
  z.object({ kind: z.literal("moveRange"), amount: z.number().int() }),
  z.object({ kind: z.literal("maxEnergy"), amount: z.number().int() }),
  z.object({ kind: z.literal("addCard"), cardId: z.string().min(1) }),
]);

const upgradeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  effect: upgradeEffectSchema,
}) satisfies z.ZodType<UpgradeDef>;

export const UPGRADES = z.record(upgradeSchema).parse({
  iron_lungs: { id: "iron_lungs", name: "Iron Lungs", description: "+2 max HP.", effect: { kind: "maxHp", amount: 2 } },
  bigger_sword: { id: "bigger_sword", name: "Bigger Sword", description: "+1 attack.", effect: { kind: "attack", amount: 1 } },
  cardio: { id: "cardio", name: "Dungeon Cardio", description: "+1 move range.", effect: { kind: "moveRange", amount: 1 } },
  coffee: { id: "coffee", name: "Suspicious Coffee", description: "+1 max energy.", effect: { kind: "maxEnergy", amount: 1 } },
  learn_vulcan: { id: "learn_vulcan", name: "Gun Wizardry", description: "Add AK-47 Vulcan.", effect: { kind: "addCard", cardId: "vulcan" } },
  learn_riposte: { id: "learn_riposte", name: "Pointy Reflexes", description: "Add Riposte.", effect: { kind: "addCard", cardId: "riposte" } },
  padded_boots: { id: "padded_boots", name: "Padded Boots", description: "+1 move range.", effect: { kind: "moveRange", amount: 1 } },
  protein: { id: "protein", name: "Knight Protein", description: "+2 max HP.", effect: { kind: "maxHp", amount: 2 } },
  staff_day: { id: "staff_day", name: "Staff Day", description: "+1 attack.", effect: { kind: "attack", amount: 1 } },
  spare_battery: { id: "spare_battery", name: "Spare Battery", description: "+1 max energy.", effect: { kind: "maxEnergy", amount: 1 } },
  learn_arcane_armor: { id: "learn_arcane_armor", name: "Dress Code", description: "Add Arcane Armor.", effect: { kind: "addCard", cardId: "arcane_armor" } },
  learn_lightning: { id: "learn_lightning", name: "Long Zap", description: "Add Lightning Line.", effect: { kind: "addCard", cardId: "lightning_line" } },
  hard_hat: { id: "hard_hat", name: "Hard Hat", description: "+2 max HP.", effect: { kind: "maxHp", amount: 2 } },
  whetstone: { id: "whetstone", name: "Whetstone", description: "+1 attack.", effect: { kind: "attack", amount: 1 } },
  sprint_drills: { id: "sprint_drills", name: "Sprint Drills", description: "+1 move range.", effect: { kind: "moveRange", amount: 1 } },
  mana_coupon: { id: "mana_coupon", name: "Mana Coupon", description: "+1 max energy.", effect: { kind: "maxEnergy", amount: 1 } },
  first_aid: { id: "first_aid", name: "First Aid Goblin", description: "+2 max HP.", effect: { kind: "maxHp", amount: 2 } },
  angry: { id: "angry", name: "Productive Anger", description: "+1 attack.", effect: { kind: "attack", amount: 1 } },
  long_legs: { id: "long_legs", name: "Longer Legs", description: "+1 move range.", effect: { kind: "moveRange", amount: 1 } },
  blue_drink: { id: "blue_drink", name: "Blue Drink", description: "+1 max energy.", effect: { kind: "maxEnergy", amount: 1 } },
}) as Record<string, UpgradeDef>;
