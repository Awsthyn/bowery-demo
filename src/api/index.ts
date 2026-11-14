import NetInfo from '@react-native-community/netinfo';

import { useDevSettings } from '@/stores/devSettingsStore';

import type { ApiClient } from './ApiClient';
import { MockApiClient } from './MockApiClient';

export * from './ApiClient';

/** Swap this for an HTTP implementation of ApiClient to talk to a real backend. */
export const api: ApiClient = new MockApiClient({
  getSettings: () => useDevSettings.getState(),
  isOnline: async () => (await NetInfo.fetch()).isConnected !== false,
});
