import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import PersonalStep from '@/app/(app)/onboarding/personal';
import { useDraftStore } from '@/stores/draftStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));
jest.mock('expo-router/react-navigation', () => ({ useHeaderHeight: () => 0 }));
jest.mock('@/stores/sessionStore', () => ({ useUid: () => 'u1' }));

const VALID = {
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+44 20 7946 0958',
  dateOfBirth: '1990-12-10',
  nationality: 'British',
  documentNumber: '30123456',
};

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

async function renderStep() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PaperProvider>
        <PersonalStep />
      </PaperProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useDraftStore.setState({ drafts: {} });
});

// protects=keyboard "done" on the last field advances to the ID step when the form is valid, and records the step for resume;
// fails_when=submitting from the keyboard does nothing, or navigates with invalid data;
// no_claim=native focus movement between fields (setFocus on a real TextInput) is not observable here; expo-router and the session are mocked
describe('Personal step keyboard flow', () => {
  it('goes to the next step from the last field when the form is valid', async () => {
    useDraftStore.setState({
      drafts: { u1: { uid: 'u1', currentStep: 0, personal: VALID, files: {}, updatedAt: '' } },
    });
    await renderStep();

    await act(async () => {
      fireEvent(screen.getByTestId('field-documentNumber'), 'submitEditing');
    });

    expect(router.push).toHaveBeenCalledWith('/onboarding/id-document');
    expect(useDraftStore.getState().drafts.u1.currentStep).toBe(1);
  });

  it('stays on the step and shows errors when the form is invalid', async () => {
    useDraftStore.setState({
      drafts: { u1: { uid: 'u1', currentStep: 0, personal: { ...VALID, email: 'ada@' }, files: {}, updatedAt: '' } },
    });
    await renderStep();

    await act(async () => {
      fireEvent(screen.getByTestId('field-documentNumber'), 'submitEditing');
    });

    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a valid email')).toBeTruthy();
  });
});
