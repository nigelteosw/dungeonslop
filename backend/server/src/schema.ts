import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import type { Board, GameState, Phase, Pos, Unit } from "shared";
import type { LobbyPlayer, SessionSnapshot } from "./session";

export class PosSchema extends Schema implements Pos {
  @type("number") x = 0;
  @type("number") y = 0;

  constructor(pos?: Pos) {
    super();
    if (pos) {
      this.x = pos.x;
      this.y = pos.y;
    }
  }
}

export class EquipmentSchema extends Schema {
  @type("string") weapon = "";
  @type("string") armor = "";
  @type("string") trinket = "";
}

export class UnitSchema extends Schema {
  @type("string") id = "";
  @type("string") team = "";
  @type("string") name = "";
  @type("string") defId = "";
  @type(PosSchema) pos = new PosSchema();
  @type("number") hp = 0;
  @type("number") maxHp = 0;
  @type("number") moveRange = 0;
  @type("number") attack = 0;
  @type("number") energy = 0;
  @type("number") maxEnergy = 0;
  @type("number") block = 0;
  @type("boolean") hasMoved = false;
  @type(["string"]) deck = new ArraySchema<string>();
  @type(["string"]) hand = new ArraySchema<string>();
  @type(["string"]) discard = new ArraySchema<string>();
  @type(["string"]) inventory = new ArraySchema<string>();
  @type(EquipmentSchema) equipment = new EquipmentSchema();

  constructor(unit?: Unit) {
    super();
    if (!unit) return;
    this.id = unit.id;
    this.team = unit.team;
    this.name = unit.name;
    this.defId = unit.defId;
    this.pos = new PosSchema(unit.pos);
    this.hp = unit.hp;
    this.maxHp = unit.maxHp;
    this.moveRange = unit.moveRange;
    this.attack = unit.attack;
    this.energy = unit.energy;
    this.maxEnergy = unit.maxEnergy;
    this.block = unit.block;
    this.hasMoved = unit.hasMoved;
    this.deck.push(...unit.deck);
    this.hand.push(...unit.hand);
    this.discard.push(...unit.discard);
    this.inventory.push(...(unit.inventory ?? []));
    this.equipment.weapon = unit.equipment?.weapon ?? "";
    this.equipment.armor = unit.equipment?.armor ?? "";
    this.equipment.trinket = unit.equipment?.trinket ?? "";
  }
}

export class BoardSchema extends Schema {
  @type("number") width = 16;
  @type("number") height = 16;
  @type([PosSchema]) walls = new ArraySchema<PosSchema>();
  @type(PosSchema) exit = new PosSchema();

  constructor(board?: Board) {
    super();
    if (!board) return;
    this.width = board.width;
    this.height = board.height;
    this.walls.push(...board.walls.map((p) => new PosSchema(p)));
    this.exit = new PosSchema(board.exit);
  }
}

export class PlayerSchema extends Schema {
  @type("string") sessionId = "";
  @type("string") name = "";
  @type("string") classId = "";
  @type("boolean") ready = false;
  @type("boolean") host = false;

  constructor(player?: LobbyPlayer) {
    super();
    if (!player) return;
    this.sessionId = player.sessionId;
    this.name = player.name;
    this.classId = player.classId;
    this.ready = player.ready;
    this.host = player.host;
  }
}

export class DungeonState extends Schema {
  @type("string") phase: Phase | "lobby" = "lobby";
  @type([PlayerSchema]) players = new ArraySchema<PlayerSchema>();
  @type(BoardSchema) board = new BoardSchema();
  @type({ map: UnitSchema }) units = new MapSchema<UnitSchema>();
  @type(["string"]) order = new ArraySchema<string>();
  @type("number") activeIndex = 0;
  @type("number") roomIndex = 0;
  @type("string") currentSlopCardId = "";
  @type(["string"]) rewardOptions = new ArraySchema<string>();

  applySnapshot(snapshot: SessionSnapshot): void {
    this.phase = snapshot.phase;
    this.players.clear();
    this.players.push(...snapshot.players.map((p) => new PlayerSchema(p)));
    this.rewardOptions.clear();
    this.rewardOptions.push(...snapshot.rewardOptions);
    this.currentSlopCardId = snapshot.currentSlopCardId ?? "";

    const game: GameState | undefined = snapshot.game;
    this.units.clear();
    this.order.clear();
    if (!game) return;

    this.phase = game.phase;
    this.board = new BoardSchema(game.board);
    for (const unit of Object.values(game.units)) this.units.set(unit.id, new UnitSchema(unit));
    this.order.push(...game.order);
    this.activeIndex = game.activeIndex;
    this.roomIndex = game.roomIndex;
  }
}
