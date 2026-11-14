import type { LocalFile } from '@/domain/types';
import {
  MAX_PDF_BYTES,
  ageOn,
  offerLetterSchema,
  personalSchema,
  submissionSchema,
} from '@/features/onboarding/schemas';

const valid = {
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+44 20 7946 0958',
  dateOfBirth: '1990-12-10',
  nationality: 'British',
  documentNumber: 'AB-123456',
};

const jpeg = (name: string): LocalFile => ({
  uri: `file:///docs/${name}.jpg`,
  mimeType: 'image/jpeg',
  name,
  sizeBytes: 200_000,
  source: 'camera',
});
const pdf = (sizeBytes: number): LocalFile => ({
  uri: 'file:///docs/offer.pdf',
  mimeType: 'application/pdf',
  name: 'offer.pdf',
  sizeBytes,
  source: 'document',
});

const firstMessage = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.error?.issues[0]?.message;

describe('onboarding schemas', () => {
  // protects=a complete, well-formed personal step enables Next; fails_when=a valid record is rejected; no_claim=nothing about UI wiring
  it('accepts a complete personal record', () => {
    expect(personalSchema.safeParse(valid).success).toBe(true);
  });

  // protects=email field error text; fails_when=malformed email passes; no_claim=deliverability of the address
  it('rejects an invalid email with a readable message', () => {
    const r = personalSchema.safeParse({ ...valid, email: 'ada@' });
    expect(r.success).toBe(false);
    expect(firstMessage(r)).toBe('Enter a valid email');
  });

  // protects=AC5 under-18 message; fails_when=someone who turns 18 tomorrow passes; no_claim=time zones (uses device local date)
  it('rejects candidates younger than 18, to the day', () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const turns18Tomorrow = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate() + 1);
    const iso = `${turns18Tomorrow.getFullYear()}-${pad(turns18Tomorrow.getMonth() + 1)}-${pad(turns18Tomorrow.getDate())}`;

    expect(ageOn(iso)).toBe(17);
    const r = personalSchema.safeParse({ ...valid, dateOfBirth: iso });
    expect(r.success).toBe(false);
    expect(firstMessage(r)).toBe('You must be at least 18');
  });

  // protects=Review refuses to submit with a missing document; fails_when=submission without selfie validates; no_claim=file still exists on disk
  it('requires every document before submission', () => {
    const files = { idFront: jpeg('front'), idBack: jpeg('back'), offerLetter: pdf(1000) };
    expect(submissionSchema.safeParse({ personal: valid, files }).success).toBe(false);
    expect(submissionSchema.safeParse({ personal: valid, files: { ...files, selfie: jpeg('selfie') } }).success).toBe(true);
  });

  // protects=AC6 10 MB limit message; fails_when=an 10 MB + 1 byte PDF passes or exactly 10 MB fails; no_claim=picker-level filtering
  it('limits the offer letter to 10 MB', () => {
    expect(offerLetterSchema.safeParse({ offerLetter: pdf(MAX_PDF_BYTES) }).success).toBe(true);
    const r = offerLetterSchema.safeParse({ offerLetter: pdf(MAX_PDF_BYTES + 1) });
    expect(firstMessage(r)).toBe('File must be 10 MB or smaller');
  });

  // protects=AC6 non-PDF rejection; fails_when=a JPEG is accepted as the offer letter; no_claim=content sniffing (mime type only)
  it('rejects a non-PDF offer letter', () => {
    const r = offerLetterSchema.safeParse({ offerLetter: { ...jpeg('scan'), source: 'document' } });
    expect(r.success).toBe(false);
    expect(firstMessage(r)).toBe('File must be a PDF');
  });
});
