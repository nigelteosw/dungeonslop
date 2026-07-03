import { useState } from 'react';
import { keyOf, type Pos } from '../engine';
import { BoardScene } from './BoardScene';
import { CardHand } from './CardHand';
import { useHotseatGame } from './useHotseatGame';

export function GameScreen() {
  const g = useHotseatGame();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const done = g.state.phase === 'roomClear' || g.state.phase === 'defeat';
  const highlightKeys = selectedCardId ? g.cardTargetKeys(selectedCardId) : g.legalMoveKeys;

  const onTileClick = (p: Pos) => {
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
        Phase: {g.state.phase} · Active: {g.state.units[g.activeId]?.name} · HP: {g.state.units[g.activeId]?.hp}/{g.state.units[g.activeId]?.maxHp}
      </div>
      <CardHand
        hand={g.hand}
        energy={g.state.units[g.activeId]?.energy ?? 0}
        maxEnergy={g.state.units[g.activeId]?.maxEnergy ?? 0}
        selectedCardId={selectedCardId}
        onSelectCard={setSelectedCardId}
        onEndTurn={() => { setSelectedCardId(null); g.endTurn(); }}
        disabled={done}
      />
      {done && (
        <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <h2>{g.state.phase === 'roomClear' ? 'ROOM CLEAR!' : 'DEFEATED'}</h2>
          <button onClick={() => { setSelectedCardId(null); g.reset(); }}>Reset</button>
        </div>
      )}
    </>
  );
}
