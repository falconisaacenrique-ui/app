/**
 * Versioned localStorage layer with migrations and full export/import.
 * All app data lives under "lifehub.*" keys; "lifehub.version" tracks the
 * schema so future shape changes can migrate old data instead of breaking it.
 */

export const SCHEMA_VERSION = 2;

export const DATA_KEYS = [
  'lifehub.events',
  'lifehub.notes',
  'lifehub.reminders',
  'lifehub.tasks',
  'lifehub.habits',
  'lifehub.expenses',
  'lifehub.budget',
  'lifehub.settings',
] as const;

export function migrate(): void {
  const stored = Number(localStorage.getItem('lifehub.version') ?? '1');
  if (stored >= SCHEMA_VERSION) return;
  // v1 -> v2: new fields (repeat, target, settings) are optional additions;
  // existing data is forward-compatible as-is.
  localStorage.setItem('lifehub.version', String(SCHEMA_VERSION));
}

/** Ask the browser to protect this origin's storage from eviction. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      return (await navigator.storage.persisted()) || (await navigator.storage.persist());
    }
  } catch {
    // unsupported
  }
  return false;
}

export function exportData(): string {
  const data: Record<string, unknown> = { version: SCHEMA_VERSION, exportedAt: new Date().toISOString() };
  for (const key of DATA_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        // skip corrupt entry
      }
    }
  }
  return JSON.stringify(data, null, 2);
}

/** Validates and writes an exported backup. Returns an error message or null. */
export function importData(json: string): string | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json);
  } catch {
    return 'That file is not valid JSON.';
  }
  if (typeof data !== 'object' || data === null || typeof data.version !== 'number') {
    return 'That file is not a LifeHub backup.';
  }
  if (data.version > SCHEMA_VERSION) {
    return 'That backup is from a newer version of LifeHub.';
  }
  for (const key of DATA_KEYS) {
    if (key in data) {
      localStorage.setItem(key, JSON.stringify(data[key]));
    }
  }
  localStorage.setItem('lifehub.version', String(SCHEMA_VERSION));
  return null;
}
