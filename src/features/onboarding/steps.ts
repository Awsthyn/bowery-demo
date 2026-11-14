import type { StepIndex } from '@/domain/types';

export const STEPS = [
  { title: 'Personal info', href: '/onboarding/personal' },
  { title: 'ID document', href: '/onboarding/id-document' },
  { title: 'Selfie', href: '/onboarding/selfie' },
  { title: 'Signed offer letter', href: '/onboarding/offer-letter' },
  { title: 'Review & submit', href: '/onboarding/review' },
] as const;

export const LAST_STEP = (STEPS.length - 1) as StepIndex;

export const stepHref = (step: StepIndex) => STEPS[step].href;
