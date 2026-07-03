import type { Unit } from '../../engine';
import { KnightModel } from './KnightModel';
import { WizardModel } from './WizardModel';
import { MonsterModel } from './MonsterModel';

export function UnitModel({ unit, active }: { unit: Unit; active: boolean }) {
  const teamColor = unit.team === 'player' ? (active ? '#22d3ee' : '#2563eb') : '#16a34a';
  if (unit.team === 'monster') return <MonsterModel defId={unit.defId} color="#4ade80" />;
  return unit.defId === 'wizard' ? <WizardModel color={teamColor} /> : <KnightModel color={teamColor} />;
}
