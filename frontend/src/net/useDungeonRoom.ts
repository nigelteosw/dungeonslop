import { useCallback, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import { colyseusClient } from './colyseusClient';
import {
  toLobbyPlayers,
  toShipViewState,
  type CrewRole,
  type DungeonStateLike,
  type LobbyPlayerLike,
  type ShipViewState,
  type SystemId,
  type WeaponTarget,
} from './schemaAdapter';

type Status = 'idle' | 'connecting' | 'lobby' | 'in-game' | 'error';
type Command =
  | { kind: 'move'; crewId: string; roomId: string }
  | { kind: 'moveVector'; crewId: string; dx: -1|0|1; dy: -1|0|1 }
  | { kind: 'operate' | 'repair'; crewId: string; systemId: SystemId }
  | { kind: 'setPower'; crewId: string; systemId: SystemId; power: number }
  | { kind: 'setWeaponTarget'; crewId: string; target: WeaponTarget }
  | { kind: 'fireWeapon'; crewId: string }
  | { kind: 'setDoorState'; crewId: string; doorId: string; state: 'open' | 'closed' | 'locked' }
  | { kind: 'extinguish'; crewId: string; fireId: string }
  | { kind: 'sealBreach'; crewId: string }
  | { kind: 'attackBoarder'; crewId: string; boarderId: string }
  | { kind: 'useAbility'; crewId: string }
  | { kind: 'revive'; crewId: string; targetCrewId: string }
  | { kind: 'heal'; crewId: string };

export function useDungeonRoom() {
  const roomRef = useRef<Room<DungeonStateLike> | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [mySessionId, setMySessionId] = useState('');
  const [players, setPlayers] = useState<LobbyPlayerLike[]>([]);
  const [shipState, setShipState] = useState<ShipViewState | null>(null);

  const attach = useCallback((room: Room<DungeonStateLike>) => {
    roomRef.current = room;
    setRoomCode(room.roomId);
    setMySessionId(room.sessionId);
    room.onMessage('rejected', (message: { message?: string }) => setError(message.message ?? 'Action rejected'));
    room.onStateChange((state: DungeonStateLike) => {
      setPlayers(toLobbyPlayers(state));
      if (state.status === 'lobby') {
        setStatus('lobby');
        setShipState(null);
      } else {
        setStatus('in-game');
        setShipState(toShipViewState(state));
      }
    });
    room.onLeave(() => {
      roomRef.current = null;
      setStatus('idle');
      setShipState(null);
    });
  }, []);

  const create = useCallback(async () => {
    setStatus('connecting');
    setError(null);
    try { attach(await colyseusClient.create<DungeonStateLike>('dungeon')); }
    catch (reason) { setStatus('error'); setError(reason instanceof Error ? reason.message : 'Failed to create room'); }
  }, [attach]);

  const join = useCallback(async (code: string) => {
    setStatus('connecting');
    setError(null);
    try { attach(await colyseusClient.joinById<DungeonStateLike>(code.trim())); }
    catch (reason) { setStatus('error'); setError(reason instanceof Error ? reason.message : 'Failed to join room'); }
  }, [attach]);

  const sendCommand = useCallback((command: Command) => {
    setError(null);
    roomRef.current?.send('command', command);
  }, []);

  const me = players.find((player) => player.sessionId === mySessionId);
  const myCrewId = shipState ? Object.values(shipState.crew).find((crew) => crew.ownerId === mySessionId)?.id ?? '' : '';

  return {
    status, error, roomCode, mySessionId, players, shipState, myCrewId,
    isHost: me?.host ?? false,
    create, join,
    setName: (name: string) => roomRef.current?.send('setName', { name }),
    setRole: (role: CrewRole) => roomRef.current?.send('setRole', { role }),
    toggleReady: () => roomRef.current?.send('toggleReady'),
    start: () => roomRef.current?.send('start'),
    castVote: (option: string) => roomRef.current?.send('vote', { option }),
    sendCommand,
  };
}
