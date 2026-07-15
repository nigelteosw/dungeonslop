import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { LobbyPlayerLike, ShipViewState, SystemId, WeaponTarget } from '../net/schemaAdapter';
import type { Command } from '../net/useDungeonRoom';
import { adjacentRoomIds, DECK_COLUMNS, DECK_ROWS, roomDoorLayouts, roomLayouts } from './shipLayout';
import { useShipAudio } from './useShipAudio';
import './ship.css';

const OPTION_COPY: Record<string, { name: string; description: string }> = {
  'scrap-raider': { name: 'Scrap Raider', description: 'Balanced weapons. Predictably hostile.' },
  'shield-leech': { name: 'Shield Leech', description: 'More shields, slower cannon.' },
  'volatile-derelict': { name: 'Volatile Derelict', description: 'Fragile, fast-firing, full of scrap.' },
  'suspicious-signal': { name: 'Suspicious Signal', description: 'A survivor and a wreck both request attention.' },
  'rescue-survivor': { name: 'Rescue the Survivor', description: 'Gain a little scrap and heal the crew.' },
  'strip-wreck': { name: 'Strip the Wreck', description: 'Gain more scrap, but breach the oxygen room.' },
  'quarantine-buoy': { name: 'Quarantine Buoy', description: 'A sealed pod promises disease and salvage.' },
  'union-freighter': { name: 'Union Freighter', description: 'Striking haulers request aid. Management requests violence.' },
  'purge-buoy': { name: 'Purge It', description: 'Take safe scrap and accept a small oxygen-room fire.' },
  'open-buoy': { name: 'Open It', description: 'Take valuable salvage and release a boarder into medbay.' },
  'pay-union-dues': { name: 'Pay Union Dues', description: 'Spend scrap to receive emergency hull repairs.' },
  'cross-picket-line': { name: 'Cross the Picket Line', description: 'Gain scrap, breach engineering, and start a fire.' },
  'reinforced-hull': { name: 'Reinforced Hull', description: '+6 maximum hull and repair 6 hull.' },
  'shield-capacitor': { name: 'Shield Capacitor', description: '+1 maximum shield and restore shields.' },
  'reactor-tap': { name: 'Questionable Reactor Tap', description: '+1 reactor capacity and weapons power.' },
  'auto-turret': { name: 'Jury-Rigged Turret', description: 'Weapons fire slowly without an operator.' },
  'medbay-foam': { name: 'Medbay Foam', description: 'Medbay heals crew and suppresses its own fires.' },
  'blast-doors': { name: 'Blast Doors', description: 'Boarders move between rooms half as often.' },
  'balanced': { name: 'Balanced Frame', description: 'Split support systems across two central corridors.' },
  'battle': { name: 'Battle Spine', description: 'Place shields and weapons together near the bridge.' },
  'rescue': { name: 'Rescue Core', description: 'Move medbay to the protected center of the ship.' },
};
const SLOP_COPY: Record<string, { name: string; description: string }> = {
  'hot-reactor-summer': { name: 'Hot Reactor Summer', description: 'Engineering may spontaneously catch fire.' },
  'thin-air': { name: 'Thin Air', description: 'Breaches drain oxygen faster and oxygen recovers slowly.' },
  'volatile-weapons': { name: 'Volatile Weapons', description: 'Your volleys hit harder but may ignite weapons.' },
};
const ABILITY_COPY = {
  pilot: 'Emergency Burn', engineer: 'Overcharge Repair', gunner: 'Called Shot', medic: 'Stabilize Crew',
} as const;
const INTERACTION_COPY: Record<string, string> = {
  operate: 'OPERATING', repair: 'REPAIRING', repairRoom: 'REPAIRING ROOM', setDoorState: 'CONTROLLING DOOR', extinguish: 'EXTINGUISHING',
  sealBreach: 'SEALING', attackBoarder: 'FIGHTING', useAbility: 'USING ABILITY', revive: 'REVIVING', heal: 'HEALING',
};
const SYSTEM_COPY: Record<SystemId, string> = {
  helm: 'Helm', reactor: 'Reactor', weapons: 'Weapons', shields: 'Shields', oxygen: 'Oxygen',
};
const WEAPON_TARGET_COPY: Record<WeaponTarget, string> = {
  shields: 'Shields', weapons: 'Weapons', helm: 'Helm', core: 'Core',
};
const TICK_SECONDS = 0.8;
type CrisisTone = 'critical' | 'warning' | 'notice';
interface CrisisItem { id: string; tone: CrisisTone; title: string; detail: string; }

interface Props { state: ShipViewState; myCrewId: string; mySessionId: string; players: LobbyPlayerLike[]; error: string | null; onCommand: (command: Command) => void; onVote: (option: string) => void; }

function hullFrameStyle(rooms: ReturnType<typeof roomLayouts>): React.CSSProperties {
  const geometry = Object.values(rooms);
  const minX = Math.min(...geometry.map((room) => room.x));
  const minY = Math.min(...geometry.map((room) => room.y));
  const maxX = Math.max(...geometry.map((room) => room.x + room.w));
  const maxY = Math.max(...geometry.map((room) => room.y + room.h));
  const paddingX = 0.72;
  const paddingY = 0.7;
  const left = Math.max(0, minX - paddingX);
  const top = Math.max(0, minY - paddingY);
  const right = Math.min(DECK_COLUMNS, maxX + paddingX);
  const bottom = Math.min(DECK_ROWS, maxY + paddingY);

  return {
    '--hull-left': `${left / DECK_COLUMNS * 100}%`,
    '--hull-top': `${top / DECK_ROWS * 100}%`,
    '--hull-width': `${(right - left) / DECK_COLUMNS * 100}%`,
    '--hull-height': `${(bottom - top) / DECK_ROWS * 100}%`,
  } as React.CSSProperties;
}

export function ShipScreen({ state, myCrewId, mySessionId, players, error, onCommand, onVote }: Props) {
  const previousCombat = useRef({ hull: state.hull, shields: state.shields, enemyHull: state.enemyHull, enemyShields: state.enemyShields });
  const [incomingCue, setIncomingCue] = useState<number | null>(null);
  const [outgoingCue, setOutgoingCue] = useState<number | null>(null);
  useEffect(() => {
    const previous = previousCombat.current;
    if (state.hull < previous.hull || state.shields < previous.shields) setIncomingCue(Date.now());
    if (state.enemyHull < previous.enemyHull || state.enemyShields < previous.enemyShields) setOutgoingCue(Date.now());
    previousCombat.current = { hull: state.hull, shields: state.shields, enemyHull: state.enemyHull, enemyShields: state.enemyShields };
  }, [state.hull, state.shields, state.enemyHull, state.enemyShields]);
  useEffect(() => {
    if (incomingCue === null) return;
    const timer = setTimeout(() => setIncomingCue(null), 700);
    return () => clearTimeout(timer);
  }, [incomingCue]);
  useEffect(() => {
    if (outgoingCue === null) return;
    const timer = setTimeout(() => setOutgoingCue(null), 500);
    return () => clearTimeout(timer);
  }, [outgoingCue]);
  const audio = useShipAudio(state);
  const lastMoveAt = useRef(0);
  const keyHandlerRef = useRef<(event: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => keyHandlerRef.current(event);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const me = state.crew[myCrewId];
  if (!me) {
    keyHandlerRef.current = () => undefined;
    return <main className="ship-shell"><p>Your crew member is no longer aboard.</p></main>;
  }
  const roomLayout = roomLayouts(state.rooms);
  const hullStyle = hullFrameStyle(roomLayout);
  const doors = roomDoorLayouts(state.doors);
  const reachable = new Set(adjacentRoomIds(me.roomId, state.doors));
  const currentRoom = state.rooms[me.roomId];
  const currentLayout = roomLayout[me.roomId];
  const currentSystem = currentLayout?.systemId ? state.systems[currentLayout.systemId] : undefined;
  const downedHere = Object.values(state.crew).filter((crew) => crew.id !== me.id && crew.roomId === me.roomId && crew.incapacitated);
  const boardersHere = Object.values(state.boarders).filter((boarder) => boarder.roomId === me.roomId);
  const medbayCrewCount = Object.values(state.crew).filter((crew) => crew.roomId === 'medbay' && !crew.incapacitated).length;
  const medbayHealAmount = medbayCrewCount >= 2 ? 20 : 10;
  const firesHere = Object.values(state.fires).filter((fire) => fire.roomId === me.roomId);
  const busy = me.interactionTotalTicks > 0;
  const extinguishableFires = firesHere.filter((fire) => Math.max(Math.abs(fire.x - me.deckX), Math.abs(fire.y - me.deckY)) <= 1).sort((a, b) => {
    const aDistance = Math.max(Math.abs(a.x - me.deckX), Math.abs(a.y - me.deckY));
    const bDistance = Math.max(Math.abs(b.x - me.deckX), Math.abs(b.y - me.deckY));
    return aDistance - bDistance;
  });
  const slop = SLOP_COPY[state.slopEffectId];
  const voteActive = state.status === 'mapVote' || state.status === 'upgradeVote' || state.status === 'eventVote' || state.status === 'layoutVote';
  const secondsLeft = Math.max(0, Math.ceil((state.voteDeadlineTick - state.tick) * TICK_SECONDS));
  const captain = players[state.captainSeat % Math.max(1, players.length)];
  const systems = Object.values(state.systems);
  const poweredSystems = systems.filter((system) => system.id !== 'reactor');
  const allocatedPower = poweredSystems.reduce((total, system) => total + system.power, 0);
  const isEngineeringOperator = state.systems.reactor?.operatorCrewId === me.id && me.roomId === state.systems.reactor?.roomId;
  const isWeaponsOperator = state.systems.weapons?.operatorCrewId === me.id && me.roomId === state.systems.weapons?.roomId;
  const isBridgeOperator = state.systems.helm?.operatorCrewId === me.id && me.roomId === state.systems.helm?.roomId;
  const weaponReady = state.weaponChargeTicks >= state.weaponChargeMaxTicks;
  const lowOxygenRooms = Object.values(state.rooms).filter((room) => room.oxygen <= 35);
  const breachedRooms = Object.values(state.rooms).filter((room) => room.breached);
  const damagedSystems = systems.filter((system) => system.health < system.maxHealth);
  const incapacitatedCrew = Object.values(state.crew).filter((crew) => crew.incapacitated);
  const crisisItems: CrisisItem[] = [
    ...(state.hull <= state.maxHull * .35 ? [{ id: 'hull', tone: 'critical' as const, title: 'Hull integrity critical', detail: `${state.hull}/${state.maxHull} hull` }] : []),
    ...(Object.keys(state.fires).length > 0 ? [{ id: 'fire', tone: 'critical' as const, title: `${Object.keys(state.fires).length} active fire${Object.keys(state.fires).length === 1 ? '' : 's'}`, detail: 'Contain or vent immediately' }] : []),
    ...(breachedRooms.length > 0 ? [{ id: 'breach', tone: 'critical' as const, title: `${breachedRooms.length} hull breach${breachedRooms.length === 1 ? '' : 'es'}`, detail: breachedRooms.map((room) => room.id).join(' · ') }] : []),
    ...(Object.keys(state.boarders).length > 0 ? [{ id: 'boarders', tone: 'critical' as const, title: `${Object.keys(state.boarders).length} hostile boarder${Object.keys(state.boarders).length === 1 ? '' : 's'}`, detail: Object.values(state.boarders).map((boarder) => boarder.roomId).join(' · ') }] : []),
    ...(incapacitatedCrew.length > 0 ? [{ id: 'crew', tone: 'critical' as const, title: `${incapacitatedCrew.length} crew member${incapacitatedCrew.length === 1 ? '' : 's'} down`, detail: incapacitatedCrew.map((crew) => `${crew.name} (${Math.max(0, Math.ceil(crew.bleedoutTicks * TICK_SECONDS))}s to revive)`).join(' · ') }] : []),
    ...(lowOxygenRooms.length > 0 ? [{ id: 'oxygen', tone: 'warning' as const, title: 'Low oxygen', detail: lowOxygenRooms.map((room) => `${room.id} ${Math.round(room.oxygen)}%`).join(' · ') }] : []),
    ...(damagedSystems.length > 0 ? [{ id: 'systems', tone: 'warning' as const, title: 'System damage detected', detail: damagedSystems.map((system) => SYSTEM_COPY[system.id]).join(' · ') }] : []),
    ...(state.status === 'encounter' && state.enemyWeaponChargeMaxTicks > 0 && state.enemyWeaponChargeTicks / state.enemyWeaponChargeMaxTicks >= .8 ? [{ id: 'incoming', tone: 'warning' as const, title: 'Incoming enemy volley', detail: 'Boost shields or evasion' }] : []),
  ];
  const priorityAction = boardersHere[0]
    ? `Fight boarder in ${currentLayout?.name ?? me.roomId}`
    : downedHere[0]
      ? `Revive ${downedHere[0].name}`
      : extinguishableFires[0]
        ? `Extinguish ${extinguishableFires[0].size} fire`
        : currentRoom?.breached
          ? 'Seal hull breach'
            : isWeaponsOperator && weaponReady
              ? `Fire ${WEAPON_TARGET_COPY[state.weaponTarget]}`
              : currentSystem && currentSystem.health < currentSystem.maxHealth
                ? `Repair ${SYSTEM_COPY[currentSystem.id]}`
                : currentRoom && (currentRoom.integrity < currentRoom.maxIntegrity || currentRoom.destroyed)
                  ? `Repair ${currentLayout?.name ?? me.roomId}`
                  : me.roomId === 'medbay' && me.health < me.maxHealth
                    ? 'Heal in medbay'
                    : currentSystem && currentSystem.operatorCrewId !== me.id
                      ? `Operate ${SYSTEM_COPY[currentSystem.id]}`
                      : 'Hold station';
  const performContextAction = () => {
    const boarder=boardersHere[0]; if(boarder){onCommand({kind:'attackBoarder',crewId:me.id,boarderId:boarder.id});return;}
    const downed=downedHere[0]; if(downed){onCommand({kind:'revive',crewId:me.id,targetCrewId:downed.id});return;}
    const fire=extinguishableFires[0]; if(fire){onCommand({kind:'extinguish',crewId:me.id,fireId:fire.id});return;}
    if(currentRoom?.breached){onCommand({kind:'sealBreach',crewId:me.id});return;}
    if(isWeaponsOperator && weaponReady){onCommand({kind:'fireWeapon',crewId:me.id});return;}
    if(currentSystem&&currentSystem.health<currentSystem.maxHealth){onCommand({kind:'repair',crewId:me.id,systemId:currentSystem.id});return;}
    if(currentRoom&&(currentRoom.integrity<currentRoom.maxIntegrity||currentRoom.destroyed)){onCommand({kind:'repairRoom',crewId:me.id});return;}
    if(me.roomId === 'medbay' && me.health < me.maxHealth){onCommand({kind:'heal',crewId:me.id});return;}
    if(currentSystem)onCommand({kind:'operate',crewId:me.id,systemId:currentSystem.id});
  };
  const performRepairAction = () => {
    if (busy) return;
    if(currentSystem && currentSystem.health < currentSystem.maxHealth) onCommand({kind:'repair',crewId:me.id,systemId:currentSystem.id});
    else if(currentRoom && (currentRoom.integrity < currentRoom.maxIntegrity || currentRoom.destroyed)) onCommand({kind:'repairRoom',crewId:me.id});
  };
  keyHandlerRef.current=(event:KeyboardEvent)=>{if(state.status!=='encounter'||event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;const vectors:Record<string,[-1|0|1,-1|0|1]>={w:[0,-1],a:[-1,0],s:[0,1],d:[1,0]};const vector=vectors[event.key.toLowerCase()];if(vector){event.preventDefault();const now=Date.now();if(now-lastMoveAt.current<340)return;lastMoveAt.current=now;onCommand({kind:'moveVector',crewId:me.id,dx:vector[0],dy:vector[1]});}else if(event.key.toLowerCase()==='f'){event.preventDefault();performContextAction();}else if(event.key.toLowerCase()==='r'){event.preventDefault();performRepairAction();}};

  return <main className="ship-shell">
    {incomingCue !== null && <div key={`incoming-${incomingCue}`} className="weapon-bolt incoming-bolt"><i /><span /></div>}
    {outgoingCue !== null && <div key={`outgoing-${outgoingCue}`} className="weapon-bolt outgoing-bolt"><i /><span /></div>}
    {incomingCue !== null && <div key={`impact-${incomingCue}`} className={`ship-impact ${state.shields > 0 ? 'shield-impact' : 'hull-impact'}`} />}
    <header className="ship-header"><div><p className="eyebrow">DUNGEONSLOP · SECTOR {state.sectorIndex + 1}</p><h1>The Questionable Decision</h1></div><button className="sound-toggle" onClick={audio.toggle}>{audio.enabled ? 'SOUND ON' : 'SOUND OFF'}</button><div className="objective"><small>OBJECTIVE</small><strong>{state.objectiveText}</strong></div></header>
    {slop && <div className="slop-banner"><small>SLOP CONDITION</small><b>{slop.name}</b><span>{slop.description}</span></div>}
    <section className={`crisis-panel ${crisisItems.length > 0 ? 'has-alerts' : 'nominal'}`} aria-live="polite"><div className="crisis-heading"><p className="eyebrow">SHIP STATUS</p><b>{crisisItems.length > 0 ? `${crisisItems.length} ALERT${crisisItems.length === 1 ? '' : 'S'}` : 'NOMINAL'}</b></div>{crisisItems.length > 0 ? <div className="crisis-list">{crisisItems.slice(0, 3).map((crisis) => <div key={crisis.id} className={crisis.tone}><i /><span><b>{crisis.title}</b><small>{crisis.detail}</small></span></div>)}{crisisItems.length > 3 && <small className="more-crises">+{crisisItems.length - 3} additional alert{crisisItems.length === 4 ? '' : 's'}</small>}</div> : <p className="all-clear">Hold stations. Prepare the next volley.</p>}</section>
    <section className="ship-stats"><span><small>HULL</small><b>{state.hull}/{state.maxHull}</b></span><span><small>SHIELDS</small><b>{state.shields}/{state.maxShields}</b></span><span><small>REACTOR</small><b>{state.reactorCapacity}</b></span><span><small>SCRAP</small><b>{state.scrap}</b></span></section>
    {state.status === 'encounter' && <section className="enemy-panel" aria-label="Hostile ship status"><p className="eyebrow">HOSTILE CONTACT</p><div className="enemy-hull-bar"><span style={{ width: `${state.enemyMaxHull > 0 ? state.enemyHull / state.enemyMaxHull * 100 : 0}%` }} /></div><small>Hull {state.enemyHull}/{state.enemyMaxHull} · Shields {state.enemyShields}</small><b>WEAPON {state.enemyWeaponChargeTicks}/{state.enemyWeaponChargeMaxTicks}</b><div className="enemy-weapon-meter"><span style={{ width: `${state.enemyWeaponChargeMaxTicks > 0 ? state.enemyWeaponChargeTicks / state.enemyWeaponChargeMaxTicks * 100 : 0}%` }} /></div><div className="enemy-ship-preview" aria-label={`Hostile ship with ${state.enemyShields} shield layers`}><div className="enemy-shield-rings">{Array.from({ length: Math.min(4, state.enemyShields) }, (_, index) => <i key={index} />)}</div><div className="enemy-ship-hull">{(['weapons', 'shields', 'helm', 'core'] as WeaponTarget[]).map((target) => <button key={target} disabled={!isWeaponsOperator} onClick={() => onCommand({ kind: 'setWeaponTarget', crewId: me.id, target })} className={`enemy-room enemy-room-${target} ${state.weaponTarget === target ? 'targeted' : ''}`}><b>{WEAPON_TARGET_COPY[target]}</b>{target === 'weapons' && <i className={state.enemyWeaponChargeTicks >= state.enemyWeaponChargeMaxTicks * .8 ? 'arming' : ''} />}</button>)}</div><em>{isWeaponsOperator ? `TARGET: ${WEAPON_TARGET_COPY[state.weaponTarget].toUpperCase()}` : 'OPERATE WEAPONS TO TARGET'}</em></div></section>}
    <aside className="power-panel" aria-label="Reactor power allocation">
      <div className="power-panel-heading"><p className="eyebrow">POWER GRID</p><b>{allocatedPower}<small> / {state.reactorCapacity}</small></b></div>
      <div className="power-meter"><i style={{ width: `${Math.min(100, allocatedPower / Math.max(1, state.reactorCapacity) * 100)}%` }} /></div>
      <p>{isEngineeringOperator ? 'You are routing power.' : 'Operate Engineering to reroute power.'}</p>
      <div className="power-system-list">{poweredSystems.map((system) => {
        const functionalLimit = Math.min(system.maxPower, system.health);
        const operator = system.operatorCrewId ? state.crew[system.operatorCrewId] : undefined;
        return <div key={system.id} className={system.power === 0 || system.health === 0 ? 'offline' : ''}>
          <span><b>{SYSTEM_COPY[system.id]}</b><small>{operator ? `${operator.name} on station` : system.health === 0 ? 'Damaged offline' : 'Unmanned'}</small></span>
          <em>{Array.from({ length: system.maxPower }, (_, index) => <i key={index} className={index < system.power ? 'active' : index < functionalLimit ? '' : 'broken'} />)}</em>
          {isEngineeringOperator && <div className="power-controls"><button disabled={system.power <= 0} onClick={() => onCommand({ kind: 'setPower', crewId: me.id, systemId: system.id, power: system.power - 1 })}>−</button><strong>{system.power}</strong><button disabled={system.power >= functionalLimit || allocatedPower >= state.reactorCapacity} onClick={() => onCommand({ kind: 'setPower', crewId: me.id, systemId: system.id, power: system.power + 1 })}>+</button></div>}
        </div>;
      })}</div>
    </aside>
    <section className="ship-board" style={hullStyle} aria-label="Ship rooms">
      <div className="ship-hull" aria-hidden="true"><i className="hull-keel" /><i className="hull-rib hull-rib-one" /><i className="hull-rib hull-rib-two" /><i className="hull-window hull-window-one" /><i className="hull-window hull-window-two" /></div>
      <div className="engine engine-top" /><div className="engine engine-bottom" />
      {doors.map((door) => {
        const stateDoor = state.doors[door.id];
        const doorStatus = stateDoor?.state ?? 'closed';
        const touchesCrewRoom = stateDoor?.roomA === me.roomId || stateDoor?.roomB === me.roomId;
        const canControl = !busy && !!stateDoor && (isBridgeOperator || (stateDoor.kind === 'interior' && stateDoor.state === 'closed' && touchesCrewRoom));
        const nextDoorState = isBridgeOperator && stateDoor?.state === 'open' ? 'closed' : 'open';
        return <button
          key={door.id}
          className={`ship-door ${door.orientation} ${doorStatus}`}
          style={{ left: `${door.x / DECK_COLUMNS * 100}%`, top: `${door.y / DECK_ROWS * 100}%` }}
          disabled={!canControl}
          onClick={() => stateDoor && onCommand({ kind: 'setDoorState', crewId: me.id, doorId: stateDoor.id, state: nextDoorState })}
          aria-label={`${stateDoor?.roomA ?? 'Room'} to ${stateDoor?.roomB || 'hull'} door: ${doorStatus}${canControl ? `. Activate to ${nextDoorState}` : ''}`}
        />;
      })}
      {Object.entries(roomLayout).map(([id, layout]) => {
        const room = state.rooms[id];
        const roomFires = Object.values(state.fires).filter((fire) => fire.roomId === id);
        const system = layout.systemId ? state.systems[layout.systemId] : undefined;
        const operator = system?.operatorCrewId ? state.crew[system.operatorCrewId] : undefined;
        const selectable = reachable.has(id) && !busy; const active = me.roomId === id;
        return <button key={id} className={`ship-room room-${id} ${active ? 'active' : ''} ${selectable ? 'reachable' : ''} ${roomFires.length > 0 ? 'on-fire' : ''} ${(room?.oxygen ?? 0) <= 35 ? 'low-oxygen' : ''} ${system && system.health < system.maxHealth ? 'system-damaged' : ''} ${room?.destroyed ? 'destroyed' : ''}`} style={{ gridColumn: `${layout.x + 1} / span ${layout.w}`, gridRow: `${layout.y + 1} / span ${layout.h}` }} disabled={!selectable} onClick={() => onCommand({ kind: 'move', crewId: me.id, roomId: id })}>
          <span className="room-name">{layout.name}</span><span className="oxygen">O₂ {Math.round(room?.oxygen ?? 0)}%</span>
          <span className="integrity">HP {room?.integrity ?? 0}/{room?.maxIntegrity ?? 0}</span>
          {system && <span className={`room-system ${system.power <= 0 || system.health <= 0 ? 'offline' : ''}`}><b>{system.power}/{system.maxPower} PWR</b><i>{operator ? operator.name : system.health <= 0 ? 'offline' : 'unmanned'}</i><em><strong style={{ width: `${system.maxHealth > 0 ? system.health / system.maxHealth * 100 : 0}%` }} /></em></span>}
          {room?.destroyed && <strong className="hazard">DESTROYED</strong>}{room?.breached && <strong className="hazard">BREACH</strong>}{roomFires.length > 0 && <strong className="hazard">FIRE ×{roomFires.length}</strong>}
        </button>;
      })}
      <div className="unit-layer">
        {Object.values(state.fires).map((fire) => <i
          key={fire.id}
          className={`fire-token ${fire.size}`}
          title={`${fire.size} fire in ${fire.roomId}`}
          style={{ left: `${((fire.x + .5) / DECK_COLUMNS) * 100}%`, top: `${((fire.y + .5) / DECK_ROWS) * 100}%` }}
        />)}
        {Object.values(state.crew).map((member) => {
          const progress = member.interactionTotalTicks > 0 ? member.interactionTicks / member.interactionTotalTicks * 100 : 0;
          const interaction = INTERACTION_COPY[member.interactionKind];
          return <div
            key={member.id}
            className="crew-unit"
            style={{ left: `${((member.deckX + .5) / DECK_COLUMNS) * 100}%`, top: `${((member.deckY + .5) / DECK_ROWS) * 100}%` }}
            title={`${member.name}, ${member.role}${interaction ? ` — ${interaction}` : ''}`}
          >
            <i className={`${member.role} ${member.incapacitated ? 'down' : ''}`}>{member.name.slice(0, 1).toUpperCase()}</i>
            <span className={`interaction-meter ${interaction ? 'active' : ''}`} aria-label={interaction ? `${member.name}: ${interaction}` : `${member.name}: idle`}>
              <b style={{ width: `${progress}%` }} />{interaction && <em>{interaction}</em>}
            </span>
          </div>;
        })}
        {Object.values(state.boarders).map((boarder) => {
          const layout = roomLayout[boarder.roomId];
          const x = layout ? layout.x + layout.w - 0.35 : 0;
          const y = layout ? layout.y + layout.h - 0.35 : 0;
          return <i
            key={boarder.id}
            className="boarder"
            title={`Boarder, ${boarder.health} health`}
            style={{ left: `${(x / DECK_COLUMNS) * 100}%`, top: `${(y / DECK_ROWS) * 100}%` }}
          />;
        })}
      </div>
    </section>
    <aside className="crew-panel"><p className="eyebrow">YOUR CREW</p><h2>{me.name}</h2><strong>{me.role}</strong><div className="health-bar"><span style={{ width: `${(me.health / me.maxHealth) * 100}%` }} /></div><small>{me.health} health · room: {currentLayout?.name ?? me.roomId}</small>
      <button className="priority-action" disabled={busy || priorityAction === 'Hold station'} onClick={performContextAction}><span>CONTEXT ACTION · F</span><b>{priorityAction}</b></button>
      {isWeaponsOperator && <div className="weapon-control"><span><b>PULSE LASER</b><small>Target: {WEAPON_TARGET_COPY[state.weaponTarget]} · auto-fires when charged</small></span><div className="player-weapon-meter"><i style={{ width: `${state.weaponChargeMaxTicks > 0 ? state.weaponChargeTicks / state.weaponChargeMaxTicks * 100 : 0}%` }} /></div><button className="fire-weapon" disabled={!weaponReady} onClick={() => onCommand({ kind: 'fireWeapon', crewId: me.id })}>{weaponReady ? `FIRE ${WEAPON_TARGET_COPY[state.weaponTarget].toUpperCase()} NOW (GUARANTEED)` : `CHARGING ${state.weaponChargeTicks}/${state.weaponChargeMaxTicks}`}</button></div>}
      <div className={`actions ${busy ? 'busy' : ''}`}><button className="ability" disabled={busy || me.abilityCooldownTicks > 0} onClick={() => onCommand({ kind:'useAbility', crewId:me.id })}>{ABILITY_COPY[me.role]} {me.abilityCooldownTicks > 0 ? `(${Math.ceil(me.abilityCooldownTicks * TICK_SECONDS)}s)` : ''}</button>{me.roomId === 'medbay' && me.health < me.maxHealth && <button onClick={() => onCommand({kind:'heal', crewId:me.id})}>Heal ({medbayHealAmount} HP)</button>}{currentSystem && <><button onClick={() => onCommand({ kind:'operate', crewId:me.id, systemId:currentSystem.id })}>Operate {currentSystem.id}</button>{currentSystem.health < currentSystem.maxHealth && <button onClick={() => onCommand({ kind:'repair', crewId:me.id, systemId:currentSystem.id })}>Repair system ({currentSystem.health}/{currentSystem.maxHealth})</button>}</>}{currentRoom && (currentRoom.integrity < currentRoom.maxIntegrity || currentRoom.destroyed) && <button onClick={() => onCommand({kind:'repairRoom',crewId:me.id})}>Repair room ({currentRoom.integrity}/{currentRoom.maxIntegrity})</button>}{firesHere.map((fire) => <button key={fire.id} disabled={!extinguishableFires.some((candidate) => candidate.id === fire.id)} onClick={() => onCommand({kind:'extinguish',crewId:me.id,fireId:fire.id})}>Extinguish {fire.size} fire</button>)}{currentRoom?.breached && <button onClick={() => onCommand({kind:'sealBreach',crewId:me.id})}>Seal breach</button>}{boardersHere.map((boarder) => <button className="danger" key={boarder.id} onClick={() => onCommand({kind:'attackBoarder',crewId:me.id,boarderId:boarder.id})}>Fight boarder ({boarder.health})</button>)}{downedHere.map((crew) => <button key={crew.id} onClick={() => onCommand({kind:'revive',crewId:me.id,targetCrewId:crew.id})}>Revive {crew.name}</button>)}</div>
      {error && <p className="error">{error}</p>}
    </aside>
    <footer className="crew-strip">{Object.values(state.crew).map((crew) => <div key={crew.id} className={crew.id === me.id ? 'mine' : ''}><i className={crew.role}>{crew.name.slice(0,1)}</i><span><b>{crew.name}</b><small>{crew.role} · {crew.roomId}</small></span><em className={crew.incapacitated ? 'bleedout' : ''}>{crew.incapacitated ? `DOWN · ${Math.max(0, Math.ceil(crew.bleedoutTicks * TICK_SECONDS))}s` : crew.health}</em></div>)}</footer>
    <div className="control-hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> MOVE <kbd>F</kbd> INTERACT <kbd>R</kbd> REPAIR</div>
    {(state.status === 'victory' || state.status === 'defeat') && <div className="result-overlay"><p className="eyebrow">ENCOUNTER COMPLETE</p><h2>{state.status === 'victory' ? 'SHIP SECURED' : 'SHIP LOST'}</h2><p>{state.status === 'victory' ? 'The Scrap Raider has been disabled.' : 'The crew ran out of good decisions.'}</p></div>}
    {voteActive && <div className="vote-overlay"><div className="vote-card"><p className="eyebrow">{state.status === 'mapVote' ? `SECTOR ${state.sectorIndex + 1} ROUTE` : state.status === 'eventVote' ? 'SUSPICIOUS SIGNAL' : state.status === 'layoutVote' ? 'MODULAR REFIT' : 'SHIPYARD DEMOCRACY'}</p><h2>{state.status === 'mapVote' ? 'Where are we making things worse?' : state.status === 'eventVote' ? 'What could possibly go wrong?' : state.status === 'layoutVote' ? 'How should we rebuild the ship?' : 'What should we bolt onto the ship?'}</h2>{state.status === 'mapVote' && <div className="sector-track">{[0,1,2].map((sector) => <span key={sector} className={sector < state.sectorIndex ? 'complete' : sector === state.sectorIndex ? 'current' : ''}><i>{sector < state.sectorIndex ? '✓' : sector + 1}</i><b>{sector === 2 ? 'Final sector' : `Sector ${sector + 1}`}</b></span>)}</div>}<p>Captain {captain?.name ?? 'Unknown'} breaks ties · {secondsLeft}s remaining</p><div className={`vote-options ${state.status === 'mapVote' ? 'route-options' : ''}`}>{state.voteOptions.map((option, index) => { const copy=OPTION_COPY[option] ?? {name:option,description:''}; const count=Object.values(state.votes).filter((vote)=>vote===option).length; return <button key={option} style={{ '--node-offset': `${index % 2 === 0 ? -8 : 8}px` } as React.CSSProperties} className={state.votes[mySessionId] === option ? 'selected' : ''} onClick={() => onVote(option)}>{state.status === 'layoutVote' && <i className={`layout-preview ${option}`} />}<strong>{copy.name}</strong><span>{copy.description}</span><em>{count} vote{count === 1 ? '' : 's'}</em></button>; })}</div><div className="voter-row">{players.map((player) => <span key={player.sessionId} className={state.votes[player.sessionId] ? 'voted' : ''}>{player.name} {state.votes[player.sessionId] ? '✓' : '…'}</span>)}</div>{error && <p className="error">{error}</p>}</div></div>}
  </main>;
}
