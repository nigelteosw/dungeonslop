import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

const RADIUS = 14 * Math.SQRT2;
const HEIGHT = 18;
const EASE_SPEED = 8; // higher = snappier

interface Props {
  center: [number, number, number];
}

// Owns the camera's orbit angle around the board and eases it toward
// 90-degree steps on Q/E. Elevation and distance stay fixed, so this
// only spins the fixed isometric view — it never becomes a free camera.
export function IsoCameraRig({ center }: Props) {
  const { camera } = useThree();
  const angleRef = useRef(Math.PI / 4);
  const targetRef = useRef(Math.PI / 4);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      if (e.key === 'q' || e.key === 'Q') targetRef.current += Math.PI / 2;
      else if (e.key === 'e' || e.key === 'E') targetRef.current -= Math.PI / 2;
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useFrame((_, delta) => {
    const diff = targetRef.current - angleRef.current;
    if (Math.abs(diff) > 0.0005) {
      angleRef.current += diff * Math.min(1, delta * EASE_SPEED);
    } else {
      angleRef.current = targetRef.current;
    }
    const [cx, cy, cz] = center;
    camera.position.set(cx + RADIUS * Math.cos(angleRef.current), HEIGHT, cz + RADIUS * Math.sin(angleRef.current));
    camera.lookAt(cx, cy, cz);
  });

  return null;
}
