import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import type { OrthographicCamera as ThreeOrthographicCamera } from 'three';
import type { GameState, Pos } from '../engine';
import { keyOf } from '../engine';
import { gridToWorld, boardCenter } from './gridToWorld';

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
      {/* Fixed isometric: orthographic camera offset equally on X/Z, elevated -> XCOM 45deg look */}
      <OrthographicCamera
        makeDefault
        position={[cx + 14, 18, cz + 14]}
        zoom={34}
        onUpdate={(c: ThreeOrthographicCamera) => c.lookAt(cx, 0, cz)}
      />
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
      {Object.values(state.units).map((u) => {
        const [wx, , wz] = gridToWorld(u.pos);
        return (
          <mesh key={u.id} position={[wx, 0.6, wz]}>
            <boxGeometry args={[0.5, 1, 0.5]} />
            <meshStandardMaterial color={u.team === 'player' ? (u.id === activeId ? '#22d3ee' : '#3b82f6') : '#ef4444'} />
          </mesh>
        );
      })}
    </Canvas>
  );
}
