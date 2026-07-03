import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { Unit } from '../engine';
import { keyOf } from '../engine';
import { gridToWorld } from './gridToWorld';
import { UnitModel } from './models/UnitModel';
import { HealthBar } from './HealthBar';

const HOP_DURATION = 0.35; // seconds
const HOP_HEIGHT = 0.6;

interface Props {
  unit: Unit;
  active: boolean;
}

// Eases a unit's world position toward its grid position whenever it
// changes, with a parabolic vertical arc — reads as a "hop" between
// tiles rather than a teleport. Driven imperatively via useFrame so it
// doesn't fight React's render cycle; `unit.pos` is still the single
// source of truth, this just animates toward it.
export function UnitActor({ unit, active }: Props) {
  const groupRef = useRef<Group>(null);
  const fromRef = useRef(gridToWorld(unit.pos));
  const toRef = useRef(gridToWorld(unit.pos));
  const tRef = useRef(1); // 1 = animation complete
  const posKeyRef = useRef(keyOf(unit.pos));

  useEffect(() => {
    const key = keyOf(unit.pos);
    if (key !== posKeyRef.current) {
      const g = groupRef.current;
      fromRef.current = g ? [g.position.x, 0, g.position.z] : fromRef.current;
      toRef.current = gridToWorld(unit.pos);
      tRef.current = 0;
      posKeyRef.current = key;
    }
  }, [unit.pos.x, unit.pos.y]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    if (tRef.current < 1) {
      tRef.current = Math.min(1, tRef.current + delta / HOP_DURATION);
      const eased = 1 - (1 - tRef.current) * (1 - tRef.current); // ease-out
      const [fx, , fz] = fromRef.current;
      const [tx, , tz] = toRef.current;
      const hop = Math.sin(tRef.current * Math.PI) * HOP_HEIGHT;
      g.position.set(fx + (tx - fx) * eased, hop, fz + (tz - fz) * eased);
    } else {
      const [tx, , tz] = toRef.current;
      g.position.set(tx, 0, tz);
    }
  });

  return (
    <group ref={groupRef} position={fromRef.current}>
      <UnitModel unit={unit} active={active} />
      <HealthBar hp={unit.hp} maxHp={unit.maxHp} />
    </group>
  );
}
