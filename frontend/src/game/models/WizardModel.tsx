export function WizardModel({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.4, 0]}>
        <coneGeometry args={[0.32, 0.8, 8]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color="#f1c27d" />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <coneGeometry args={[0.16, 0.5, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.28, 0.55, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.0, 6]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>
    </group>
  );
}
