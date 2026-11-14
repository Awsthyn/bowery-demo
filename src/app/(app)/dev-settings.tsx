import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Divider, List, SegmentedButtons, Switch, Text, useTheme } from 'react-native-paper';

import { MOCK_DB_KEY } from '@/api/MockApiClient';
import type { DevSettings } from '@/domain/types';
import { useDevSettings } from '@/stores/devSettingsStore';
import { useOutboxStore } from '@/stores/outboxStore';

function Choice<T extends string | number>({
  title,
  description,
  value,
  options,
  onChange,
}: {
  title: string;
  description: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.choice}>
      <Text variant="titleMedium">{title}</Text>
      <Text variant="bodySmall" style={styles.desc}>
        {description}
      </Text>
      <SegmentedButtons
        value={String(value)}
        onValueChange={(v) => onChange(options.find((o) => String(o.value) === v)!.value)}
        buttons={options.map((o) => ({ value: String(o.value), label: o.label }))}
      />
    </View>
  );
}

export default function DevSettingsScreen() {
  const theme = useTheme();
  const settings = useDevSettings();
  const items = useOutboxStore((s) => s.items);
  const queryClient = useQueryClient();
  const counts = Object.values(items).reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});

  const setForcedStatus = (forcedStatus: DevSettings['forcedStatus']) => {
    settings.set({ forcedStatus });
    void queryClient.invalidateQueries({ queryKey: ['application-status'] });
  };

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <Text variant="bodyMedium" style={styles.desc}>
        These controls drive the in-app mock backend so you can see how the app behaves on slow, flaky or missing
        networks. They persist across restarts.
      </Text>

      <List.Item
        title="Force offline"
        description="Every API call fails with a network error, as in airplane mode."
        right={() => (
          <Switch
            value={settings.forceOffline}
            onValueChange={(forceOffline) => settings.set({ forceOffline })}
            testID="force-offline"
          />
        )}
      />
      <Divider />

      <Choice
        title="Latency"
        description="Delay added to every API call."
        value={settings.latencyMs}
        options={[
          { value: 0, label: '0 ms' },
          { value: 800, label: '800 ms' },
          { value: 3000, label: '3 s' },
        ]}
        onChange={(latencyMs) => settings.set({ latencyMs })}
      />
      <Choice
        title="Failure rate"
        description="Share of calls that return HTTP 503. Retried with 1/2/4/8 s backoff, 5 attempts max."
        value={settings.failRate}
        options={[
          { value: 0, label: '0%' },
          { value: 0.3, label: '30%' },
          { value: 1, label: '100%' },
        ]}
        onChange={(failRate) => settings.set({ failRate })}
      />
      <Choice
        title="Application decision"
        description="What the reviewer decides for submitted applications."
        value={settings.forcedStatus}
        options={[
          { value: 'none', label: 'In review' },
          { value: 'approved', label: 'Approve' },
          { value: 'rejected', label: 'Reject' },
        ]}
        onChange={setForcedStatus}
      />

      <Divider />
      <List.Item
        title="Outbox"
        description={
          Object.keys(counts).length
            ? Object.entries(counts)
                .map(([k, v]) => `${v} ${k}`)
                .join(' · ')
            : 'Empty'
        }
        left={(p) => <List.Icon {...p} icon="tray-full" />}
      />
      <View style={styles.buttons}>
        <Button mode="outlined" onPress={settings.reset}>
          Reset settings
        </Button>
        <Button
          mode="outlined"
          textColor={theme.colors.error}
          onPress={async () => {
            await AsyncStorage.removeItem(MOCK_DB_KEY);
            void queryClient.invalidateQueries();
          }}
        >
          Wipe mock server
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  choice: { paddingVertical: 12, gap: 6 },
  desc: { opacity: 0.7 },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 8 },
});
