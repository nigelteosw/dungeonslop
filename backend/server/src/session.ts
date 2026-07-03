import {
  CLASSES,
  EQUIPMENT,
  SLOP_CARDS,
  applyMove,
  applyUpgrade,
  createRoom,
  createSeededRng,
  endTurn,
  equip,
  playCard,
  rollRewardOptions,
  runMonsterPhase,
  type GameState,
  type Pos,
  type Rng,
} from "shared";

export interface LobbyPlayer {
  sessionId: string;
  name: string;
  classId: string;
  ready: boolean;
  host: boolean;
}

export type Intent =
  | { kind: "move"; to: Pos }
  | { kind: "playCard"; cardId: string; target: Pos }
  | { kind: "endTurn" };

export interface SessionSnapshot {
  phase: "lobby" | GameState["phase"];
  players: LobbyPlayer[];
  game?: GameState;
  currentSlopCardId?: string;
  rewardOptions: string[];
  sessionToUnit: Record<string, string>;
}

function assertPos(value: Pos): void {
  if (!Number.isInteger(value.x) || !Number.isInteger(value.y)) throw new Error("invalid position");
}

function playerSeeds(players: readonly LobbyPlayer[]): { name: string; classId: string }[] {
  return players.map((p) => ({ name: p.name, classId: p.classId }));
}

function copyPlayerProgress(from: GameState, to: GameState): GameState {
  const next: GameState = structuredClone(to);
  for (const unitId of to.order) {
    const prev = from.units[unitId];
    const fresh = next.units[unitId];
    if (!prev || !fresh) continue;
    fresh.maxHp = prev.maxHp;
    fresh.hp = Math.min(prev.maxHp, prev.hp);
    fresh.moveRange = prev.moveRange;
    fresh.attack = prev.attack;
    fresh.maxEnergy = prev.maxEnergy;
    fresh.energy = prev.maxEnergy;
    fresh.deck = [...prev.deck, ...prev.discard, ...prev.hand];
    fresh.hand = fresh.hand.length > 0 ? fresh.hand : [];
    fresh.discard = [];
    fresh.inventory = [...(prev.inventory ?? [])];
    fresh.equipment = { ...(prev.equipment ?? {}) };
  }
  return next;
}

export class GameSession {
  readonly players: LobbyPlayer[] = [];
  readonly sessionToUnit = new Map<string, string>();
  private rng: Rng;
  game?: GameState;
  currentSlopCardId?: string;
  rewardOptions: string[] = [];
  private rewardPicks = new Set<string>();

  constructor(seed: string) {
    this.rng = createSeededRng(seed);
  }

  join(sessionId: string): void {
    if (this.players.some((p) => p.sessionId === sessionId)) return;
    if (this.players.length >= 4) throw new Error("room is full");
    this.players.push({
      sessionId,
      name: `Player ${this.players.length + 1}`,
      classId: this.players.length % 2 === 0 ? "knight" : "wizard",
      ready: false,
      host: this.players.length === 0,
    });
  }

  leave(sessionId: string): void {
    const index = this.players.findIndex((p) => p.sessionId === sessionId);
    if (index < 0) return;
    const wasHost = this.players[index]?.host === true;
    this.players.splice(index, 1);
    this.sessionToUnit.delete(sessionId);
    if (wasHost && this.players[0]) this.players[0].host = true;
  }

  setName(sessionId: string, name: string): void {
    const player = this.requirePlayer(sessionId);
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) throw new Error("name is required");
    player.name = trimmed;
  }

  setClass(sessionId: string, classId: string): void {
    const player = this.requirePlayer(sessionId);
    if (!CLASSES[classId]) throw new Error("unknown class");
    player.classId = classId;
  }

  toggleReady(sessionId: string): void {
    const player = this.requirePlayer(sessionId);
    player.ready = !player.ready;
  }

  start(sessionId: string): void {
    const player = this.requirePlayer(sessionId);
    if (!player.host) throw new Error("only host can start");
    if (this.players.length < 1) throw new Error("not enough players");
    if (!this.players.every((p) => p.ready)) throw new Error("all players must be ready");

    this.currentSlopCardId = undefined;
    this.rewardOptions = [];
    this.rewardPicks.clear();
    this.game = createRoom(0, playerSeeds(this.players), this.rng);
    this.sessionToUnit.clear();
    this.players.forEach((p, index) => this.sessionToUnit.set(p.sessionId, `p${index}`));
  }

  handleIntent(sessionId: string, intent: Intent): void {
    const unitId = this.requireOwnedUnit(sessionId);
    const game = this.requireGame();
    if (game.phase !== "player") throw new Error("not accepting player intents");
    if (game.order[game.activeIndex] !== unitId) throw new Error("not your turn");

    if (intent.kind === "move") {
      assertPos(intent.to);
      this.game = applyMove(game, unitId, intent.to);
      return;
    }

    if (intent.kind === "playCard") {
      assertPos(intent.target);
      this.game = playCard(game, unitId, intent.cardId, intent.target);
      this.afterMutation();
      return;
    }

    this.game = endTurn(game, runMonsterPhase, this.rng);
    this.afterMutation();
  }

  pickUpgrade(sessionId: string, upgradeId: string): void {
    const unitId = this.requireOwnedUnit(sessionId);
    const game = this.requireGame();
    if (game.phase !== "reward") throw new Error("not reward phase");
    if (!this.rewardOptions.includes(upgradeId)) throw new Error("upgrade not offered");
    if (this.rewardPicks.has(sessionId)) throw new Error("already picked reward");

    this.game = applyUpgrade(game, unitId, upgradeId);
    this.rewardPicks.add(sessionId);
    if (this.rewardPicks.size >= this.players.length) this.advanceAfterRewards();
  }

  equip(sessionId: string, itemId: string): void {
    this.requireOwnedUnit(sessionId);
    if (!EQUIPMENT[itemId]) throw new Error("unknown equipment");
    const unitId = this.requireOwnedUnit(sessionId);
    this.game = equip(this.requireGame(), unitId, itemId);
  }

  snapshot(): SessionSnapshot {
    const sessionToUnit: Record<string, string> = {};
    for (const [sessionId, unitId] of this.sessionToUnit.entries()) sessionToUnit[sessionId] = unitId;
    return {
      phase: this.game?.phase ?? "lobby",
      players: this.players.map((p) => ({ ...p })),
      ...(this.game ? { game: structuredClone(this.game) } : {}),
      ...(this.currentSlopCardId ? { currentSlopCardId: this.currentSlopCardId } : {}),
      rewardOptions: [...this.rewardOptions],
      sessionToUnit,
    };
  }

  private requirePlayer(sessionId: string): LobbyPlayer {
    const player = this.players.find((p) => p.sessionId === sessionId);
    if (!player) throw new Error("unknown player");
    return player;
  }

  private requireOwnedUnit(sessionId: string): string {
    this.requirePlayer(sessionId);
    const unitId = this.sessionToUnit.get(sessionId);
    if (!unitId) throw new Error("player has no unit");
    return unitId;
  }

  private requireGame(): GameState {
    if (!this.game) throw new Error("game has not started");
    return this.game;
  }

  private afterMutation(): void {
    const game = this.requireGame();
    if (game.phase === "roomClear") {
      this.game = { ...game, phase: "reward" };
      this.rewardOptions = rollRewardOptions(this.rng, 3);
      this.rewardPicks.clear();
    }
  }

  private advanceAfterRewards(): void {
    const game = this.requireGame();
    if (game.roomIndex >= 2) {
      this.game = { ...game, phase: "roomClear" };
      this.rewardOptions = [];
      return;
    }

    const slopId = Object.keys(SLOP_CARDS).length > 0 ? this.drawSlop() : undefined;
    const modifiers = slopId ? SLOP_CARDS[slopId]?.effect : undefined;
    const nextRoom = createRoom(game.roomIndex + 1, playerSeeds(this.players), this.rng, modifiers);
    this.game = copyPlayerProgress(game, nextRoom);
    this.currentSlopCardId = slopId;
    this.rewardOptions = [];
    this.rewardPicks.clear();
  }

  private drawSlop(): string {
    const ids = Object.keys(SLOP_CARDS);
    const id = ids[Math.floor(this.rng() * ids.length)];
    if (!id) throw new Error("no slop cards configured");
    return id;
  }
}
