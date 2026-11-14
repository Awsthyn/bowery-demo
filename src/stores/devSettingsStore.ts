import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DevSettings } from '@/domain/types';
import { persistStorage } from '@/lib/storage';

export const DEFAULT_DEV_SETTINGS: DevSettings = {
  latencyMs: 800,
  failRate: 0,
  forceOffline: false,
  forcedStatus: 'none',
};

type DevSettingsState = DevSettings & {
  set: (patch: Partial<DevSettings>) => void;
  reset: () => void;
};

export const useDevSettings = create<DevSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_DEV_SETTINGS,
      set: (patch) => set(patch),
      reset: () => set(DEFAULT_DEV_SETTINGS),
    }),
    { name: 'dev-settings-v1', version: 1, storage: persistStorage },
  ),
);
