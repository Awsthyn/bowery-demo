import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/stores/sessionStore';

export default function AuthLayout() {
  const user = useSession((s) => s.user);
  if (user) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
