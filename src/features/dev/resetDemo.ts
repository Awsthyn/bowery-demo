import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';

import { MOCK_DB_KEY } from '@/api/MockApiClient';
import { LAST_STEP } from '@/features/onboarding/steps';
import { useDraftStore } from '@/stores/draftStore';
import { useOutboxStore } from '@/stores/outboxStore';

/**
 * Lets a reviewer replay the submit flow with different Dev settings without re-entering anything:
 * wipes the mock server, drops this user's queued/sent submissions, and reopens the draft on Review.
 * The draft's personal data and files are kept. Dev settings are left untouched.
 */
export async function resetDemo(uid: string, queryClient: QueryClient) {
  // Detach the draft first: an in-flight outbox run checks draft.outboxItemId before writing back an
  // applicationId, so a send that finishes after this point cannot re-attach itself.
  useDraftStore.getState().reopen(uid, LAST_STEP);
  useOutboxStore.getState().removeForUser(uid);
  await AsyncStorage.removeItem(MOCK_DB_KEY);
  queryClient.removeQueries({ queryKey: ['application-status'] });
}
