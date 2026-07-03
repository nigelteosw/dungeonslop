import { keyOf } from './engine';
import { BoardScene } from './game/BoardScene';
import { FIXTURE } from './game/fixtures';

export function App() {
  const hl = new Set([keyOf({ x: 2, y: 1 }), keyOf({ x: 1, y: 2 })]);
  return <BoardScene state={FIXTURE} activeId="p0" highlightKeys={hl} onTileClick={(p) => console.log('tile', p)} />;
}
