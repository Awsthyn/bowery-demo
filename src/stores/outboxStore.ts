import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { OutboxItem, SubmitPayload } from '@/domain/types';
import { persistStorage } from '@/lib/storage';

type OutboxState = {
  items: Record<string, OutboxItem>;
  enqueue: (payload: SubmitPayload) => OutboxItem;
  update: (id: string, patch: Partial<OutboxItem>) => void;
  /** Manual retry from the UI: fresh attempt budget, run now. */
  retry: (id: string) => void;
  /** After a crash or kill, anything left in_flight never finished: make it runnable again. */
  recoverInFlight: () => void;
  removeForUser: (uid: string) => void;
};

export const useOutboxStore = create<OutboxState>()(
  persist(
    (set, get) => ({
      items: {},
      enqueue: (payload) => {
        const item: OutboxItem = {
          id: Crypto.randomUUID(),
          idempotencyKey: Crypto.randomUUID(),
          kind: 'submitApplication',
          payload,
          status: 'pending',
          attempts: 0,
          nextAttemptAt: 0,
          createdAt: Date.now(),
        };
        set((s) => ({ items: { ...s.items, [item.id]: item } }));
        return item;
      },
      update: (id, patch) =>
        set((s) => (s.items[id] ? { items: { ...s.items, [id]: { ...s.items[id], ...patch } } } : s)),
      retry: (id) =>
        get().update(id, {
          status: 'pending',
          attempts: 0,
          nextAttemptAt: 0,
          lastError: undefined,
          waitingForNetwork: false,
        }),
      recoverInFlight: () =>
        set((s) => {
          const items = { ...s.items };
          for (const item of Object.values(items)) {
            if (item.status === 'in_flight') items[item.id] = { ...item, status: 'pending' };
          }
          return { items };
        }),
      removeForUser: (uid) =>
        set((s) => ({
          items: Object.fromEntries(Object.entries(s.items).filter(([, i]) => i.payload.uid !== uid)),
        })),
    }),
    {
      name: 'outbox-v1',
      version: 1,
      storage: persistStorage,
      onRehydrateStorage: () => (state) => state?.recoverInFlight(),
    },
  ),
);
