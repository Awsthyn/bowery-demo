import { Redirect } from 'expo-router';

import { stepHref } from '@/features/onboarding/steps';
import { useDraft } from '@/stores/draftStore';
import { useUid } from '@/stores/sessionStore';

/** Resume point: submitted drafts go to status, everything else to the step the user left. */
export default function Index() {
  const draft = useDraft(useUid());
  if (draft.outboxItemId || draft.applicationId) return <Redirect href="/status" />;
  return <Redirect href={stepHref(draft.currentStep)} />;
}
