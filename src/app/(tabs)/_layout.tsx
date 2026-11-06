import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { usePlayer } from '@/providers/player-provider';

export default function TabLayout() {
  const { state } = usePlayer();
  if (state.status === 'ready' && state.profile.runStatus === 'gameOver') {
    return <Redirect href="../game-over" />;
  }
  if (state.status === 'ready' && !state.profile.starterSelected) {
    return <Redirect href="../starter-selection" />;
  }
  return <AppTabs />;
}
