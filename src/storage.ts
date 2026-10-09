import { get, set } from 'idb-keyval';
import { emptyState, type AppState } from './model';

const KEY = 'habitactual-state';

export async function loadState(): Promise<AppState> {
  const saved = await get<AppState>(KEY);
  return saved && saved.version === 1 ? saved : emptyState();
}

export async function saveState(state: AppState): Promise<void> {
  await set(KEY, state);
}

/** Asks the browser not to evict our data under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return (await navigator.storage.persisted()) || navigator.storage.persist();
}

export interface Backup {
  state: AppState;
  /** Only present when the user chose to include photos: key → JPEG data URL. */
  photos?: Record<string, string>;
}

export function exportBackup(state: AppState, photos?: Record<string, string>): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const data = photos ? { ...state, photos } : state;
  download(`habitactual-backup-${stamp}${photos ? '-with-photos' : ''}.json`, JSON.stringify(data, null, photos ? 0 : 2), 'application/json');
}

export function parseBackup(text: string): Backup {
  const data = JSON.parse(text);
  if (data?.version !== 1 || !Array.isArray(data.challenges)) {
    throw new Error("This file isn't a HabitActual backup.");
  }
  for (const c of data.challenges) {
    if (typeof c.id !== 'string' || typeof c.name !== 'string' || !Array.isArray(c.tasks) || typeof c.startDate !== 'string') {
      throw new Error('The backup file is damaged or incomplete.');
    }
    c.checks ??= {};
    c.amounts ??= {};
    c.strict = !!c.strict;
  }
  const { photos, ...state } = data;
  return { state: state as AppState, photos: photos && typeof photos === 'object' ? photos : undefined };
}

export function download(filename: string, contents: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
