import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import type { GameState, Pos } from '../engine';
import { keyOf } from '../engine';
import { gridToWorld, boardCenter } from './gridToWorld';
import { IsoCameraRig } from './IsoCameraRig';
import { UnitActor } from './UnitActor';

interface Props {
  state: GameState;
  activeId: string;
  highlightKeys: Set<string>;
  onTileClick: (p: Pos) => void;
}

export function BoardScene({ state, activeId, highlightKeys, onTileClick }: Props) {
  const { board } = state;
  const [cx, , cz] = boardCenter(board.width, board.height);
  const tiles: Pos[] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) tiles.push({ x, y });
  }
  const wallKeys = new Set(board.walls.map(keyOf));

  return (
    <Canvas style={{ position: 'absolute', inset: 0 }}>
      {/* Isometric orbit camera: fixed elevation/distance, eases to 90deg steps on Q/E */}
      <OrthographicCamera makeDefault zoom={34} />
      <IsoCameraRig center={[cx, 0, cz]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 6]} intensity={1.1} />
      {tiles.map((p) => {
        const k = keyOf(p);
        const isWallTile = wallKeys.has(k);
        const isExit = board.exit.x === p.x && board.exit.y === p.y;
        const hl = highlightKeys.has(k);
        const [wx, , wz] = gridToWorld(p);
        return (
          <mesh
            key={k}
            position={[wx, isWallTile ? 0.5 : 0, wz]}
            onClick={(e) => { e.stopPropagation(); if (!isWallTile) onTileClick(p); }}
          >
            <boxGeometry args={[0.94, isWallTile ? 1 : 0.2, 0.94]} />
            <meshStandardMaterial color={isWallTile ? '#4b5563' : isExit ? '#a16207' : hl ? '#2563eb' : '#20232e'} />
          </mesh>
        );
      })}
      {Object.values(state.units).map((u) => (
        <UnitActor key={u.id} unit={u} active={u.id === activeId} />
      ))}
    </Canvas>
  );
}
