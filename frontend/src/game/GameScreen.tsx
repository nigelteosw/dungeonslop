import { useState } from 'react';
import { keyOf, type Pos } from '../engine';
import { BoardScene } from './BoardScene';
import { CardHand } from './CardHand';
import type { GameDriver } from './driver';

interface Props {
  driver: GameDriver;
}

export function GameScreen({ driver: g }: Props) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const done = g.state.phase === 'roomClear' || g.state.phase === 'defeat';
  const isMyTurn = g.activeId === g.myUnitId;
  const highlightKeys = isMyTurn ? (selectedCardId ? g.cardTargetKeys(selectedCardId) : g.legalMoveKeys) : new Set<string>();
  const me = g.state.units[g.myUnitId];

  const onTileClick = (p: Pos) => {
    if (!isMyTurn) return;
    const k = keyOf(p);
    if (selectedCardId) {
      if (highlightKeys.has(k)) {
        g.playCard(selectedCardId, p);
        setSelectedCardId(null);
      }
    } else if (g.legalMoveKeys.has(k)) {
      g.move(p);
    }
  };

  return (
    <>
      <BoardScene state={g.state} activeId={g.activeId} highlightKeys={highlightKeys} onTileClick={onTileClick} />
      <div style={{ position: 'absolute', top: 12, left: 12, font: '14px monospace' }}>
        Phase: {g.state.phase} · Active: {g.state.units[g.activeId]?.name}
        {!isMyTurn && !done && ' · waiting for their turn...'}
        {me && ` · You: ${me.name} HP ${me.hp}/${me.maxHp}`}
      </div>
      <CardHand
        hand={me?.hand ?? []}
        energy={me?.energy ?? 0}
        maxEnergy={me?.maxEnergy ?? 0}
        selectedCardId={selectedCardId}
        onSelectCard={setSelectedCardId}
        onEndTurn={() => { setSelectedCardId(null); g.endTurn(); }}
        disabled={done || !isMyTurn}
      />
      {done && (
        <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <h2>{g.state.phase === 'roomClear' ? 'ROOM CLEAR!' : 'DEFEATED'}</h2>
          {g.reset && <button onClick={() => { setSelectedCardId(null); g.reset?.(); }}>Reset</button>}
        </div>
      )}
    </>
  );
}
