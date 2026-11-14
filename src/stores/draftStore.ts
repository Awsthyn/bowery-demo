import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DocKind, Draft, LocalFile, PersonalInfo, StepIndex } from '@/domain/types';
import { persistStorage } from '@/lib/storage';

type DraftState = {
  drafts: Record<string, Draft>;
  patchPersonal: (uid: string, personal: Partial<PersonalInfo>) => void;
  setFile: (uid: string, kind: DocKind, file: LocalFile | undefined) => void;
  setStep: (uid: string, step: StepIndex) => void;
  markSubmitted: (uid: string, outboxItemId: string) => void;
  setApplicationId: (uid: string, applicationId: string) => void;
  /** Rejected application: keep the data, drop the submission so the user can fix and resubmit. */
  reopen: (uid: string, step: StepIndex) => void;
  clear: (uid: string) => void;
};

export const emptyDraft = (uid: string): Draft => ({
  uid,
  currentStep: 0,
  personal: {},
  files: {},
  updatedAt: new Date().toISOString(),
});

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => {
      const update = (uid: string, fn: (d: Draft) => Partial<Draft>) =>
        set((s) => {
          const current = s.drafts[uid] ?? emptyDraft(uid);
          return {
            drafts: {
              ...s.drafts,
              [uid]: { ...current, ...fn(current), updatedAt: new Date().toISOString() },
            },
          };
        });

      return {
        drafts: {},
        patchPersonal: (uid, personal) => update(uid, (d) => ({ personal: { ...d.personal, ...personal } })),
        setFile: (uid, kind, file) => update(uid, (d) => ({ files: { ...d.files, [kind]: file } })),
        setStep: (uid, step) => update(uid, () => ({ currentStep: step })),
        markSubmitted: (uid, outboxItemId) =>
          update(uid, () => ({ outboxItemId, applicationId: undefined })),
        setApplicationId: (uid, applicationId) => update(uid, () => ({ applicationId })),
        reopen: (uid, step) =>
          update(uid, () => ({ outboxItemId: undefined, applicationId: undefined, currentStep: step })),
        clear: (uid) =>
          set((s) => {
            const { [uid]: _removed, ...rest } = s.drafts;
            return { drafts: rest };
          }),
      };
    },
    { name: 'draft-v1', version: 1, storage: persistStorage },
  ),
);

export const useDraft = (uid: string): Draft =>
  useDraftStore((s) => s.drafts[uid]) ?? emptyDraft(uid);
