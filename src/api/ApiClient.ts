import type { ApplicationStatus, DocKind, LocalFile, PersonalInfo } from '@/domain/types';

/** The device could not reach the server. Retryable once connectivity returns; does not consume attempts. */
export class NetworkError extends Error {
  constructor(message = 'Network unavailable') {
    super(message);
    this.name = 'NetworkError';
  }
}

/** The server answered with an error status. 5xx is retryable with backoff, 4xx is final. */
export class ServerError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ServerError';
  }

  get retryable() {
    return this.status >= 500;
  }
}

export type SubmitApplicationInput = {
  personal: PersonalInfo;
  documentIds: Record<DocKind, string>;
};

export type ApplicationStatusResponse = {
  status: ApplicationStatus;
  rejectionReason?: string;
  updatedAt: string;
};

export interface ApiClient {
  uploadDocument(file: LocalFile, kind: DocKind, idempotencyKey: string): Promise<{ documentId: string }>;
  submitApplication(
    input: SubmitApplicationInput,
    idempotencyKey: string,
  ): Promise<{ applicationId: string; status: 'in_review' }>;
  getApplicationStatus(applicationId: string): Promise<ApplicationStatusResponse>;
}
