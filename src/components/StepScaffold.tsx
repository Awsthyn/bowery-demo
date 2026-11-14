import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, ProgressBar, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { StepIndex } from '@/domain/types';
import { LAST_STEP, STEPS, stepHref } from '@/features/onboarding/steps';
import { useDraftStore } from '@/stores/draftStore';
import { useUid } from '@/stores/sessionStore';

type Props = {
  step: StepIndex;
  subtitle: string;
  canContinue: boolean;
  children: ReactNode;
  /** Replaces the default "go to next step" action (used by Review → Submit). */
  onPrimary?: () => void;
  primaryLabel?: string;
  primaryLoading?: boolean;
};

export function StepScaffold({ step, subtitle, canContinue, children, onPrimary, primaryLabel, primaryLoading }: Props) {
  const uid = useUid();
  const setStep = useDraftStore((s) => s.setStep);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const goNext = () => {
    const next = Math.min(step + 1, LAST_STEP) as StepIndex;
    setStep(uid, next);
    router.push(stepHref(next));
  };

  const goBack = () => {
    const prev = Math.max(step - 1, 0) as StepIndex;
    setStep(uid, prev);
    // After a cold start we land directly on a step, so there may be nothing to pop.
    if (router.canGoBack()) router.back();
    else router.replace(stepHref(prev));
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ProgressBar progress={(step + 1) / STEPS.length} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
          Step {step + 1} of {STEPS.length}
        </Text>
        <Text variant="headlineSmall">{STEPS[step].title}</Text>
        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          {subtitle}
        </Text>
        {children}
      </ScrollView>
      <View
        style={[
          styles.footer,
          { paddingBottom: 12 + insets.bottom, borderTopColor: theme.colors.outlineVariant },
        ]}
      >
        <Button mode="outlined" onPress={goBack} disabled={step === 0} style={styles.flex}>
          Back
        </Button>
        <Button
          mode="contained"
          onPress={onPrimary ?? goNext}
          disabled={!canContinue || primaryLoading}
          loading={primaryLoading}
          style={styles.flex}
          testID="step-primary"
        >
          {primaryLabel ?? 'Next'}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 4 },
  subtitle: { marginBottom: 16 },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
