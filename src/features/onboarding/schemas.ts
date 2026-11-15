import { z } from 'zod';

import { fromIsoDate } from '@/lib/dates';

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MIN_AGE = 18;
/** Lower bound for the date picker; not a validation rule. */
export const MAX_AGE = 100;

/** Whole years between an ISO date (yyyy-mm-dd) and `today`. */
export function ageOn(dateOfBirth: string, today = new Date()): number {
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  let age = today.getFullYear() - y;
  const beforeBirthday = today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

const isRealDate = (value: string) => fromIsoDate(value) !== null;

export const personalSchema = z.object({
  fullName: z.string().trim().min(3, 'Enter your full name'),
  email: z.email('Enter a valid email'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number'),
  dateOfBirth: z
    .string()
    .min(1, 'Select your date of birth')
    .refine(isRealDate, 'Select a valid date')
    .refine((v) => !isRealDate(v) || ageOn(v) >= MIN_AGE, `You must be at least ${MIN_AGE}`),
  nationality: z.string().trim().min(2, 'Enter your nationality'),
  documentNumber: z
    .string()
    .trim()
    .regex(/^\d{6,12}$/, 'Use 6-12 digits, no letters or symbols'),
});

const localFileSchema = z.object({
  uri: z.string().min(1),
  mimeType: z.enum(['image/jpeg', 'application/pdf']),
  name: z.string(),
  sizeBytes: z.number().nonnegative(),
  source: z.enum(['camera', 'library', 'document']),
});

const imageFile = localFileSchema.extend({ mimeType: z.literal('image/jpeg') });

export const idDocumentSchema = z.object({
  idFront: imageFile,
  idBack: imageFile,
});

export const selfieSchema = z.object({ selfie: imageFile });

export const pdfFileSchema = localFileSchema.extend({
  mimeType: z.literal('application/pdf', { error: 'File must be a PDF' }),
  sizeBytes: z.number().max(MAX_PDF_BYTES, 'File must be 10 MB or smaller'),
});

export const offerLetterSchema = z.object({ offerLetter: pdfFileSchema });

export const submissionSchema = z.object({
  personal: personalSchema,
  files: idDocumentSchema.extend(selfieSchema.shape).extend(offerLetterSchema.shape),
});

export type PersonalForm = z.infer<typeof personalSchema>;
