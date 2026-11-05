import { useEffect, useState } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { OfflineGame } from './components/OfflineGame';
import { OnlineGame } from './components/OnlineGame';
import { useOnlineGame } from './net/useOnlineGame';

type Screen = 'home' | 'offline' | 'online';

export default function App() {
  const game = useOnlineGame();
  const [screen, setScreen] = useState<Screen>('home');

  // Any successful (re)join — from the menu, a create, or a silent resume —
  // takes over the screen; leaving the room drops back home.
  useEffect(() => {
    if (game.status === 'joined') {
      setScreen('online');
    }
  }, [game.status]);

  if (screen === 'offline') {
    return <OfflineGame onExit={() => setScreen('home')} />;
  }

  if (screen === 'online') {
    return (
      <OnlineGame
        game={game}
        onExit={() => {
          game.clearError();
          setScreen('home');
        }}
      />
    );
  }

  return <HomeScreen game={game} onOffline={() => setScreen('offline')} />;
}
