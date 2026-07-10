import type { EnemyState, RunState, VoteState } from "./types";
import type { Rng } from "./rng";
import { applyShipLayout, stepShipSimulation } from "./ship";

export const MAP_NODES: Record<string, { name: string; description: string; kind: "combat" | "event"; enemy?: Omit<EnemyState, "weaponChargeTicks"> }> = {
  "scrap-raider": { name: "Scrap Raider", description: "Balanced weapons. Predictably hostile.", kind: "combat", enemy: { id: "scrap-raider", hull: 18, maxHull: 18, shields: 1, weaponChargeMaxTicks: 32 } },
  "shield-leech": { name: "Shield Leech", description: "More shields, slower cannon.", kind: "combat", enemy: { id: "shield-leech", hull: 16, maxHull: 16, shields: 3, weaponChargeMaxTicks: 38 } },
  "volatile-derelict": { name: "Volatile Derelict", description: "Fragile, fast-firing, full of scrap.", kind: "combat", enemy: { id: "volatile-derelict", hull: 12, maxHull: 12, shields: 0, weaponChargeMaxTicks: 26 } },
  "suspicious-signal": { name: "Suspicious Signal", description: "A survivor and a wreck both request attention.", kind: "event" },
  "quarantine-buoy": { name: "Quarantine Buoy", description: "A sealed pod promises both disease and salvage.", kind: "event" },
  "union-freighter": { name: "Union Freighter", description: "Striking haulers request aid. Management requests violence.", kind: "event" },
};

export const UPGRADES: Record<string, { name: string; description: string }> = {
  "reinforced-hull": { name: "Reinforced Hull", description: "+6 maximum hull and repair 6 hull." },
  "shield-capacitor": { name: "Shield Capacitor", description: "+1 maximum shield and restore shields." },
  "reactor-tap": { name: "Questionable Reactor Tap", description: "+1 reactor capacity and weapons power." },
  "auto-turret": { name: "Jury-Rigged Turret", description: "Weapons fire slowly even when nobody is operating them." },
  "medbay-foam": { name: "Medbay Foam", description: "The medbay heals crew and suppresses its own fires." },
  "blast-doors": { name: "Blast Doors", description: "Boarders move between rooms half as often." },
};

export const SLOP_EFFECTS: Record<string, { name: string; description: string }> = {
  "hot-reactor-summer": { name: "Hot Reactor Summer", description: "Engineering may spontaneously catch fire." },
  "thin-air": { name: "Thin Air", description: "Breaches drain oxygen faster and oxygen recovers slowly." },
  "volatile-weapons": { name: "Volatile Weapons", description: "Player volleys hit harder but may ignite weapons." },
};

export const SHIP_LAYOUT_OPTIONS: Record<string, { name: string; description: string }> = {
  balanced: { name: "Balanced Frame", description: "Split support systems across two central corridors." },
  battle: { name: "Battle Spine", description: "Place shields and weapons together near the bridge." },
  rescue: { name: "Rescue Core", description: "Move medbay to the protected center of the ship." },
};

const SLOP_ORDER = ["hot-reactor-summer", "thin-air", "volatile-weapons"] as const;

function vote(kind: VoteState["kind"], options: string[], tick: number): VoteState {
  return { kind, options, votes: {}, deadlineTick: tick + 40 };
}

function winningOption(state: RunState): string {
  const current = state.vote;
  if (!current) throw new Error("no active vote");
  const counts = new Map<string, number>();
  for (const option of Object.values(current.votes)) counts.set(option, (counts.get(option) ?? 0) + 1);
  const high = Math.max(0, ...counts.values());
  const tied = current.options.filter((option) => (counts.get(option) ?? 0) === high);
  const captain = Object.values(state.crew)[state.captainSeat % Object.keys(state.crew).length];
  const captainVote = captain ? current.votes[captain.ownerId] : undefined;
  return captainVote && tied.includes(captainVote) ? captainVote : tied[0] ?? current.options[0]!;
}

function applyUpgrade(state: RunState, id: string): void {
  if (!UPGRADES[id]) throw new Error("unknown upgrade");
  state.installedUpgrades.push(id);
  if (id === "reinforced-hull") {
    state.ship.maxHull += 6;
    state.ship.hull = Math.min(state.ship.maxHull, state.ship.hull + 6);
  } else if (id === "shield-capacitor") {
    state.ship.maxShields += 1;
    state.ship.shields = state.ship.maxShields;
  } else if (id === "reactor-tap") {
    state.ship.reactorCapacity += 1;
    state.ship.systems.weapons.maxPower += 1;
    state.ship.systems.weapons.power += 1;
  }
}

function beginNode(state: RunState, nodeId: string): void {
  const node = MAP_NODES[nodeId];
  if (!node) throw new Error("unknown map node");
  state.currentNodeId = nodeId;
  if (node.kind === "event") {
    state.status = "eventVote";
    state.enemy = undefined;
    const eventOptions = nodeId === "suspicious-signal"
      ? ["rescue-survivor", "strip-wreck"]
      : nodeId === "quarantine-buoy"
        ? ["purge-buoy", "open-buoy"]
        : ["pay-union-dues", "cross-picket-line"];
    state.vote = vote("event", eventOptions, state.tick);
    state.objectiveText = "Decide what to do with the suspicious signal";
    return;
  }
  if (!node.enemy) throw new Error("combat node has no enemy");
  state.status = "encounter";
  state.enemy = { ...node.enemy, weaponChargeTicks: 0 };
  state.vote = undefined;
  state.objectiveText = `Disable the ${node.name}`;
  for (const system of Object.values(state.ship.systems)) system.operatorCrewId = undefined;
}

function resolveVote(state: RunState): RunState {
  const next = structuredClone(state);
  const current = next.vote;
  if (!current) return next;
  const winner = winningOption(next);
  if (current.kind === "map") {
    beginNode(next, winner);
    return next;
  }
  if (current.kind === "event") {
    if (winner === "rescue-survivor") {
      next.ship.scrap += 3;
      for (const crew of Object.values(next.crew)) crew.health = Math.min(crew.maxHealth, crew.health + 20);
    } else if (winner === "strip-wreck") {
      next.ship.scrap += 10;
      next.ship.rooms.oxygen!.breached = true;
    } else if (winner === "purge-buoy") {
      next.ship.scrap += 4;
      next.ship.rooms.oxygen!.fire = 1;
    } else if (winner === "open-buoy") {
      next.ship.scrap += 12;
      next.boarders.eventBoarder = { id: "eventBoarder", roomId: "medbay", health: 60, targetRoomId: "engineering" };
    } else if (winner === "pay-union-dues") {
      next.ship.scrap = Math.max(0, next.ship.scrap - 4);
      next.ship.hull = Math.min(next.ship.maxHull, next.ship.hull + 8);
    } else if (winner === "cross-picket-line") {
      next.ship.scrap += 6;
      next.ship.rooms.engineering!.breached = true;
      next.ship.rooms.engineering!.fire = 1;
    } else {
      throw new Error("unknown event choice");
    }
    beginNode(next, "scrap-raider");
    return next;
  }
  if (current.kind === "layout") {
    const laidOut = applyShipLayout(next, winner);
    laidOut.status = "upgradeVote";
    laidOut.vote = vote("upgrade", Object.keys(UPGRADES), laidOut.tick);
    laidOut.objectiveText = "Vote on a ship upgrade";
    return laidOut;
  }
  if (current.kind === "upgrade") {
    applyUpgrade(next, winner);
    next.sectorIndex += 1;
    next.nodeIndex += 1;
    next.captainSeat = (next.captainSeat + 1) % Object.keys(next.crew).length;
    next.slopEffectId = SLOP_ORDER[next.sectorIndex % SLOP_ORDER.length];
    next.enemy = undefined;
    next.status = "mapVote";
    next.vote = vote("map", Object.keys(MAP_NODES), next.tick);
    next.objectiveText = "Vote on the next destination";
    for (const crew of Object.values(next.crew)) {
      crew.health = Math.min(crew.maxHealth, crew.health + 25);
      crew.incapacitated = false;
      crew.bleedoutTicks = 0;
    }
  }
  return next;
}

export function castVote(state: RunState, ownerId: string, option: string): RunState {
  const next = structuredClone(state);
  const current = next.vote;
  if (!current || !["mapVote", "upgradeVote", "eventVote", "layoutVote"].includes(next.status)) throw new Error("no active vote");
  if (!Object.values(next.crew).some((crew) => crew.ownerId === ownerId)) throw new Error("unknown voter");
  if (!current.options.includes(option)) throw new Error("invalid vote option");
  current.votes[ownerId] = option;
  const allVoted = Object.values(next.crew).every((crew) => current.votes[crew.ownerId]);
  return allVoted ? resolveVote(next) : next;
}

export function stepRun(state: RunState, rng: Rng): RunState {
  if (state.status === "encounter") {
    const next = stepShipSimulation(state, rng);
    if (next.status !== "victory") return next;
    if (next.sectorIndex >= 2) {
      next.objectiveText = "Three sectors survived";
      return next;
    }
    next.ship.scrap += 8;
    next.status = "layoutVote";
    next.vote = vote("layout", Object.keys(SHIP_LAYOUT_OPTIONS), next.tick);
    next.objectiveText = "Vote on the next ship layout";
    return next;
  }
  const next = structuredClone(state);
  if (next.status === "mapVote" || next.status === "upgradeVote" || next.status === "eventVote" || next.status === "layoutVote") {
    next.tick += 1;
    if (next.vote && next.tick >= next.vote.deadlineTick) return resolveVote(next);
  }
  return next;
}
