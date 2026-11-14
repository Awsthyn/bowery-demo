import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useOutboxTriggers } from '@/outbox/useOutboxTriggers';
import { useDevSettings } from '@/stores/devSettingsStore';
import { useDraftStore } from '@/stores/draftStore';
import { useOutboxStore } from '@/stores/outboxStore';
import { useSession } from '@/stores/sessionStore';
import { darkTheme, lightTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 2_000 } },
});

const persistedStores = [useDraftStore, useOutboxStore, useDevSettings];

/** Routing decisions read the draft, so nothing renders until storage and auth are restored. */
function useAppReady() {
  const authReady = !useSession((s) => s.initializing);
  const [storesReady, setStoresReady] = useState(() => persistedStores.every((s) => s.persist.hasHydrated()));

  useEffect(() => {
    if (storesReady) return;
    const check = () => setStoresReady(persistedStores.every((s) => s.persist.hasHydrated()));
    const unsubs = persistedStores.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => unsubs.forEach((u) => u());
  }, [storesReady]);

  const ready = authReady && storesReady;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  return ready;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const ready = useAppReady();
  useOutboxTriggers();

  return (
    <SafeAreaProvider>
      <PaperProvider theme={scheme === 'dark' ? darkTheme : lightTheme}>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          {ready && <Stack screenOptions={{ headerShown: false }} />}
        </QueryClientProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
