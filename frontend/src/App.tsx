import { useState } from 'react';
import { keyOf } from './engine';
import { BoardScene } from './game/BoardScene';
import { CardHand } from './game/CardHand';
import { FIXTURE } from './game/fixtures';

export function App() {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const hl = new Set([keyOf({ x: 2, y: 1 }), keyOf({ x: 1, y: 2 })]);
  return (
    <>
      <BoardScene state={FIXTURE} activeId="p0" highlightKeys={hl} onTileClick={(p) => console.log('tile', p)} />
      <CardHand
        hand={FIXTURE.units.p0!.hand}
        energy={FIXTURE.units.p0!.energy}
        maxEnergy={FIXTURE.units.p0!.maxEnergy}
        selectedCardId={selectedCardId}
        onSelectCard={setSelectedCardId}
        onEndTurn={() => console.log('end turn')}
        disabled={false}
      />
    </>
  );
}
