import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

const RADIUS = 14 * Math.SQRT2;
const HEIGHT = 18;
const EASE_SPEED = 8; // higher = snappier rotation
const PAN_LIMIT = 12; // world units the view can be dragged off board-center

interface Props {
  center: [number, number, number];
}

// Owns the camera's orbit angle and pan offset around the board. Elevation
// and distance from the look-at point stay fixed, so this never becomes a
// free camera — it only spins (Q/E, eased to 90deg steps) and pans
// (right-click-drag) the same fixed isometric view.
export function IsoCameraRig({ center }: Props) {
  const { camera, gl } = useThree();
  const angleRef = useRef(Math.PI / 4);
  const targetRef = useRef(Math.PI / 4);
  const panRef = useRef<[number, number]>([0, 0]);
  const draggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      if (e.key === 'q' || e.key === 'Q') targetRef.current += Math.PI / 2;
      else if (e.key === 'e' || e.key === 'E') targetRef.current -= Math.PI / 2;
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const el = gl.domElement;

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 2) return; // right-click drag only; left click stays free for tile/card selection
      draggingRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    }
    function onPointerMove(e: PointerEvent) {
      if (!draggingRef.current) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      const angle = angleRef.current;
      const rightX = Math.sin(angle), rightZ = -Math.cos(angle);
      const fwdX = -Math.cos(angle), fwdZ = -Math.sin(angle);
      const scale = 1 / camera.zoom;

      const [px, pz] = panRef.current;
      const nx = px - rightX * dx * scale + fwdX * dy * scale;
      const nz = pz - rightZ * dx * scale + fwdZ * dy * scale;
      panRef.current = [
        Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, nx)),
        Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, nz)),
      ];
    }
    function onPointerUp(e: PointerEvent) {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      el.style.cursor = 'auto';
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    }
    function onContextMenu(e: MouseEvent) { e.preventDefault(); }

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('contextmenu', onContextMenu);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }, [gl, camera]);

  useFrame((_, delta) => {
    const diff = targetRef.current - angleRef.current;
    if (Math.abs(diff) > 0.0005) {
      angleRef.current += diff * Math.min(1, delta * EASE_SPEED);
    } else {
      angleRef.current = targetRef.current;
    }
    const [cx, cy, cz] = center;
    const [px, pz] = panRef.current;
    const lookX = cx + px, lookZ = cz + pz;
    camera.position.set(lookX + RADIUS * Math.cos(angleRef.current), HEIGHT, lookZ + RADIUS * Math.sin(angleRef.current));
    camera.lookAt(lookX, cy, lookZ);
  });

  return null;
}
