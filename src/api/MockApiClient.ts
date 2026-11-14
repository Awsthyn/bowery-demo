import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DevSettings, DocKind, LocalFile } from '@/domain/types';
import { DOC_KINDS } from '@/domain/types';
import { MAX_PDF_BYTES } from '@/features/onboarding/schemas';

import {
  type ApiClient,
  type ApplicationStatusResponse,
  NetworkError,
  ServerError,
  type SubmitApplicationInput,
} from './ApiClient';

export const MOCK_DB_KEY = 'mock-db-v1';
export const REJECTION_REASON = 'ID photo is blurry. Please retake the front of your ID.';

type StoredApplication = {
  id: string;
  fullName: string;
  documentIds: Record<DocKind, string>;
  createdAt: string;
};

export type MockDb = {
  /** idempotencyKey -> response previously returned for it */
  responses: Record<string, unknown>;
  documents: Record<string, { kind: DocKind; name: string; sizeBytes: number }>;
  applications: Record<string, StoredApplication>;
};

const emptyDb = (): MockDb => ({ responses: {}, documents: {}, applications: {} });

export type MockApiDeps = {
  getSettings: () => DevSettings;
  isOnline: () => Promise<boolean>;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  newId?: (prefix: string) => string;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let counter = 0;
const defaultNewId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`;

/**
 * In-app stand-in for the onboarding backend. Persists its "database" in AsyncStorage,
 * honours idempotency keys, and fails on demand according to Dev settings.
 */
export class MockApiClient implements ApiClient {
  private readonly random: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly newId: (prefix: string) => string;
  /** Serialises read-modify-write cycles on the persisted db. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: MockApiDeps) {
    this.random = deps.random ?? Math.random;
    this.sleep = deps.sleep ?? defaultSleep;
    this.newId = deps.newId ?? defaultNewId;
  }

  async uploadDocument(file: LocalFile, kind: DocKind, idempotencyKey: string) {
    await this.network();
    return this.transaction(async (db) => {
      const cached = db.responses[idempotencyKey] as { documentId: string } | undefined;
      if (cached) return cached;

      const allowed = kind === 'offerLetter' ? 'application/pdf' : 'image/jpeg';
      if (file.mimeType !== allowed) throw new ServerError(422, `${kind} must be ${allowed}`);
      if (file.mimeType === 'application/pdf' && file.sizeBytes > MAX_PDF_BYTES) {
        throw new ServerError(422, 'File must be 10 MB or smaller');
      }

      const documentId = this.newId('doc');
      db.documents[documentId] = { kind, name: file.name, sizeBytes: file.sizeBytes };
      const response = { documentId };
      db.responses[idempotencyKey] = response;
      return response;
    });
  }

  async submitApplication(input: SubmitApplicationInput, idempotencyKey: string) {
    await this.network();
    return this.transaction(async (db) => {
      const cached = db.responses[idempotencyKey] as { applicationId: string; status: 'in_review' } | undefined;
      if (cached) return cached;

      for (const kind of DOC_KINDS) {
        const doc = db.documents[input.documentIds[kind]];
        if (!doc || doc.kind !== kind) throw new ServerError(422, `Missing document: ${kind}`);
      }

      const applicationId = this.newId('app');
      db.applications[applicationId] = {
        id: applicationId,
        fullName: input.personal.fullName,
        documentIds: input.documentIds,
        createdAt: new Date().toISOString(),
      };
      const response = { applicationId, status: 'in_review' as const };
      db.responses[idempotencyKey] = response;
      return response;
    });
  }

  async getApplicationStatus(applicationId: string): Promise<ApplicationStatusResponse> {
    await this.network();
    const db = await readDb();
    const app = db.applications[applicationId];
    if (!app) throw new ServerError(404, 'Application not found');

    const { forcedStatus } = this.deps.getSettings();
    const updatedAt = new Date().toISOString();
    if (forcedStatus === 'approved') return { status: 'approved', updatedAt };
    if (forcedStatus === 'rejected') return { status: 'rejected', rejectionReason: REJECTION_REASON, updatedAt };
    return { status: 'in_review', updatedAt: app.createdAt };
  }

  /** Simulates the network hop: offline check, latency, then random 503s. */
  private async network() {
    const settings = this.deps.getSettings();
    if (settings.forceOffline || !(await this.deps.isOnline())) throw new NetworkError();
    await this.sleep(settings.latencyMs);
    if (this.deps.getSettings().forceOffline) throw new NetworkError();
    if (this.random() < settings.failRate) throw new ServerError(503, 'Service unavailable (simulated)');
  }

  private transaction<T>(fn: (db: MockDb) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const db = await readDb();
      const result = await fn(db);
      await AsyncStorage.setItem(MOCK_DB_KEY, JSON.stringify(db));
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}

export async function readDb(): Promise<MockDb> {
  const raw = await AsyncStorage.getItem(MOCK_DB_KEY);
  return raw ? { ...emptyDb(), ...(JSON.parse(raw) as MockDb) } : emptyDb();
}
