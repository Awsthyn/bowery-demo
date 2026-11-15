import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';

import { MockApiClient, readDb } from '@/api/MockApiClient';
import type { DocKind, Draft, LocalFile } from '@/domain/types';
import { DOC_KINDS } from '@/domain/types';
import { resetDemo } from '@/features/dev/resetDemo';
import { LAST_STEP } from '@/features/onboarding/steps';
import { runOutbox } from '@/outbox/processor';
import { DEFAULT_DEV_SETTINGS } from '@/stores/devSettingsStore';
import { useDraftStore } from '@/stores/draftStore';
import { useOutboxStore } from '@/stores/outboxStore';

const file = (kind: DocKind): LocalFile => ({
  uri: `file:///${kind}`,
  mimeType: kind === 'offerLetter' ? 'application/pdf' : 'image/jpeg',
  name: kind,
  sizeBytes: 1000,
  source: 'camera',
});
const files = Object.fromEntries(DOC_KINDS.map((k) => [k, file(k)])) as Record<DocKind, LocalFile>;
const personal = {
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+44 20 7946 0958',
  dateOfBirth: '1990-12-10',
  nationality: 'British',
  documentNumber: '30123456',
};

const api = new MockApiClient({
  getSettings: () => ({ ...DEFAULT_DEV_SETTINGS, latencyMs: 0 }),
  isOnline: async () => true,
  sleep: async () => undefined,
});

beforeEach(async () => {
  await AsyncStorage.clear();
  useOutboxStore.setState({ items: {} });
  useDraftStore.setState({ drafts: {} });
});

// protects=after Reset demo the reviewer is back on Review with their data and can submit again (no 404 dead end);
// fails_when=the draft still points at a wiped application, the outbox keeps the old item, the mock db survives, or form data/files are lost;
// no_claim=the navigation (router.dismissAll/replace) and the confirm dialog, which live in the screen
it('wipes the server and the submission but keeps the draft data', async () => {
  const draft: Draft = { uid: 'u1', currentStep: LAST_STEP, personal, files, updatedAt: '' };
  useDraftStore.setState({ drafts: { u1: draft } });
  const item = useOutboxStore.getState().enqueue({ uid: 'u1', personal, files });
  useDraftStore.getState().markSubmitted('u1', item.id);
  await runOutbox({ api });
  expect(useDraftStore.getState().drafts.u1.applicationId).toBeDefined(); // precondition: really submitted

  const queryClient = new QueryClient();
  queryClient.setQueryData(['application-status', 'app_x'], { status: 'in_review' });

  await resetDemo('u1', queryClient);

  const after = useDraftStore.getState().drafts.u1;
  expect(after).toMatchObject({ currentStep: LAST_STEP, personal, files });
  expect(after.applicationId).toBeUndefined();
  expect(after.outboxItemId).toBeUndefined();
  expect(useOutboxStore.getState().items).toEqual({});
  expect(await readDb()).toEqual({ responses: {}, documents: {}, applications: {} });
  expect(queryClient.getQueryData(['application-status', 'app_x'])).toBeUndefined();
});
