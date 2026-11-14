import { useState } from 'react';

import { DocumentSlot } from '@/components/DocumentSlot';
import { SelfieCamera } from '@/components/SelfieCamera';
import { StepScaffold } from '@/components/StepScaffold';
import { storeCapturedImage } from '@/features/onboarding/pickers';
import { selfieSchema } from '@/features/onboarding/schemas';
import { useDraft } from '@/stores/draftStore';
import { useUid } from '@/stores/sessionStore';

export default function SelfieStep() {
  const uid = useUid();
  const { files } = useDraft(uid);
  const [cameraOpen, setCameraOpen] = useState(false);

  return (
    <StepScaffold
      step={2}
      subtitle="We compare it with your ID photo. Remove glasses and hats, and face the light."
      canContinue={selfieSchema.safeParse(files).success}
    >
      <DocumentSlot
        title="Selfie"
        hint="Front camera, face centred"
        file={files.selfie}
        portrait
        actions={[{ label: files.selfie ? 'Retake' : 'Take selfie', icon: 'camera-front', run: async () => setCameraOpen(true) }]}
      />
      <SelfieCamera
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={async (photo) => {
          await storeCapturedImage(uid, 'selfie', photo);
        }}
      />
    </StepScaffold>
  );
}
