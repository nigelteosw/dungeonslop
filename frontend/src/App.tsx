import { GameScreen } from './game/GameScreen';
import { LobbyScreen } from './game/LobbyScreen';
import { useDungeonRoom } from './net/useDungeonRoom';

export function App() {
  const net = useDungeonRoom();

  if (net.status === 'in-game' && net.driver) {
    return <GameScreen driver={net.driver} />;
  }

  return (
    <LobbyScreen
      status={net.status}
      error={net.error}
      roomCode={net.roomCode}
      mySessionId={net.mySessionId}
      players={net.players}
      isHost={net.isHost}
      onCreate={net.create}
      onJoin={net.join}
      onSetName={net.setName}
      onSetClass={net.setClass}
      onToggleReady={net.toggleReady}
      onStart={net.start}
    />
  );
}
