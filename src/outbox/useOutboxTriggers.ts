import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { api } from '@/api';
import { useDevSettings } from '@/stores/devSettingsStore';
import { useOutboxStore } from '@/stores/outboxStore';

import { runOutbox } from './processor';

/** Also called directly by the UI after enqueue / retry. */
export const kick = () => void runOutbox({ api });

/**
 * Wires every event that can make a pending item sendable:
 * app start (after rehydration), reconnect, app foregrounded, dev "offline" switched off,
 * and the earliest backoff deadline. New and retried items call `kick()` directly.
 */
export function useOutboxTriggers() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Only future backoff deadlines arm the timer. Items that are runnable *now* but stuck on
    // NetworkError wait for a connectivity event instead of spinning in a 0 ms loop.
    const scheduleNext = () => {
      clearTimeout(timer);
      const now = Date.now();
      const deadlines = Object.values(useOutboxStore.getState().items)
        .filter((i) => i.status === 'pending' && i.nextAttemptAt > now)
        .map((i) => i.nextAttemptAt);
      if (deadlines.length === 0) return;
      timer = setTimeout(kick, Math.min(...deadlines) - now);
    };

    const unsubs = [
      useOutboxStore.persist.onFinishHydration(kick),
      useOutboxStore.subscribe(scheduleNext),
      NetInfo.addEventListener((state) => {
        if (state.isConnected) kick();
      }),
      useDevSettings.subscribe((s, prev) => {
        if (prev.forceOffline && !s.forceOffline) kick();
      }),
    ];
    const appState = AppState.addEventListener('change', (s) => s === 'active' && kick());

    if (useOutboxStore.persist.hasHydrated()) kick();

    return () => {
      clearTimeout(timer);
      unsubs.forEach((u) => u());
      appState.remove();
    };
  }, []);
}
