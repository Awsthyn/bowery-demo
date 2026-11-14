import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { PersonalInfo } from '@/domain/types';
import { useDraftStore } from '@/stores/draftStore';

import { type PersonalForm, personalSchema } from './schemas';

export const PERSIST_DEBOUNCE_MS = 300;

const EMPTY: PersonalForm = {
  fullName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  nationality: '',
  documentNumber: '',
};

/**
 * react-hook-form bound to the persisted draft. Every keystroke is saved (debounced 300 ms),
 * so killing the app mid-field loses at most the last 300 ms of typing.
 */
export function usePersonalForm(uid: string) {
  // Read once: the form owns the values while mounted, the store is the durable copy.
  const [initial] = useState<PersonalForm>(() => ({ ...EMPTY, ...useDraftStore.getState().drafts[uid]?.personal }));

  const form = useForm<PersonalForm>({
    resolver: zodResolver(personalSchema),
    mode: 'onChange',
    defaultValues: initial,
  });

  const { subscribe, trigger } = form;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let latest: Partial<PersonalInfo> | undefined;

    const flush = () => {
      clearTimeout(timer);
      if (latest) useDraftStore.getState().patchPersonal(uid, latest);
      latest = undefined;
    };

    // subscribe() listens to value changes without re-rendering the form (and is React Compiler safe, unlike watch()).
    const unsubscribe = subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        latest = { ...values } as Partial<PersonalInfo>;
        clearTimeout(timer);
        timer = setTimeout(flush, PERSIST_DEBOUNCE_MS);
      },
    });

    // Restored drafts should show their errors right away instead of a silently disabled Next.
    if (Object.values(initial).some(Boolean)) void trigger();

    return () => {
      unsubscribe();
      flush();
    };
  }, [subscribe, trigger, uid, initial]);

  return form;
}
