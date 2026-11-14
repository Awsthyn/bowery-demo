import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Icon, List, Text, useTheme } from 'react-native-paper';

import { formatBytes } from '@/components/DocumentSlot';
import { StepScaffold } from '@/components/StepScaffold';
import type { StepIndex, SubmitPayload } from '@/domain/types';
import { submissionSchema } from '@/features/onboarding/schemas';
import { stepHref } from '@/features/onboarding/steps';
import { kick } from '@/outbox/useOutboxTriggers';
import { useDraft, useDraftStore } from '@/stores/draftStore';
import { useOutboxStore } from '@/stores/outboxStore';
import { useUid } from '@/stores/sessionStore';

function Section({ title, step, children }: { title: string; step: StepIndex; children: React.ReactNode }) {
  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Title
        title={title}
        right={() => (
          <Button compact onPress={() => router.push(stepHref(step))}>
            Edit
          </Button>
        )}
      />
      <Card.Content>{children}</Card.Content>
    </Card>
  );
}

export default function ReviewStep() {
  const uid = useUid();
  const draft = useDraft(uid);
  const theme = useTheme();
  const parsed = submissionSchema.safeParse({ personal: draft.personal, files: draft.files });
  const { personal, files } = draft;

  const submit = () => {
    if (!parsed.success) return;
    const payload: SubmitPayload = { uid, ...parsed.data };
    const item = useOutboxStore.getState().enqueue(payload);
    useDraftStore.getState().markSubmitted(uid, item.id);
    kick();
    router.replace('/status');
  };

  const thumb = (uri?: string) =>
    uri ? (
      <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
    ) : (
      <View style={[styles.thumb, { backgroundColor: theme.colors.errorContainer }]} />
    );

  return (
    <StepScaffold
      step={4}
      subtitle="Check everything before sending. You can submit offline: it will be sent when you reconnect."
      canContinue={parsed.success}
      onPrimary={submit}
      primaryLabel="Submit"
    >
      <Section title="Personal info" step={0}>
        <List.Item title={personal.fullName || '—'} description="Full name" />
        <List.Item title={personal.email || '—'} description="Email" />
        <List.Item title={personal.phone || '—'} description="Phone" />
        <List.Item title={personal.dateOfBirth || '—'} description="Date of birth" />
        <List.Item title={personal.nationality || '—'} description="Nationality" />
        <List.Item title={personal.documentNumber || '—'} description="ID number" />
      </Section>

      <Section title="ID document" step={1}>
        <View style={styles.row}>
          {thumb(files.idFront?.uri)}
          {thumb(files.idBack?.uri)}
        </View>
      </Section>

      <Section title="Selfie" step={2}>
        {thumb(files.selfie?.uri)}
      </Section>

      <Section title="Signed offer letter" step={3}>
        {files.offerLetter ? (
          <View style={styles.pdf}>
            <Icon source="file-pdf-box" size={32} color={theme.colors.primary} />
            <View style={styles.flex}>
              <Text numberOfLines={1}>{files.offerLetter.name}</Text>
              <Text variant="bodySmall">{formatBytes(files.offerLetter.sizeBytes)}</Text>
            </View>
          </View>
        ) : (
          <Text>—</Text>
        )}
      </Section>

      <HelperText type="error" visible={!parsed.success}>
        Some information is missing or invalid. Use Edit to fix it.
      </HelperText>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  thumb: { width: 120, height: 80, borderRadius: 8 },
  pdf: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
});
