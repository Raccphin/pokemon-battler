import { DefaultTheme, ThemeProvider } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { AppQueryProvider } from '@/providers/query-provider';
import { PlayerProvider } from '@/providers/player-provider';

export default function TabLayout() {
  return (
    <AppQueryProvider>
      <PlayerProvider>
        <ThemeProvider value={DefaultTheme}>
          <AppTabs />
        </ThemeProvider>
      </PlayerProvider>
    </AppQueryProvider>
  );
}
