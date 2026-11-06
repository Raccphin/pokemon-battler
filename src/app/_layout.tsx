import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';

import { AppQueryProvider } from '@/providers/query-provider';
import { PlayerProvider } from '@/providers/player-provider';

export default function RootLayout() {
  return (
    <AppQueryProvider>
      <PlayerProvider>
        <ThemeProvider value={DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="starter-selection" />
            <Stack.Screen name="shop" />
            <Stack.Screen name="game-over" />
          </Stack>
        </ThemeProvider>
      </PlayerProvider>
    </AppQueryProvider>
  );
}
