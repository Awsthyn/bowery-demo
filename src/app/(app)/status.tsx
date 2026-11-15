import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Icon, Text, useTheme } from 'react-native-paper';

import { api } from '@/api';
import type { OutboxItem } from '@/domain/types';
import { secondsUntil, useNow } from '@/lib/useNow';
import { MAX_ATTEMPTS } from '@/outbox/processor';
import { kick } from '@/outbox/useOutboxTriggers';
import { useDraft, useDraftStore } from '@/stores/draftStore';
import { useOutboxStore } from '@/stores/outboxStore';
import { useUid } from '@/stores/sessionStore';

type Banner = { icon: string; title: string; body: string; tone: 'info' | 'error' | 'success' };

function outboxBanner(item: OutboxItem, now: number): Banner {
  switch (item.status) {
    case 'in_flight':
      return { icon: 'cloud-upload-outline', title: 'Sending…', body: 'Uploading your documents.', tone: 'info' };
    case 'failed':
      return {
        icon: 'alert-circle-outline',
        title: 'Could not send',
        body: `${item.lastError ?? 'Unknown error'}${item.attempts ? ` (after ${item.attempts} attempts)` : ''}`,
        tone: 'error',
      };
    case 'pending':
      if (item.waitingForNetwork) {
        return {
          icon: 'wifi-off',
          title: 'Waiting for connection',
          body: 'Your application is saved on this device and will be sent automatically when you are back online.',
          tone: 'info',
        };
      }
      if (item.attempts > 0) {
        const secs = secondsUntil(item.nextAttemptAt, now);
        return {
          icon: 'timer-sand',
          title: `Retrying in ${secs}s`,
          body: `Attempt ${item.attempts + 1} of ${MAX_ATTEMPTS}. Last error: ${item.lastError}`,
          tone: 'info',
        };
      }
      return { icon: 'clock-outline', title: 'Queued', body: 'About to send…', tone: 'info' };
    case 'done':
      return { icon: 'check', title: 'Sent', body: '', tone: 'success' };
  }
}

const SERVER_COPY = {
  in_review: { icon: 'progress-clock', title: 'In review', body: 'We received your documents. This usually takes 1-2 business days.' },
  approved: { icon: 'check-decagram', title: 'Approved', body: 'You are all set. Welcome aboard!' },
  rejected: { icon: 'close-octagon-outline', title: 'Action needed', body: '' },
} as const;

export default function StatusScreen() {
  const uid = useUid();
  const theme = useTheme();
  const draft = useDraft(uid);
  const item = useOutboxStore((s) => (draft.outboxItemId ? s.items[draft.outboxItemId] : undefined));
  const applicationId = draft.applicationId;

  // Keep ticking through the whole retry cycle (pending → in_flight → pending) so the clock is never stale.
  const now = useNow(item?.status === 'pending' || item?.status === 'in_flight');

  const status = useQuery({
    queryKey: ['application-status', applicationId],
    queryFn: () => api.getApplicationStatus(applicationId!),
    enabled: !!applicationId,
    refetchInterval: (q) => (q.state.data?.status === 'in_review' ? 5_000 : false),
  });

  const fixId = () => {
    useDraftStore.getState().reopen(uid, 1);
    router.replace('/onboarding/id-document');
  };

  const toneColor = (tone: Banner['tone']) =>
    tone === 'error' ? theme.colors.error : tone === 'success' ? theme.colors.primary : theme.colors.onSurfaceVariant;

  let content: React.ReactNode;
  if (applicationId) {
    if (status.isPending) {
      content = <ActivityIndicator style={styles.loader} />;
    } else if (status.isError) {
      content = (
        <StatusCard icon="cloud-alert" color={theme.colors.error} title="Could not load status" body={String(status.error.message)}>
          <Button onPress={() => status.refetch()}>Try again</Button>
        </StatusCard>
      );
    } else {
      const copy = SERVER_COPY[status.data.status];
      content = (
        <StatusCard
          icon={copy.icon}
          color={status.data.status === 'rejected' ? theme.colors.error : theme.colors.primary}
          title={copy.title}
          body={status.data.rejectionReason ?? copy.body}
        >
          {status.data.status === 'rejected' && (
            <Button mode="contained" icon="card-account-details-outline" onPress={fixId}>
              Fix ID document
            </Button>
          )}
        </StatusCard>
      );
    }
  } else if (item) {
    const banner = outboxBanner(item, now);
    content = (
      <StatusCard icon={banner.icon} color={toneColor(banner.tone)} title={banner.title} body={banner.body}>
        {item.status === 'failed' && (
          <Button
            mode="contained"
            icon="refresh"
            onPress={() => {
              useOutboxStore.getState().retry(item.id);
              kick();
            }}
          >
            Retry
          </Button>
        )}
      </StatusCard>
    );
  } else {
    content = (
      <StatusCard icon="file-question-outline" color={theme.colors.onSurfaceVariant} title="Nothing submitted yet" body="">
        <Button mode="contained" onPress={() => router.replace('/')}>
          Go to onboarding
        </Button>
      </StatusCard>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={{ backgroundColor: theme.colors.background }}>
      {content}
      {applicationId && (
        <Text variant="bodySmall" style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
          Application {applicationId}
          {status.data?.status === 'in_review' ? ' · refreshing every 5s' : ''}
        </Text>
      )}
    </ScrollView>
  );
}

function StatusCard({
  icon,
  color,
  title,
  body,
  children,
}: {
  icon: string;
  color: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <Card mode="contained">
      <Card.Content style={styles.card}>
        <Icon source={icon} size={56} color={color} />
        <Text variant="headlineSmall" testID="status-title">
          {title}
        </Text>
        {!!body && (
          <Text variant="bodyMedium" style={styles.center}>
            {body}
          </Text>
        )}
        {children && <View style={styles.actions}>{children}</View>}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 },
  card: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  center: { textAlign: 'center' },
  actions: { marginTop: 8, alignSelf: 'stretch' },
  loader: { marginTop: 48 },
  meta: { textAlign: 'center' },
});
