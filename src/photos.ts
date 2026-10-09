import { useEffect, useState, useSyncExternalStore } from 'react';
import { clear, createStore, del, entries, get, keys, set, setMany } from 'idb-keyval';
import type { ISODate } from './dates';

// Progress photos live in their own IndexedDB database on the device. They are never
// uploaded anywhere; the app has no server and its CSP blocks requests to other origins.

interface StoredPhoto {
  full: Blob;
  thumb: Blob;
  takenAt: string;
}

const store = createStore('habitactual-photos', 'photos');

export const photoKey = (challengeId: string, date: ISODate, taskId: string) => `${challengeId}/${date}/${taskId}`;

export function parsePhotoKey(key: string): { challengeId: string; date: ISODate; taskId: string } {
  const [challengeId, date, taskId] = key.split('/');
  return { challengeId, date, taskId };
}

// Bumped on every write so components showing a photo reload it (e.g. after a retake).
let version = 0;
const listeners = new Set<() => void>();
function changed() {
  version++;
  listeners.forEach((l) => l());
}
function usePhotoVersion(): number {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => version);
}

/**
 * Re-encodes the image: shrinks it to a sensible size and drops EXIF metadata such as GPS location.
 */
async function encode(source: Blob, maxSide: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the photo.'))), 'image/jpeg', quality),
  );
}

async function prepare(source: Blob): Promise<StoredPhoto> {
  const [full, thumb] = await Promise.all([encode(source, 1600, 0.85), encode(source, 320, 0.75)]);
  return { full, thumb, takenAt: new Date().toISOString() };
}

export async function savePhoto(key: string, file: Blob): Promise<void> {
  await set(key, await prepare(file), store);
  changed();
}

export async function deletePhoto(key: string): Promise<void> {
  await del(key, store);
  changed();
}

export async function listPhotoKeys(challengeId: string): Promise<string[]> {
  const all = (await keys(store)) as string[];
  return all.filter((k) => k.startsWith(`${challengeId}/`)).sort();
}

export async function deleteChallengePhotos(challengeId: string): Promise<void> {
  for (const k of await listPhotoKeys(challengeId)) await del(k, store);
  changed();
}

/** Object URL for a photo, or null if there isn't one. Revoked automatically. */
export function usePhotoUrl(key: string | null, size: 'thumb' | 'full'): string | null {
  const v = usePhotoVersion();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return setUrl(null);
    let objectUrl: string | null = null;
    let cancelled = false;
    get<StoredPhoto>(key, store).then((p) => {
      if (cancelled) return;
      objectUrl = p ? URL.createObjectURL(p[size]) : null;
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [key, size, v]);
  return url;
}

/** Keys of a challenge's photos, kept up to date as photos are added or removed. */
export function usePhotoKeys(challengeId: string): string[] {
  const v = usePhotoVersion();
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    listPhotoKeys(challengeId).then((k) => !cancelled && setList(k));
    return () => {
      cancelled = true;
    };
  }, [challengeId, v]);
  return list;
}

// Backups: photos are only included when the user opts in.

const toDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

// Decoded by hand: fetch() on a data: URL would be blocked by the CSP's connect-src.
function dataUrlToBlob(dataUrl: string): Blob {
  const [head, base64] = dataUrl.split(',');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: head.slice(5).split(';')[0] });
}

export async function exportPhotos(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [k, p] of (await entries(store)) as [string, StoredPhoto][]) out[k] = await toDataUrl(p.full);
  return out;
}

export async function importPhotos(photos: Record<string, string>): Promise<number> {
  const items: [string, StoredPhoto][] = [];
  for (const [k, dataUrl] of Object.entries(photos)) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) continue;
    const blob = dataUrlToBlob(dataUrl);
    items.push([k, await prepare(blob)]);
  }
  await clear(store);
  await setMany(items, store);
  changed();
  return items.length;
}
