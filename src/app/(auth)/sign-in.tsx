import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Icon, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { describeAuthError, isGoogleSignInAvailable, signInAsDemo, signInWithGoogle } from '@/lib/firebase/auth';

type Pending = 'google' | 'demo' | null;

export default function SignInScreen() {
  const theme = useTheme();
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (kind: Exclude<Pending, null>, action: () => Promise<unknown>) => async () => {
    setPending(kind);
    setError(null);
    try {
      await action();
      // On success the session store flips and (auth)/_layout redirects; nothing to do here.
    } catch (e) {
      setError(describeAuthError(e));
    } finally {
      setPending(null);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={styles.hero}>
        <View style={[styles.badge, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon source="file-document-check-outline" size={44} color={theme.colors.primary} />
        </View>
        <Text variant="headlineMedium" style={styles.center}>
          Candidate Onboarding
        </Text>
        <Text variant="bodyLarge" style={[styles.center, { color: theme.colors.onSurfaceVariant }]}>
          Upload your ID, a selfie and your signed offer letter to complete your hiring paperwork. Your progress is
          saved on this device as you go.
        </Text>
      </View>

      <View style={styles.actions}>
        {isGoogleSignInAvailable && (
          <Button
            mode="contained"
            icon="google"
            onPress={run('google', signInWithGoogle)}
            loading={pending === 'google'}
            disabled={pending !== null}
            contentStyle={styles.buttonContent}
          >
            Sign in with Google
          </Button>
        )}
        <Button
          mode={isGoogleSignInAvailable ? 'outlined' : 'contained'}
          icon="account-outline"
          onPress={run('demo', signInAsDemo)}
          loading={pending === 'demo'}
          disabled={pending !== null}
          contentStyle={styles.buttonContent}
        >
          Continue as demo user
        </Button>
        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>
        {!isGoogleSignInAvailable && (
          <Text variant="bodySmall" style={[styles.center, { color: theme.colors.onSurfaceVariant }]}>
            Google Sign-In needs the Android build (it is not available in Expo Go).
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  badge: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  actions: { gap: 12 },
  buttonContent: { paddingVertical: 6 },
});
