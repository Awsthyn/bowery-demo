import AsyncStorage from '@react-native-async-storage/async-storage';

import { NetworkError, ServerError } from '@/api/ApiClient';
import { MockApiClient, readDb } from '@/api/MockApiClient';
import type { DocKind, LocalFile, OutboxItem, SubmitPayload } from '@/domain/types';
import { DOC_KINDS } from '@/domain/types';
import { BACKOFF_MS, MAX_ATTEMPTS, failurePatch, runOutbox } from '@/outbox/processor';
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

const payload: SubmitPayload = {
  uid: 'u1',
  personal: {
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+44 20 7946 0958',
    dateOfBirth: '1990-12-10',
    nationality: 'British',
    documentNumber: 'AB123456',
  },
  files: Object.fromEntries(DOC_KINDS.map((k) => [k, file(k)])) as Record<DocKind, LocalFile>,
};

const item = (patch: Partial<OutboxItem> = {}): OutboxItem => ({
  id: 'i1',
  idempotencyKey: 'key',
  kind: 'submitApplication',
  payload,
  status: 'in_flight',
  attempts: 0,
  nextAttemptAt: 0,
  createdAt: 0,
  ...patch,
});

const onlineApi = () =>
  new MockApiClient({
    getSettings: () => ({ ...DEFAULT_DEV_SETTINGS, latencyMs: 0 }),
    isOnline: async () => true,
    sleep: async () => undefined,
  });

beforeEach(async () => {
  await AsyncStorage.clear();
  useOutboxStore.setState({ items: {} });
  useDraftStore.setState({ drafts: {} });
});

describe('outbox retry policy', () => {
  // protects=documented 1/2/4/8 s backoff between attempts; fails_when=delays change or are not exponential; no_claim=the timer actually firing (useOutboxTriggers)
  it('backs off exponentially on 5xx', () => {
    const delays: number[] = [];
    let current = item();
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      const patch = failurePatch(current, new ServerError(503, 'down'), 0);
      delays.push(patch.nextAttemptAt!);
      current = { ...current, ...patch };
    }
    expect(delays).toEqual(BACKOFF_MS.slice(0, MAX_ATTEMPTS - 1));
    expect(current.status).toBe('pending');
  });

  // protects=AC10 item ends in "failed" with Retry after 5 attempts; fails_when=it retries forever or gives up early; no_claim=wall-clock duration
  it('fails permanently after the 5th server error', () => {
    const patch = failurePatch(item({ attempts: MAX_ATTEMPTS - 1 }), new ServerError(503, 'down'), 0);
    expect(patch).toMatchObject({ status: 'failed', attempts: MAX_ATTEMPTS });
  });

  // protects=client errors are not retried; fails_when=a 422 burns retries; no_claim=which statuses the real backend returns
  it('does not retry 4xx', () => {
    expect(failurePatch(item(), new ServerError(422, 'bad file'), 0)).toMatchObject({
      status: 'failed',
      lastError: 'bad file',
    });
  });

  // protects=offline does not consume the attempt budget; fails_when=airplane mode leads to "failed"; no_claim=reconnect trigger wiring
  it('keeps attempts unchanged while offline', () => {
    const patch = failurePatch(item({ attempts: 2 }), new NetworkError(), 0);
    expect(patch).toEqual({ status: 'pending', lastError: 'Network unavailable', waitingForNetwork: true });
    expect(patch.attempts).toBeUndefined();
  });

  // protects=AC11 kill during send → exactly one application after restart; fails_when=in_flight items are stuck forever or resend duplicates; no_claim=a real process kill (simulated by state)
  it('recovers an item killed mid-send and submits it exactly once', async () => {
    const api = onlineApi();
    // First run got as far as uploading one document before the "kill".
    await api.uploadDocument(file('idFront'), 'idFront', 'key:idFront');
    useOutboxStore.setState({ items: { i1: item({ status: 'in_flight' }) } });
    useDraftStore.setState({
      drafts: { u1: { uid: 'u1', currentStep: 4, personal: {}, files: {}, outboxItemId: 'i1', updatedAt: '' } },
    });

    useOutboxStore.getState().recoverInFlight();
    await runOutbox({ api });
    await runOutbox({ api });

    const sent = useOutboxStore.getState().items.i1;
    expect(sent.status).toBe('done');
    expect(Object.keys((await readDb()).applications)).toHaveLength(1);
    expect(useDraftStore.getState().drafts.u1.applicationId).toBe(sent.result?.applicationId);
  });
});
