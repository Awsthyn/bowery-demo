import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';

import { PERSIST_DEBOUNCE_MS, usePersonalForm } from '@/features/onboarding/usePersonalForm';
import { useDraftStore } from '@/stores/draftStore';

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  useDraftStore.setState({ drafts: {} });
});

afterEach(() => jest.useRealTimers());

// protects=AC3 typed values survive leaving the screen and are written to AsyncStorage;
// fails_when=a value typed in the form is not in the persisted draft or not restored on remount;
// no_claim=a real app kill; AsyncStorage is the jest mock and the hook is rendered without the screen UI
it('persists typed values and restores them on remount', async () => {
  const first = await renderHook(() => usePersonalForm('u1'));
  await act(async () => {
    first.result.current.setValue('fullName', 'Ada Lovelace');
    jest.advanceTimersByTime(PERSIST_DEBOUNCE_MS);
  });

  expect(await AsyncStorage.getItem('draft-v1')).toContain('Ada Lovelace');

  await act(async () => {
    first.result.current.setValue('email', 'ada@example.com');
  });
  await first.unmount(); // flushes the pending debounce
  expect(useDraftStore.getState().drafts.u1.personal.email).toBe('ada@example.com');

  const second = await renderHook(() => usePersonalForm('u1'));
  expect(second.result.current.getValues()).toMatchObject({ fullName: 'Ada Lovelace', email: 'ada@example.com' });
});
