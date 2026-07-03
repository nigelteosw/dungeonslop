import type { GameState, Pos } from '../engine';

// Common shape BoardScene/CardHand/GameScreen drive against, so hotseat and
// networked (Colyseus) play are interchangeable — only the driver differs.
export interface GameDriver {
  state: GameState;
  activeId: string;
  // The unit this client controls. For hotseat it always equals activeId
  // (the device is passed around); for a networked driver it's fixed to
  // your own unit, and interaction is gated on activeId === myUnitId.
  myUnitId: string;
  legalMoveKeys: Set<string>;
  cardTargetKeys: (cardId: string) => Set<string>;
  move: (to: Pos) => void;
  playCard: (cardId: string, target: Pos) => void;
  endTurn: () => void;
  reset?: () => void;
}
