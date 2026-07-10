import { LobbyScreen } from './game/LobbyScreen';
import { ShipScreen } from './game/ShipScreen';
import { useDungeonRoom } from './net/useDungeonRoom';

export function App() {
  const room = useDungeonRoom();
  if (room.status === 'in-game' && room.shipState) {
    return <ShipScreen state={room.shipState} myCrewId={room.myCrewId} mySessionId={room.mySessionId} players={room.players} error={room.error} onCommand={room.sendCommand} onVote={room.castVote} />;
  }
  return <LobbyScreen status={room.status} error={room.error} roomCode={room.roomCode} mySessionId={room.mySessionId} players={room.players} isHost={room.isHost} onCreate={room.create} onJoin={room.join} onSetName={room.setName} onSetRole={room.setRole} onToggleReady={room.toggleReady} onStart={room.start} />;
}
