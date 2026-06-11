/**
 * The Time Machine — an append-only change journal. Every create/update/
 * delete across all collections is recorded with its before/after payload,
 * which powers: full history, restore-anything, reconstructing past state
 * by reverse-replay, and last-writer-wins merging for device sync.
 */

export type EntityKind =
  | 'task'
  | 'event'
  | 'note'
  | 'reminder'
  | 'habit'
  | 'expense'
  | 'fact';

export interface JournalEvent {
  ts: number;
  entity: EntityKind;
  action: 'created' | 'updated' | 'deleted';
  id: string;
  label: string;
  before?: unknown;
  after?: unknown;
}

export interface Identified {
  id: string;
}

export const JOURNAL_CAP = 2000;

/** Diff two versions of a collection into journal events. */
export function diffCollections<T extends Identified>(
  entity: EntityKind,
  prev: T[],
  next: T[],
  labelOf: (item: T) => string,
  ts: number = Date.now(),
): JournalEvent[] {
  const events: JournalEvent[] = [];
  const prevById = new Map(prev.map((i) => [i.id, i]));
  const nextById = new Map(next.map((i) => [i.id, i]));
  for (const [id, item] of nextById) {
    const before = prevById.get(id);
    if (!before) {
      events.push({ ts, entity, action: 'created', id, label: labelOf(item), after: item });
    } else if (JSON.stringify(before) !== JSON.stringify(item)) {
      events.push({ ts, entity, action: 'updated', id, label: labelOf(item), before, after: item });
    }
  }
  for (const [id, item] of prevById) {
    if (!nextById.has(id)) {
      events.push({ ts, entity, action: 'deleted', id, label: labelOf(item), before: item });
    }
  }
  return events;
}

/**
 * Reverse-replay: reconstruct a collection as it was before the given
 * events (newest-last) were applied.
 */
export function rewind<T extends Identified>(
  entity: EntityKind,
  current: T[],
  eventsAfter: JournalEvent[],
): T[] {
  let state = [...current];
  for (const e of [...eventsAfter].reverse()) {
    if (e.entity !== entity) continue;
    if (e.action === 'created') {
      state = state.filter((i) => i.id !== e.id);
    } else if (e.action === 'deleted' && e.before) {
      state = [...state.filter((i) => i.id !== e.id), e.before as T];
    } else if (e.action === 'updated' && e.before) {
      state = state.map((i) => (i.id === e.id ? (e.before as T) : i));
    }
  }
  return state;
}

/** Latest journal timestamp touching an id (0 when unknown). */
function lastTouch(id: string, journal: JournalEvent[]): number {
  let latest = 0;
  for (const e of journal) if (e.id === id && e.ts > latest) latest = e.ts;
  return latest;
}

function deletedAfter(id: string, since: number, journal: JournalEvent[]): boolean {
  return journal.some((e) => e.id === id && e.action === 'deleted' && e.ts > since);
}

/**
 * CRDT-style merge of one collection across two devices: last-writer-wins
 * per item, with journal "deleted" entries acting as tombstones so a
 * deletion on one device beats an older copy on the other.
 */
export function mergeCollections<T extends Identified>(
  local: T[],
  localJournal: JournalEvent[],
  remote: T[],
  remoteJournal: JournalEvent[],
): T[] {
  const localById = new Map(local.map((i) => [i.id, i]));
  const remoteById = new Map(remote.map((i) => [i.id, i]));
  const merged: T[] = [];
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);

  for (const id of ids) {
    const l = localById.get(id);
    const r = remoteById.get(id);
    const lTs = lastTouch(id, localJournal);
    const rTs = lastTouch(id, remoteJournal);
    if (l && r) {
      merged.push(rTs > lTs ? r : l);
    } else if (l && !r) {
      // missing remotely: deleted there, or never synced?
      if (!deletedAfter(id, lTs, remoteJournal)) merged.push(l);
    } else if (r && !l) {
      if (!deletedAfter(id, rTs, localJournal)) merged.push(r);
    }
  }
  return merged;
}

/** Merge two journals chronologically, dropping duplicates, capped. */
export function mergeJournals(a: JournalEvent[], b: JournalEvent[]): JournalEvent[] {
  const seen = new Set<string>();
  const all = [...a, ...b]
    .sort((x, y) => x.ts - y.ts)
    .filter((e) => {
      const key = `${e.ts}:${e.entity}:${e.action}:${e.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return all.slice(-JOURNAL_CAP);
}
