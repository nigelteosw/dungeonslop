import { useCallback, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import { colyseusClient } from './colyseusClient';
import { toGameState, toLobbyPlayers, type DungeonStateLike, type LobbyPlayerLike } from './schemaAdapter';
import { legalMoves, cardTargets, keyOf, type GameState, type Pos } from '../engine';
import type { GameDriver } from '../game/driver';

type Status = 'idle' | 'connecting' | 'lobby' | 'in-game' | 'error';

export function useDungeonRoom() {
  const roomRef = useRef<Room<DungeonStateLike> | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [mySessionId, setMySessionId] = useState('');
  const [players, setPlayers] = useState<LobbyPlayerLike[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);

  const attach = useCallback((room: Room<DungeonStateLike>) => {
    roomRef.current = room;
    setRoomCode(room.roomId);
    setMySessionId(room.sessionId);
    room.onMessage('rejected', (msg: { message?: string }) => setError(msg?.message ?? 'action rejected'));
    room.onStateChange((state: DungeonStateLike) => {
      setPlayers(toLobbyPlayers(state));
      if (state.phase === 'lobby') {
        setStatus('lobby');
        setGameState(null);
      } else {
        setStatus('in-game');
        setGameState(toGameState(state));
      }
    });
    room.onLeave(() => {
      setStatus('idle');
      roomRef.current = null;
    });
  }, []);

  const create = useCallback(async () => {
    setStatus('connecting');
    setError(null);
    try {
      const room = await colyseusClient.create<DungeonStateLike>('dungeon');
      attach(room);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'failed to create room');
    }
  }, [attach]);

  const join = useCallback(async (code: string) => {
    setStatus('connecting');
    setError(null);
    try {
      const room = await colyseusClient.joinById<DungeonStateLike>(code.trim());
      attach(room);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'failed to join room');
    }
  }, [attach]);

  const setName = useCallback((name: string) => roomRef.current?.send('setName', { name }), []);
  const setClass = useCallback((classId: string) => roomRef.current?.send('setClass', { classId }), []);
  const toggleReady = useCallback(() => roomRef.current?.send('toggleReady'), []);
  const start = useCallback(() => roomRef.current?.send('start'), []);

  const myPlayerIndex = players.findIndex((p) => p.sessionId === mySessionId);
  const myUnitId = myPlayerIndex >= 0 ? `p${myPlayerIndex}` : '';
  const isHost = players[myPlayerIndex]?.host ?? false;

  let driver: GameDriver | null = null;
  if (gameState) {
    const activeId = gameState.order[gameState.activeIndex] ?? myUnitId;
    driver = {
      state: gameState,
      activeId,
      myUnitId,
      legalMoveKeys: new Set(legalMoves(gameState, activeId).map(keyOf)),
      cardTargetKeys: (cardId: string) => new Set(cardTargets(gameState, activeId, cardId).map(keyOf)),
      move: (to: Pos) => roomRef.current?.send('intent', { kind: 'move', to }),
      playCard: (cardId: string, target: Pos) => roomRef.current?.send('intent', { kind: 'playCard', cardId, target }),
      endTurn: () => roomRef.current?.send('intent', { kind: 'endTurn' }),
    };
  }

  return {
    status, error, roomCode, mySessionId, players, isHost, myUnitId, driver,
    create, join, setName, setClass, toggleReady, start,
  };
}
