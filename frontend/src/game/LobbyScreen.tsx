import { useState } from 'react';
import type { CrewRole, LobbyPlayerLike } from '../net/schemaAdapter';
import './ship.css';

const ROLES: { id: CrewRole; name: string; job: string }[] = [
  { id: 'pilot', name: 'Pilot', job: 'Evasion and emergency burns' },
  { id: 'engineer', name: 'Engineer', job: 'Fast repairs and reactor control' },
  { id: 'gunner', name: 'Gunner', job: 'Weapons and called shots' },
  { id: 'medic', name: 'Medic', job: 'Revives and crew survival' },
];

interface Props {
  status: 'idle' | 'connecting' | 'lobby' | 'in-game' | 'error';
  error: string | null;
  roomCode: string;
  mySessionId: string;
  players: LobbyPlayerLike[];
  isHost: boolean;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onSetName: (name: string) => void;
  onSetRole: (role: CrewRole) => void;
  onToggleReady: () => void;
  onStart: () => void;
}

export function LobbyScreen(props: Props) {
  const [joinCode, setJoinCode] = useState('');
  const [name, setName] = useState('');
  const me = props.players.find((player) => player.sessionId === props.mySessionId);
  const allReady = props.players.length > 0 && props.players.every((player) => player.ready);

  if (props.status !== 'lobby' && props.status !== 'in-game') {
    return <main className="lobby-shell">
      <div className="lobby-card">
        <p className="eyebrow">SHIP FRIENDSLOP</p><h1>Dungeonslop</h1>
        <p>One ship. One crew. Several avoidable emergencies.</p>
        <button className="primary" disabled={props.status === 'connecting'} onClick={props.onCreate}>Create ship</button>
        <div className="join-row"><input aria-label="Room code" placeholder="Room code" value={joinCode} onChange={(event) => setJoinCode(event.target.value)} /><button disabled={!joinCode.trim()} onClick={() => props.onJoin(joinCode)}>Join</button></div>
        {props.status === 'connecting' && <p>Connecting…</p>}{props.error && <p className="error">{props.error}</p>}
      </div>
    </main>;
  }

  return <main className="lobby-shell"><div className="lobby-card wide">
    <p className="eyebrow">CREW ASSEMBLY · {props.roomCode}</p><h1>Choose your responsibility</h1>
    <div className="identity-row"><input placeholder="Callsign" value={name} onChange={(event) => setName(event.target.value)} onBlur={() => name.trim() && props.onSetName(name)} /></div>
    <div className="role-grid">{ROLES.map((role) => <button key={role.id} className={me?.role === role.id ? 'role selected' : 'role'} onClick={() => props.onSetRole(role.id)}><strong>{role.name}</strong><small>{role.job}</small></button>)}</div>
    <div className="crew-list">{props.players.map((player) => <div key={player.sessionId}><span>{player.host ? 'CAPTAIN · ' : ''}{player.name}</span><b>{player.role}</b><em>{player.ready ? 'READY' : 'NOT READY'}</em></div>)}</div>
    <div className="lobby-actions"><button onClick={props.onToggleReady}>{me?.ready ? 'Stand down' : 'Ready up'}</button>{props.isHost && <button className="primary" disabled={!allReady} onClick={props.onStart}>Launch run</button>}</div>
    {props.error && <p className="error">{props.error}</p>}
  </div></main>;
}
