export function MonsterModel({ defId, color }: { defId: string; color: string }) {
  if (defId === 'slime') {
    return (
      <mesh position={[0, 0.25, 0]} scale={[1, 0.6, 1]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }
  return (
    <group>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.4, 0.5, 0.3]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}
