import { DocumentSlot } from '@/components/DocumentSlot';
import { StepScaffold } from '@/components/StepScaffold';
import { pickOfferLetter } from '@/features/onboarding/pickers';
import { offerLetterSchema } from '@/features/onboarding/schemas';
import { useDraft } from '@/stores/draftStore';
import { useUid } from '@/stores/sessionStore';

export default function OfferLetterStep() {
  const uid = useUid();
  const { files } = useDraft(uid);

  return (
    <StepScaffold
      step={3}
      subtitle="Upload the offer letter you signed, as a PDF up to 10 MB."
      canContinue={offerLetterSchema.safeParse(files).success}
    >
      <DocumentSlot
        title="Signed offer letter"
        hint="PDF only"
        file={files.offerLetter}
        actions={[{ label: 'Choose PDF', icon: 'file-upload-outline', run: () => pickOfferLetter(uid) }]}
      />
    </StepScaffold>
  );
}
