import { Room, type Client } from "colyseus";
import type { CrewRole, ShipCommand, SystemId, WeaponTarget } from "shared";
import { DungeonState } from "../schema";
import { GameSession } from "../session";

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) throw new Error("invalid payload");
  return value as Record<string, unknown>;
}

function stringField(message: unknown, field: string): string {
  const value = record(message)[field];
  if (typeof value !== "string") throw new Error(`invalid ${field}`);
  return value;
}

function parseCommand(message: unknown): ShipCommand {
  const value = record(message);
  const kind = value.kind;
  const crewId = value.crewId;
  if (typeof kind !== "string" || typeof crewId !== "string") throw new Error("invalid ship command");
  if (kind === "move" && typeof value.roomId === "string") return { kind, crewId, roomId: value.roomId };
  if (kind === "moveVector" && typeof value.dx === "number" && typeof value.dy === "number" && [-1,0,1].includes(value.dx) && [-1,0,1].includes(value.dy)) return { kind, crewId, dx: value.dx as -1|0|1, dy: value.dy as -1|0|1 };
  if ((kind === "operate" || kind === "repair") && typeof value.systemId === "string") {
    return { kind, crewId, systemId: value.systemId as SystemId };
  }
  if (kind === "repairRoom") return { kind, crewId };
  if (kind === "setPower" && typeof value.systemId === "string" && typeof value.power === "number" && Number.isInteger(value.power)) {
    return { kind, crewId, systemId: value.systemId as SystemId, power: value.power };
  }
  if (kind === "setWeaponTarget" && typeof value.target === "string" && ["shields", "weapons", "helm", "core"].includes(value.target)) {
    return { kind, crewId, target: value.target as WeaponTarget };
  }
  if (kind === "fireWeapon") return { kind, crewId };
  if (kind === "setDoorState" && typeof value.doorId === "string" && typeof value.state === "string" && ["open", "closed", "locked"].includes(value.state)) {
    return { kind, crewId, doorId: value.doorId, state: value.state as "open" | "closed" | "locked" };
  }
  if (kind === "extinguish" && typeof value.fireId === "string") return { kind, crewId, fireId: value.fireId };
  if (kind === "sealBreach") return { kind, crewId };
  if (kind === "attackBoarder" && typeof value.boarderId === "string") return { kind, crewId, boarderId: value.boarderId };
  if (kind === "useAbility") return { kind, crewId };
  if (kind === "heal") return { kind, crewId };
  if (kind === "revive" && typeof value.targetCrewId === "string") return { kind, crewId, targetCrewId: value.targetCrewId };
  throw new Error("invalid ship command");
}

export class DungeonRoom extends Room<DungeonState> {
  maxClients = 4;
  private session!: GameSession;

  onCreate(): void {
    this.session = new GameSession(this.roomId || "dungeon");
    this.setState(new DungeonState());
    this.onMessage("setName", (client, message) => this.apply(client, () => this.session.setName(client.sessionId, stringField(message, "name"))));
    this.onMessage("setRole", (client, message) => this.apply(client, () => this.session.setRole(client.sessionId, stringField(message, "role") as CrewRole)));
    this.onMessage("toggleReady", (client) => this.apply(client, () => this.session.toggleReady(client.sessionId)));
    this.onMessage("start", (client) => this.apply(client, () => this.session.start(client.sessionId)));
    this.onMessage("command", (client, message) => this.apply(client, () => this.session.handleCommand(client.sessionId, parseCommand(message))));
    this.onMessage("vote", (client, message) => this.apply(client, () => this.session.castVote(client.sessionId, stringField(message, "option"))));
    this.clock.setInterval(() => {
      this.session.tick();
      this.project();
    }, 800);
  }

  onJoin(client: Client): void {
    this.apply(client, () => this.session.join(client.sessionId));
    client.send("mySessionId", { sessionId: client.sessionId });
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    if (!consented && this.session.run) {
      try {
        await this.allowReconnection(client, 20);
        return;
      } catch {
        // Grace period expired; release the disconnected seat below.
      }
    }
    this.session.leave(client.sessionId);
    this.project();
  }

  private apply(client: Client, fn: () => void): void {
    try {
      fn();
      this.project();
    } catch (error) {
      client.send("rejected", { message: error instanceof Error ? error.message : "rejected" });
    }
  }

  private project(): void {
    this.state.applySnapshot(this.session.snapshot());
  }
}
