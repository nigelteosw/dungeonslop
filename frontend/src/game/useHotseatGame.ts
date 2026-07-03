import { useState } from 'react';
import {
  createRoom, applyMove, playCard, endTurn, legalMoves, cardTargets,
  runMonsterPhase, keyOf, type GameState, type Pos,
} from '../engine';

const rng = Math.random;
const seed = [{ name: 'Knight', classId: 'knight' }, { name: 'Wizard', classId: 'wizard' }];

export function useHotseatGame() {
  const [state, setState] = useState<GameState>(() => createRoom(0, seed, rng));
  const activeId = state.order[state.activeIndex]!;

  return {
    state,
    activeId,
    hand: state.units[activeId]?.hand ?? [],
    legalMoveKeys: new Set(legalMoves(state, activeId).map(keyOf)),
    cardTargetKeys: (cardId: string) => new Set(cardTargets(state, activeId, cardId).map(keyOf)),
    move: (to: Pos) => setState((s) => applyMove(s, activeId, to)),
    playCard: (cardId: string, target: Pos) => setState((s) => playCard(s, activeId, cardId, target)),
    endTurn: () => setState((s) => endTurn(s, runMonsterPhase, rng)),
    reset: () => setState(createRoom(0, seed, rng)),
  };
}
