import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { DocKind, LocalFile } from '@/domain/types';

export const MAX_IMAGE_SIDE = 1600;
export const JPEG_QUALITY = 0.7;

function userDir(uid: string): Directory {
  const dir = new Directory(Paths.document, 'onboarding', uid);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Unique name per pick so <Image> never shows a cached copy of the previous file. */
const destFile = (uid: string, kind: DocKind, ext: string) =>
  new File(userDir(uid), `${kind}-${Date.now()}.${ext}`);

/**
 * Resizes to at most 1600px on the long side, re-encodes as JPEG 0.7 and copies the result into the
 * document directory. Picker and camera URIs live in cache, which the OS may purge between launches.
 */
export async function persistImage(
  uid: string,
  kind: DocKind,
  src: { uri: string; width: number; height: number },
  source: LocalFile['source'],
): Promise<LocalFile> {
  const context = ImageManipulator.manipulate(src.uri);
  const longSide = Math.max(src.width, src.height);
  if (longSide > MAX_IMAGE_SIDE) {
    context.resize(src.width >= src.height ? { width: MAX_IMAGE_SIDE } : { height: MAX_IMAGE_SIDE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });

  const tmp = new File(saved.uri);
  const dest = destFile(uid, kind, 'jpg');
  await tmp.move(dest);
  return { uri: dest.uri, mimeType: 'image/jpeg', name: dest.name, sizeBytes: dest.size ?? 0, source };
}

/** `src` must be a File the module can read (e.g. from File.pickFileAsync), not a bare cache URI. */
export async function persistPdf(uid: string, src: File): Promise<LocalFile> {
  const dest = destFile(uid, 'offerLetter', 'pdf');
  await src.copy(dest);
  return { uri: dest.uri, mimeType: 'application/pdf', name: src.name, sizeBytes: dest.size ?? 0, source: 'document' };
}

export function deleteLocalFile(file: LocalFile | undefined) {
  if (!file) return;
  try {
    const f = new File(file.uri);
    if (f.exists) f.delete();
  } catch {
    // Best effort: an orphaned file is harmless, a crash here is not.
  }
}

export function deleteUserFiles(uid: string) {
  try {
    const dir = new Directory(Paths.document, 'onboarding', uid);
    if (dir.exists) dir.delete();
  } catch {
    // ignore
  }
}
