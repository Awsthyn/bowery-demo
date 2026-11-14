import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import type { DocKind, LocalFile } from '@/domain/types';
import { deleteLocalFile, persistImage, persistPdf } from '@/lib/files';
import { useDraftStore } from '@/stores/draftStore';

import { pdfFileSchema } from './schemas';

/** Thrown for problems the user can fix (permissions, wrong file); the message is shown as-is. */
export class PickError extends Error {}

export type ImageSource = 'camera' | 'library';

/** Saves the new file into the draft and deletes the one it replaces. */
function commit(uid: string, kind: DocKind, file: LocalFile) {
  const previous = useDraftStore.getState().drafts[uid]?.files[kind];
  useDraftStore.getState().setFile(uid, kind, file);
  if (previous && previous.uri !== file.uri) deleteLocalFile(previous);
  return file;
}

/** Returns null when the user cancels. */
export async function pickImage(uid: string, kind: DocKind, source: ImageSource): Promise<LocalFile | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new PickError('Camera permission is needed to take a photo.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 1 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;

  const asset = result.assets[0];
  return commit(uid, kind, await persistImage(uid, kind, asset, source));
}

export async function storeCapturedImage(
  uid: string,
  kind: DocKind,
  photo: { uri: string; width: number; height: number },
): Promise<LocalFile> {
  return commit(uid, kind, await persistImage(uid, kind, photo, 'camera'));
}

export async function pickOfferLetter(uid: string): Promise<LocalFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];

  // Validate before copying: some providers ignore the type filter, and 10 MB is the backend limit.
  const check = pdfFileSchema.safeParse({
    uri: asset.uri,
    mimeType: asset.mimeType ?? (asset.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'unknown'),
    name: asset.name,
    sizeBytes: asset.size ?? 0,
    source: 'document',
  });
  if (!check.success) throw new PickError(check.error.issues[0]?.message ?? 'Invalid file');

  return commit(uid, 'offerLetter', await persistPdf(uid, asset));
}
