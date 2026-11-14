import { DocumentSlot } from '@/components/DocumentSlot';
import { StepScaffold } from '@/components/StepScaffold';
import type { DocKind } from '@/domain/types';
import { pickImage } from '@/features/onboarding/pickers';
import { idDocumentSchema } from '@/features/onboarding/schemas';
import { useDraft } from '@/stores/draftStore';
import { useUid } from '@/stores/sessionStore';

export default function IdDocumentStep() {
  const uid = useUid();
  const { files } = useDraft(uid);

  const actions = (kind: DocKind) => [
    { label: 'Take photo', icon: 'camera', run: () => pickImage(uid, kind, 'camera') },
    { label: 'Library', icon: 'image', run: () => pickImage(uid, kind, 'library') },
  ];

  return (
    <StepScaffold
      step={1}
      subtitle="Photograph both sides on a flat, well-lit surface. All four corners must be visible."
      canContinue={idDocumentSchema.safeParse(files).success}
    >
      <DocumentSlot title="Front" hint="Side with your photo" file={files.idFront} actions={actions('idFront')} />
      <DocumentSlot title="Back" hint="Side with the barcode or address" file={files.idBack} actions={actions('idBack')} />
    </StepScaffold>
  );
}
