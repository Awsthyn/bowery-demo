import { Redirect, Stack, router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { IconButton, Menu, useTheme } from 'react-native-paper';

import { deleteUserFiles } from '@/lib/files';
import { signOut } from '@/lib/firebase/auth';
import { useDraftStore } from '@/stores/draftStore';
import { useOutboxStore } from '@/stores/outboxStore';
import { useSession } from '@/stores/sessionStore';

function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const user = useSession((s) => s.user);

  const doSignOut = async () => {
    if (user?.isAnonymous) {
      // The anonymous uid is gone for good after sign-out, so its local data is unreachable: clean it up.
      useDraftStore.getState().clear(user.uid);
      useOutboxStore.getState().removeForUser(user.uid);
      deleteUserFiles(user.uid);
    }
    await signOut();
  };

  const confirmSignOut = () => {
    setOpen(false);
    if (!user?.isAnonymous) return void doSignOut();
    Alert.alert('Sign out?', 'Your demo progress will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void doSignOut() },
    ]);
  };

  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      anchor={<IconButton icon="dots-vertical" onPress={() => setOpen(true)} accessibilityLabel="Menu" />}
    >
      <Menu.Item
        leadingIcon="tune-variant"
        title="Dev settings"
        onPress={() => {
          setOpen(false);
          router.push('/dev-settings');
        }}
      />
      <Menu.Item leadingIcon="logout" title="Sign out" onPress={confirmSignOut} />
    </Menu>
  );
}

export default function AppLayout() {
  const user = useSession((s) => s.user);
  const theme = useTheme();
  if (!user) return <Redirect href="/sign-in" />;

  return (
    <Stack
      screenOptions={{
        headerRight: () => <HeaderMenu />,
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/personal" options={{ title: 'Onboarding' }} />
      <Stack.Screen name="onboarding/id-document" options={{ title: 'Onboarding' }} />
      <Stack.Screen name="onboarding/selfie" options={{ title: 'Onboarding' }} />
      <Stack.Screen name="onboarding/offer-letter" options={{ title: 'Onboarding' }} />
      <Stack.Screen name="onboarding/review" options={{ title: 'Onboarding' }} />
      <Stack.Screen name="status" options={{ title: 'Application status', headerBackVisible: false }} />
      <Stack.Screen name="dev-settings" options={{ title: 'Dev settings', headerRight: () => null }} />
    </Stack>
  );
}
