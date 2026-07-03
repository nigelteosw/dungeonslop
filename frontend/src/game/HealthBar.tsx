import { Billboard } from '@react-three/drei';

const BAR_WIDTH = 0.7;
const BAR_HEIGHT = 0.09;
const BAR_Y = 1.35;

interface Props {
  hp: number;
  maxHp: number;
}

// Billboarded so it stays readable regardless of the camera's current
// orbit angle (Q/E rotation). Excluded from raycasting so it never
// steals clicks meant for the tile underneath.
export function HealthBar({ hp, maxHp }: Props) {
  const frac = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
  const color = frac > 0.5 ? '#22c55e' : frac > 0.25 ? '#eab308' : '#ef4444';

  return (
    <Billboard position={[0, BAR_Y, 0]}>
      <mesh raycast={() => null}>
        <planeGeometry args={[BAR_WIDTH, BAR_HEIGHT]} />
        <meshBasicMaterial color="#1f2937" />
      </mesh>
      <mesh raycast={() => null} position={[-(BAR_WIDTH * (1 - frac)) / 2, 0, 0.001]}>
        <planeGeometry args={[BAR_WIDTH * frac, BAR_HEIGHT]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </Billboard>
  );
}
