import {
  applyShipCommand,
  castVote,
  createCrew,
  createRun,
  createSeededRng,
  stepRun,
  type CrewRole,
  type Rng,
  type RunState,
  type ShipCommand,
} from "shared";

export interface LobbyPlayer {
  sessionId: string;
  name: string;
  role: CrewRole;
  ready: boolean;
  host: boolean;
}

export interface SessionSnapshot {
  status: "lobby" | RunState["status"];
  players: LobbyPlayer[];
  run?: RunState;
  sessionToCrew: Record<string, string>;
}

const ROLES: readonly CrewRole[] = ["pilot", "engineer", "gunner", "medic"];

export class GameSession {
  readonly players: LobbyPlayer[] = [];
  readonly sessionToCrew = new Map<string, string>();
  private readonly rng: Rng;
  run?: RunState;

  constructor(private readonly seed: string) {
    this.rng = createSeededRng(seed);
  }

  join(sessionId: string): void {
    if (this.players.some((player) => player.sessionId === sessionId)) return;
    if (this.players.length >= 4) throw new Error("room is full");
    this.players.push({
      sessionId,
      name: `Player ${this.players.length + 1}`,
      role: ROLES[this.players.length] ?? "engineer",
      ready: false,
      host: this.players.length === 0,
    });
  }

  leave(sessionId: string): void {
    const index = this.players.findIndex((player) => player.sessionId === sessionId);
    if (index < 0) return;
    const wasHost = this.players[index]?.host === true;
    this.players.splice(index, 1);
    this.sessionToCrew.delete(sessionId);
    if (wasHost && this.players[0]) this.players[0].host = true;
  }

  setName(sessionId: string, name: string): void {
    const player = this.requirePlayer(sessionId);
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) throw new Error("name is required");
    player.name = trimmed;
  }

  setRole(sessionId: string, role: string): void {
    const player = this.requirePlayer(sessionId);
    if (!ROLES.includes(role as CrewRole)) throw new Error("unknown crew role");
    player.role = role as CrewRole;
  }

  toggleReady(sessionId: string): void {
    const player = this.requirePlayer(sessionId);
    player.ready = !player.ready;
  }

  start(sessionId: string): void {
    const player = this.requirePlayer(sessionId);
    if (!player.host) throw new Error("only host can start");
    if (!this.players.every((candidate) => candidate.ready)) throw new Error("all players must be ready");

    this.sessionToCrew.clear();
    const crew = this.players.map((candidate, index) => {
      const crewId = `c${index}`;
      this.sessionToCrew.set(candidate.sessionId, crewId);
      return createCrew(crewId, candidate.sessionId, candidate.name, candidate.role);
    });
    this.run = createRun(this.seed, crew);
  }

  handleCommand(sessionId: string, command: ShipCommand): void {
    const crewId = this.requireOwnedCrew(sessionId);
    if (command.crewId !== crewId) throw new Error("cannot command another player's crew");
    this.run = applyShipCommand(this.requireRun(), command);
  }

  castVote(sessionId: string, option: string): void {
    this.requirePlayer(sessionId);
    this.run = castVote(this.requireRun(), sessionId, option);
  }

  tick(): void {
    if (!this.run || this.run.status === "victory" || this.run.status === "defeat") return;
    this.run = stepRun(this.run, this.rng);
  }

  snapshot(): SessionSnapshot {
    return {
      status: this.run?.status ?? "lobby",
      players: this.players.map((player) => ({ ...player })),
      ...(this.run ? { run: structuredClone(this.run) } : {}),
      sessionToCrew: Object.fromEntries(this.sessionToCrew),
    };
  }

  private requirePlayer(sessionId: string): LobbyPlayer {
    const player = this.players.find((candidate) => candidate.sessionId === sessionId);
    if (!player) throw new Error("unknown player");
    return player;
  }

  private requireOwnedCrew(sessionId: string): string {
    this.requirePlayer(sessionId);
    const crewId = this.sessionToCrew.get(sessionId);
    if (!crewId) throw new Error("player has no crew member");
    return crewId;
  }

  private requireRun(): RunState {
    if (!this.run) throw new Error("run has not started");
    return this.run;
  }
}
