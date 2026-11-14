import type { ApiClient } from '@/api/ApiClient';
import { NetworkError, ServerError } from '@/api/ApiClient';
import type { DocKind, OutboxItem } from '@/domain/types';
import { DOC_KINDS } from '@/domain/types';
import { useDraftStore } from '@/stores/draftStore';
import { useOutboxStore } from '@/stores/outboxStore';

export const MAX_ATTEMPTS = 5;
/** Delay before attempt N+1 after N failed attempts (index N-1). */
export const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000] as const;

export type ProcessorDeps = {
  api: ApiClient;
  now?: () => number;
};

let running: Promise<void> | null = null;

/**
 * Drains every runnable outbox item once. Single-flight: concurrent callers share the in-progress run,
 * so NetInfo, AppState and timer triggers can fire freely without double-sending.
 */
export function runOutbox(deps: ProcessorDeps): Promise<void> {
  if (!running) {
    running = drain(deps).finally(() => {
      running = null;
    });
  }
  return running;
}

async function drain({ api, now = Date.now }: ProcessorDeps) {
  const store = useOutboxStore.getState;
  // Snapshot so an item that fails with NetworkError is not retried in a tight loop within this run.
  const ready = Object.values(store().items)
    .filter((i) => i.status === 'pending' && i.nextAttemptAt <= now())
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const item of ready) {
    await processItem(item, api, now);
  }
}

async function processItem(item: OutboxItem, api: ApiClient, now: () => number) {
  const { update } = useOutboxStore.getState();
  update(item.id, { status: 'in_flight' });

  try {
    const documentIds = {} as Record<DocKind, string>;
    for (const kind of DOC_KINDS) {
      const { documentId } = await api.uploadDocument(
        item.payload.files[kind],
        kind,
        `${item.idempotencyKey}:${kind}`,
      );
      documentIds[kind] = documentId;
    }
    const { applicationId } = await api.submitApplication(
      { personal: item.payload.personal, documentIds },
      item.idempotencyKey,
    );

    update(item.id, { status: 'done', result: { applicationId }, lastError: undefined, waitingForNetwork: false });
    const draft = useDraftStore.getState().drafts[item.payload.uid];
    if (draft?.outboxItemId === item.id) {
      useDraftStore.getState().setApplicationId(item.payload.uid, applicationId);
    }
  } catch (error) {
    update(item.id, failurePatch(item, error, now()));
  }
}

/** Pure retry policy, exported for tests. */
export function failurePatch(item: OutboxItem, error: unknown, nowMs: number): Partial<OutboxItem> {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof NetworkError) {
    // Waiting for connectivity is not a failed attempt.
    return { status: 'pending', lastError: message, waitingForNetwork: true };
  }
  if (error instanceof ServerError && !error.retryable) {
    return { status: 'failed', lastError: message, waitingForNetwork: false };
  }

  const attempts = item.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    return { status: 'failed', attempts, lastError: message, waitingForNetwork: false };
  }
  return {
    status: 'pending',
    attempts,
    nextAttemptAt: nowMs + BACKOFF_MS[attempts - 1],
    lastError: message,
    waitingForNetwork: false,
  };
}
