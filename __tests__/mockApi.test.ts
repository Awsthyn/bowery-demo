import AsyncStorage from '@react-native-async-storage/async-storage';

import { NetworkError } from '@/api/ApiClient';
import { MockApiClient, REJECTION_REASON, readDb } from '@/api/MockApiClient';
import type { DevSettings, DocKind, LocalFile } from '@/domain/types';
import { DOC_KINDS } from '@/domain/types';
import { DEFAULT_DEV_SETTINGS } from '@/stores/devSettingsStore';

const file = (kind: DocKind): LocalFile => ({
  uri: `file:///${kind}`,
  mimeType: kind === 'offerLetter' ? 'application/pdf' : 'image/jpeg',
  name: kind,
  sizeBytes: 1000,
  source: kind === 'offerLetter' ? 'document' : 'camera',
});

const personal = {
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+44 20 7946 0958',
  dateOfBirth: '1990-12-10',
  nationality: 'British',
  documentNumber: '30123456',
};

function client(overrides: Partial<DevSettings> = {}) {
  const settings = { ...DEFAULT_DEV_SETTINGS, latencyMs: 0, ...overrides };
  return new MockApiClient({
    getSettings: () => settings,
    isOnline: async () => true,
    sleep: async () => undefined,
  });
}

async function uploadAll(api: MockApiClient, key: string) {
  const ids = {} as Record<DocKind, string>;
  for (const kind of DOC_KINDS) ids[kind] = (await api.uploadDocument(file(kind), kind, `${key}:${kind}`)).documentId;
  return ids;
}

beforeEach(() => AsyncStorage.clear());

describe('MockApiClient', () => {
  // protects=AC11 no duplicate applications on resend; fails_when=same idempotency key creates a second application; no_claim=AsyncStorage mock stands in for device storage
  it('returns the same application for a repeated idempotency key', async () => {
    const api = client();
    const documentIds = await uploadAll(api, 'k1');
    const first = await api.submitApplication({ personal, documentIds }, 'k1');
    const again = await api.submitApplication({ personal, documentIds: await uploadAll(api, 'k1') }, 'k1');

    expect(again.applicationId).toBe(first.applicationId);
    expect(Object.keys((await readDb()).applications)).toHaveLength(1);
  });

  // protects=AC8 "Force offline" behaves like no network; fails_when=calls succeed or throw a retry-consuming error; no_claim=real NetInfo detection
  it('throws NetworkError when forced offline', async () => {
    await expect(client({ forceOffline: true }).uploadDocument(file('idFront'), 'idFront', 'k')).rejects.toBeInstanceOf(
      NetworkError,
    );
  });

  // protects=AC12 rejected status carries the reason; fails_when=forced decision is ignored; no_claim=real review workflow
  it('applies the forced decision from Dev settings', async () => {
    const api = client({ forcedStatus: 'rejected' });
    const { applicationId } = await api.submitApplication({ personal, documentIds: await uploadAll(api, 'k2') }, 'k2');

    await expect(api.getApplicationStatus(applicationId)).resolves.toMatchObject({
      status: 'rejected',
      rejectionReason: REJECTION_REASON,
    });
  });
});
