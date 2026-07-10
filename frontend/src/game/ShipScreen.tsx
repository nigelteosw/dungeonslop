import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { LobbyPlayerLike, ShipViewState, SystemId } from '../net/schemaAdapter';
import { adjacentRoomIds, DECK_COLUMNS, DECK_ROWS, roomDoorLayouts, roomLayouts } from './shipLayout';
import { useShipAudio } from './useShipAudio';
import './ship.css';

type Command =
  | { kind: 'move'; crewId: string; roomId: string }
  | { kind: 'moveVector'; crewId: string; dx: -1|0|1; dy: -1|0|1 }
  | { kind: 'operate' | 'repair'; crewId: string; systemId: SystemId }
  | { kind: 'extinguish' | 'sealBreach'; crewId: string }
  | { kind: 'attackBoarder'; crewId: string; boarderId: string }
  | { kind: 'useAbility'; crewId: string }
  | { kind: 'revive'; crewId: string; targetCrewId: string };

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

interface Props { state: ShipViewState; myCrewId: string; mySessionId: string; players: LobbyPlayerLike[]; error: string | null; onCommand: (command: Command) => void; onVote: (option: string) => void; }

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
  const me = state.crew[myCrewId];
  if (!me) return <main className="ship-shell"><p>Waiting for crew assignment…</p></main>;
  const roomLayout = roomLayouts(state.rooms);
  const doors = roomDoorLayouts(state.rooms, state.doors);
  const reachable = new Set(adjacentRoomIds(me.roomId, state.doors));
  const currentRoom = state.rooms[me.roomId];
  const currentLayout = roomLayout[me.roomId];
  const currentSystem = currentLayout?.systemId ? state.systems[currentLayout.systemId] : undefined;
  const downedHere = Object.values(state.crew).filter((crew) => crew.id !== me.id && crew.roomId === me.roomId && crew.incapacitated);
  const boardersHere = Object.values(state.boarders).filter((boarder) => boarder.roomId === me.roomId);
  const slop = SLOP_COPY[state.slopEffectId];
  const voteActive = state.status === 'mapVote' || state.status === 'upgradeVote' || state.status === 'eventVote' || state.status === 'layoutVote';
  const secondsLeft = Math.max(0, Math.ceil((state.voteDeadlineTick - state.tick) * 0.4));
  const captain = players[state.captainSeat % Math.max(1, players.length)];
  const audio = useShipAudio(state);
  const lastMoveAt = useRef(0);
  const performContextAction = () => {
    const boarder=boardersHere[0]; if(boarder){onCommand({kind:'attackBoarder',crewId:me.id,boarderId:boarder.id});return;}
    const downed=downedHere[0]; if(downed){onCommand({kind:'revive',crewId:me.id,targetCrewId:downed.id});return;}
    if((currentRoom?.fire??0)>0){onCommand({kind:'extinguish',crewId:me.id});return;}
    if(currentRoom?.breached){onCommand({kind:'sealBreach',crewId:me.id});return;}
    if(currentSystem&&currentSystem.health<currentSystem.maxHealth){onCommand({kind:'repair',crewId:me.id,systemId:currentSystem.id});return;}
    if(currentSystem)onCommand({kind:'operate',crewId:me.id,systemId:currentSystem.id});
  };
  useEffect(()=>{const handler=(event:KeyboardEvent)=>{if(state.status!=='encounter'||event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;const vectors:Record<string,[-1|0|1,-1|0|1]>={w:[0,-1],a:[-1,0],s:[0,1],d:[1,0]};const vector=vectors[event.key.toLowerCase()];if(vector){event.preventDefault();const now=Date.now();if(now-lastMoveAt.current<110)return;lastMoveAt.current=now;onCommand({kind:'moveVector',crewId:me.id,dx:vector[0],dy:vector[1]});}else if(event.key.toLowerCase()==='f'){event.preventDefault();performContextAction();}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);});

  return <main className="ship-shell">
    {incomingCue !== null && <div key={`incoming-${incomingCue}`} className="weapon-bolt incoming-bolt"><i /><span /></div>}
    {outgoingCue !== null && <div key={`outgoing-${outgoingCue}`} className="weapon-bolt outgoing-bolt"><i /><span /></div>}
    {incomingCue !== null && <div key={`impact-${incomingCue}`} className={`ship-impact ${state.shields > 0 ? 'shield-impact' : 'hull-impact'}`} />}
    <header className="ship-header"><div><p className="eyebrow">DUNGEONSLOP · SECTOR {state.sectorIndex + 1}</p><h1>The Questionable Decision</h1></div><button className="sound-toggle" onClick={audio.toggle}>{audio.enabled ? 'SOUND ON' : 'SOUND OFF'}</button><div className="objective"><small>OBJECTIVE</small><strong>{state.objectiveText}</strong></div></header>
    {slop && <div className="slop-banner"><small>SLOP CONDITION</small><b>{slop.name}</b><span>{slop.description}</span></div>}
    <section className="ship-stats"><span><small>HULL</small><b>{state.hull}/{state.maxHull}</b></span><span><small>SHIELDS</small><b>{state.shields}/{state.maxShields}</b></span><span><small>REACTOR</small><b>{state.reactorCapacity}</b></span><span><small>SCRAP</small><b>{state.scrap}</b></span></section>
    {state.status === 'encounter' && <section className="enemy-panel"><p className="eyebrow">HOSTILE CONTACT</p><div><span style={{ width: `${state.enemyMaxHull > 0 ? state.enemyHull / state.enemyMaxHull * 100 : 0}%` }} /></div><small>Hull {state.enemyHull}/{state.enemyMaxHull} · Shields {state.enemyShields}</small><b>WEAPON {state.enemyWeaponChargeTicks}/{state.enemyWeaponChargeMaxTicks}</b><div className="weapon-meter"><span style={{ width: `${state.enemyWeaponChargeMaxTicks > 0 ? state.enemyWeaponChargeTicks / state.enemyWeaponChargeMaxTicks * 100 : 0}%` }} /></div></section>}
    <section className="ship-board" aria-label="Ship rooms">
      <div className="engine engine-top" /><div className="engine engine-bottom" /><div className="hull-detail hull-stripe" />
      {doors.map((door) => {
        const stateDoor = state.doors[door.id];
        const doorStatus = stateDoor?.locked ? 'locked' : stateDoor?.open ? 'open' : 'closed';
        return <span
          key={door.id}
          className={`ship-door ${door.orientation} ${doorStatus}`}
          style={{ left: `${door.x / DECK_COLUMNS * 100}%`, top: `${door.y / DECK_ROWS * 100}%` }}
          role="img"
          aria-label={`${stateDoor?.a ?? 'Room'} to ${stateDoor?.b ?? 'room'} door: ${doorStatus}`}
        />;
      })}
      {Object.entries(roomLayout).map(([id, layout]) => {
        const room = state.rooms[id];
        const selectable = reachable.has(id); const active = me.roomId === id;
        return <button key={id} className={`ship-room room-${id} ${active ? 'active' : ''} ${selectable ? 'reachable' : ''} ${(room?.fire ?? 0) > 0 ? 'on-fire' : ''}`} style={{ gridColumn: `${layout.x + 1} / span ${layout.w}`, gridRow: `${layout.y + 1} / span ${layout.h}` }} disabled={!selectable} onClick={() => onCommand({ kind: 'move', crewId: me.id, roomId: id })}>
          <span className="room-name">{layout.name}</span><span className="oxygen">O₂ {Math.round(room?.oxygen ?? 0)}%</span>
          {room?.breached && <strong className="hazard">BREACH</strong>}{(room?.fire ?? 0) > 0 && <strong className="hazard">FIRE ×{room?.fire}</strong>}
        </button>;
      })}
      <div className="unit-layer">
        {Object.values(state.crew).map((member) => <i
          key={member.id}
          style={{ left: `${((member.deckX + .5) / DECK_COLUMNS) * 100}%`, top: `${((member.deckY + .5) / DECK_ROWS) * 100}%` }}
          className={`${member.role} ${member.incapacitated ? 'down' : ''}`}
          title={`${member.name}, ${member.role}`}
        >{member.name.slice(0, 1).toUpperCase()}</i>)}
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
      <div className="actions"><button className="ability" disabled={me.abilityCooldownTicks > 0} onClick={() => onCommand({ kind:'useAbility', crewId:me.id })}>{ABILITY_COPY[me.role]} {me.abilityCooldownTicks > 0 ? `(${Math.ceil(me.abilityCooldownTicks / 4)}s)` : ''}</button>{currentSystem && <><button onClick={() => onCommand({ kind:'operate', crewId:me.id, systemId:currentSystem.id })}>Operate {currentSystem.id}</button>{currentSystem.health < currentSystem.maxHealth && <button onClick={() => onCommand({ kind:'repair', crewId:me.id, systemId:currentSystem.id })}>Repair ({currentSystem.health}/{currentSystem.maxHealth})</button>}</>}{(currentRoom?.fire ?? 0) > 0 && <button onClick={() => onCommand({ kind:'extinguish', crewId:me.id })}>Extinguish fire</button>}{currentRoom?.breached && <button onClick={() => onCommand({ kind:'sealBreach', crewId:me.id })}>Seal breach</button>}{boardersHere.map((boarder) => <button className="danger" key={boarder.id} onClick={() => onCommand({ kind:'attackBoarder', crewId:me.id, boarderId:boarder.id })}>Fight boarder ({boarder.health})</button>)}{downedHere.map((crew) => <button key={crew.id} onClick={() => onCommand({ kind:'revive', crewId:me.id, targetCrewId:crew.id })}>Revive {crew.name}</button>)}</div>
      {error && <p className="error">{error}</p>}
    </aside>
    <footer className="crew-strip">{Object.values(state.crew).map((crew) => <div key={crew.id} className={crew.id === me.id ? 'mine' : ''}><i className={crew.role}>{crew.name.slice(0,1)}</i><span><b>{crew.name}</b><small>{crew.role} · {crew.roomId}</small></span><em>{crew.incapacitated ? 'DOWN' : crew.health}</em></div>)}</footer>
    <div className="control-hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> MOVE <kbd>F</kbd> INTERACT</div>
    {(state.status === 'victory' || state.status === 'defeat') && <div className="result-overlay"><p className="eyebrow">ENCOUNTER COMPLETE</p><h2>{state.status === 'victory' ? 'SHIP SECURED' : 'SHIP LOST'}</h2><p>{state.status === 'victory' ? 'The Scrap Raider has been disabled.' : 'The crew ran out of good decisions.'}</p></div>}
    {voteActive && <div className="vote-overlay"><div className="vote-card"><p className="eyebrow">{state.status === 'mapVote' ? `SECTOR ${state.sectorIndex + 1} ROUTE` : state.status === 'eventVote' ? 'SUSPICIOUS SIGNAL' : state.status === 'layoutVote' ? 'MODULAR REFIT' : 'SHIPYARD DEMOCRACY'}</p><h2>{state.status === 'mapVote' ? 'Where are we making things worse?' : state.status === 'eventVote' ? 'What could possibly go wrong?' : state.status === 'layoutVote' ? 'How should we rebuild the ship?' : 'What should we bolt onto the ship?'}</h2>{state.status === 'mapVote' && <div className="sector-track">{[0,1,2].map((sector) => <span key={sector} className={sector < state.sectorIndex ? 'complete' : sector === state.sectorIndex ? 'current' : ''}><i>{sector < state.sectorIndex ? '✓' : sector + 1}</i><b>{sector === 2 ? 'Final sector' : `Sector ${sector + 1}`}</b></span>)}</div>}<p>Captain {captain?.name ?? 'Unknown'} breaks ties · {secondsLeft}s remaining</p><div className={`vote-options ${state.status === 'mapVote' ? 'route-options' : ''}`}>{state.voteOptions.map((option, index) => { const copy=OPTION_COPY[option] ?? {name:option,description:''}; const count=Object.values(state.votes).filter((vote)=>vote===option).length; return <button key={option} style={{ '--node-offset': `${index % 2 === 0 ? -8 : 8}px` } as React.CSSProperties} className={state.votes[mySessionId] === option ? 'selected' : ''} onClick={() => onVote(option)}>{state.status === 'layoutVote' && <i className={`layout-preview ${option}`} />}<strong>{copy.name}</strong><span>{copy.description}</span><em>{count} vote{count === 1 ? '' : 's'}</em></button>; })}</div><div className="voter-row">{players.map((player) => <span key={player.sessionId} className={state.votes[player.sessionId] ? 'voted' : ''}>{player.name} {state.votes[player.sessionId] ? '✓' : '…'}</span>)}</div>{error && <p className="error">{error}</p>}</div></div>}
  </main>;
}
