export const DOC_KINDS = ['idFront', 'idBack', 'selfie', 'offerLetter'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export type LocalFile = {
  /** Always inside Paths.document, so it survives app restarts and cache purges. */
  uri: string;
  mimeType: 'image/jpeg' | 'application/pdf';
  name: string;
  sizeBytes: number;
  source: 'camera' | 'library' | 'document';
};

export type PersonalInfo = {
  fullName: string;
  email: string;
  phone: string;
  /** ISO yyyy-mm-dd, age >= 18 */
  dateOfBirth: string;
  nationality: string;
  documentNumber: string;
};

export type StepIndex = 0 | 1 | 2 | 3 | 4;

export type Draft = {
  uid: string;
  currentStep: StepIndex;
  personal: Partial<PersonalInfo>;
  files: Partial<Record<DocKind, LocalFile>>;
  applicationId?: string;
  /** Outbox item currently carrying this draft's submission, if any. */
  outboxItemId?: string;
  updatedAt: string;
};

export type SubmitPayload = {
  uid: string;
  personal: PersonalInfo;
  files: Record<DocKind, LocalFile>;
};

export type OutboxStatus = 'pending' | 'in_flight' | 'failed' | 'done';

export type OutboxItem = {
  id: string;
  idempotencyKey: string;
  kind: 'submitApplication';
  payload: SubmitPayload;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
  /** Last attempt failed because the device was offline; the item resumes on reconnect. */
  waitingForNetwork?: boolean;
  result?: { applicationId: string };
  createdAt: number;
};

export type ApplicationStatus = 'in_review' | 'approved' | 'rejected';

export type DevSettings = {
  latencyMs: number;
  failRate: number;
  forceOffline: boolean;
  forcedStatus: 'none' | 'approved' | 'rejected';
};
