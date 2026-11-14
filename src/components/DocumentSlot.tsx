import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, HelperText, Icon, Text, useTheme } from 'react-native-paper';

import type { LocalFile } from '@/domain/types';
import { PickError } from '@/features/onboarding/pickers';

export type SlotAction = {
  label: string;
  icon: string;
  run: () => Promise<unknown>;
};

type Props = {
  title: string;
  hint: string;
  file?: LocalFile;
  actions: SlotAction[];
  /** Taller preview for portrait shots (selfie). */
  portrait?: boolean;
};

export const formatBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export function DocumentSlot({ title, hint, file, actions, portrait }: Props) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = (action: SlotAction) => async () => {
    setBusy(true);
    setError(null);
    try {
      await action.run();
    } catch (e) {
      setError(e instanceof PickError ? e.message : 'Something went wrong. Please try again.');
      if (!(e instanceof PickError)) console.warn(e);
    } finally {
      setBusy(false);
    }
  };

  const previewHeight = portrait ? 260 : 180;

  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Title
        title={title}
        subtitle={hint}
        subtitleNumberOfLines={2}
        right={() =>
          file ? <Icon source="check-circle" size={22} color={theme.colors.primary} /> : null
        }
        rightStyle={styles.right}
      />
      <Card.Content>
        <View
          style={[styles.preview, { height: previewHeight, backgroundColor: theme.colors.surfaceVariant }]}
        >
          {busy ? (
            <ActivityIndicator />
          ) : file?.mimeType === 'image/jpeg' ? (
            <Image source={{ uri: file.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : file ? (
            <View style={styles.pdf}>
              <Icon source="file-pdf-box" size={48} color={theme.colors.primary} />
              <Text variant="titleSmall" numberOfLines={1}>
                {file.name}
              </Text>
              <Text variant="bodySmall">{formatBytes(file.sizeBytes)}</Text>
            </View>
          ) : (
            <Icon source="image-plus" size={40} color={theme.colors.onSurfaceVariant} />
          )}
        </View>
        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>
      </Card.Content>
      <Card.Actions>
        {actions.map((a) => (
          <Button key={a.label} icon={a.icon} onPress={handle(a)} disabled={busy}>
            {a.label}
          </Button>
        ))}
      </Card.Actions>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 16 },
  right: { marginRight: 16 },
  preview: { borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pdf: { alignItems: 'center', gap: 4, paddingHorizontal: 16 },
});
