import type { GameState, Unit } from "./types";
import { CARDS } from "./content/cards";
import { EQUIPMENT, type EquipmentEffect } from "./content/equipment";
import { SLOP_CARDS } from "./content/slopcards";
import { UPGRADES, type UpgradeEffect } from "./content/upgrades";
import { type Rng, shuffle } from "./rng";

const clone = (s: GameState): GameState => structuredClone(s);

function applyStat(unit: Unit, effect: EquipmentEffect | UpgradeEffect, sign: 1 | -1): void {
  switch (effect.kind) {
    case "maxHp":
      unit.maxHp = Math.max(1, unit.maxHp + sign * effect.amount);
      unit.hp = Math.min(unit.maxHp, Math.max(1, unit.hp + sign * effect.amount));
      break;
    case "attack":
      unit.attack = Math.max(0, unit.attack + sign * effect.amount);
      break;
    case "moveRange":
      unit.moveRange = Math.max(1, unit.moveRange + sign * effect.amount);
      break;
    case "maxEnergy":
      unit.maxEnergy = Math.max(1, unit.maxEnergy + sign * effect.amount);
      unit.energy = Math.min(unit.maxEnergy, Math.max(0, unit.energy + sign * effect.amount));
      break;
    case "addCard":
      if (sign > 0) unit.discard.push(effect.cardId);
      break;
  }
}

export function applyUpgrade(s: GameState, unitId: string, upgradeId: string): GameState {
  const upgrade = UPGRADES[upgradeId];
  if (!upgrade) throw new Error("unknown upgrade");
  if (upgrade.effect.kind === "addCard" && !CARDS[upgrade.effect.cardId]) throw new Error("upgrade references unknown card");

  const n = clone(s);
  const unit = n.units[unitId];
  if (!unit || unit.team !== "player") throw new Error("unknown player unit");
  applyStat(unit, upgrade.effect, 1);
  return n;
}

export function equip(s: GameState, unitId: string, itemId: string): GameState {
  const item = EQUIPMENT[itemId];
  if (!item) throw new Error("unknown equipment");

  const n = clone(s);
  const unit = n.units[unitId];
  if (!unit || unit.team !== "player") throw new Error("unknown player unit");
  if (!unit.inventory?.includes(itemId)) throw new Error("item is not in inventory");
  unit.equipment ??= {};

  const currentId = unit.equipment[item.slot];
  if (currentId === itemId) return n;
  if (currentId) {
    const current = EQUIPMENT[currentId];
    if (current) applyStat(unit, current.effect, -1);
  }
  unit.equipment[item.slot] = itemId;
  applyStat(unit, item.effect, 1);
  return n;
}

export function drawSlopCard(rng: Rng): string {
  const ids = Object.keys(SLOP_CARDS);
  const index = Math.floor(rng() * ids.length);
  const id = ids[index];
  if (!id) throw new Error("no slop cards configured");
  return id;
}

export function rollRewardOptions(rng: Rng, count = 3): string[] {
  return shuffle(Object.keys(UPGRADES), rng).slice(0, count);
}
