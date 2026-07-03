export function KnightModel({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.45, 0.6, 0.3]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[0.28, 0.28, 0.28]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.7} />
      </mesh>
      <mesh position={[0.3, 0.5, 0]} rotation={[0, 0, Math.PI / 12]}>
        <boxGeometry args={[0.06, 0.7, 0.06]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.9} />
      </mesh>
    </group>
  );
}
