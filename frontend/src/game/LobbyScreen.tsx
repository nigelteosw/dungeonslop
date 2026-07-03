import { useState, type CSSProperties } from 'react';
import { CLASSES } from '../engine';
import type { LobbyPlayerLike } from '../net/schemaAdapter';

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
  onSetClass: (classId: string) => void;
  onToggleReady: () => void;
  onStart: () => void;
}

export function LobbyScreen({
  status, error, roomCode, mySessionId, players, isHost,
  onCreate, onJoin, onSetName, onSetClass, onToggleReady, onStart,
}: Props) {
  const [joinCode, setJoinCode] = useState('');
  const [name, setName] = useState('');
  const me = players.find((p) => p.sessionId === mySessionId);
  const allReady = players.length > 0 && players.every((p) => p.ready);

  if (status === 'idle' || status === 'connecting' || status === 'error') {
    return (
      <div style={landingStyle}>
        <h1>Dungeonslop</h1>
        <button style={bigButton} disabled={status === 'connecting'} onClick={onCreate}>
          Create Room
        </button>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            placeholder="Room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            style={{ padding: 8, fontSize: 16 }}
          />
          <button disabled={status === 'connecting' || !joinCode.trim()} onClick={() => onJoin(joinCode)}>
            Join Room
          </button>
        </div>
        {status === 'connecting' && <p>Connecting...</p>}
        {error && <p style={{ color: '#f87171' }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={landingStyle}>
      <h1>Dungeonslop</h1>
      <p>
        Room code: <strong style={{ fontSize: 24, letterSpacing: 2 }}>{roomCode}</strong>
      </p>
      <p style={{ opacity: 0.7 }}>Share this code with friends — or press Start and play solo.</p>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && onSetName(name)}
          style={{ padding: 8, fontSize: 16 }}
        />
        {Object.values(CLASSES).map((c) => (
          <button
            key={c.id}
            onClick={() => onSetClass(c.id)}
            style={{ fontWeight: me?.classId === c.id ? 700 : 400 }}
          >
            {c.name}
          </button>
        ))}
        <button onClick={onToggleReady}>{me?.ready ? 'Not ready' : 'Ready'}</button>
      </div>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {players.map((p) => (
          <li key={p.sessionId}>
            {p.host ? '👑 ' : ''}{p.name || '(unnamed)'} — {p.classId} — {p.ready ? 'ready' : 'not ready'}
          </li>
        ))}
      </ul>

      {isHost && (
        <button style={bigButton} disabled={!allReady} onClick={onStart}>
          Start Game{players.length === 1 ? ' (Solo)' : ''}
        </button>
      )}
      {error && <p style={{ color: '#f87171' }}>{error}</p>}
    </div>
  );
}

const landingStyle: CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center',
};
const bigButton: CSSProperties = { padding: '12px 24px', fontSize: 18, marginTop: 8 };
