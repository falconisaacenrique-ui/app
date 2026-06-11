import { useState } from 'react';
import { History as HistoryIcon, RotateCcw } from 'lucide-react';
import { rewind, type EntityKind, type JournalEvent } from '../journal';
import type { CalendarEvent, Expense, Habit, Note, Reminder, Task } from '../types';
import { formatDate, toDateStr } from '../utils';

interface Props {
  journal: JournalEvent[];
  collections: {
    task: Task[];
    event: CalendarEvent[];
    note: Note[];
    reminder: Reminder[];
    habit: Habit[];
    expense: Expense[];
  };
  onRestore: (entity: EntityKind, item: unknown) => void;
}

const ENTITY_LABEL: Record<string, string> = {
  task: 'task',
  event: 'event',
  note: 'note',
  reminder: 'reminder',
  habit: 'habit',
  expense: 'expense',
  fact: 'fact',
};

export default function History({ journal, collections, onRestore }: Props) {
  const [daysBack, setDaysBack] = useState(0);

  const scrubDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    return toDateStr(d);
  })();
  const cutoff = new Date(scrubDate + 'T23:59:59').getTime();
  const eventsAfter = journal.filter((e) => e.ts > cutoff);

  const pastCounts = {
    tasks: rewind('task', collections.task, eventsAfter).filter((t) => !(t as Task).done).length,
    events: rewind('event', collections.event, eventsAfter).length,
    notes: rewind('note', collections.note, eventsAfter).length,
    habits: rewind('habit', collections.habit, eventsAfter).length,
    expenses: rewind('expense', collections.expense, eventsAfter).length,
  };

  const existingIds = new Set<string>(
    Object.values(collections).flatMap((items) => items.map((i) => i.id)),
  );
  const recent = [...journal].reverse().slice(0, 80);

  const byDay = new Map<string, JournalEvent[]>();
  for (const e of recent) {
    const day = toDateStr(new Date(e.ts));
    byDay.set(day, [...(byDay.get(day) ?? []), e]);
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>History</h1>
        <p className="muted">
          Every change is journaled on-device. Scrub back through time, or restore anything you
          ever deleted.
        </p>
      </header>

      <section className="card">
        <h2>
          <HistoryIcon size={15} strokeWidth={1.5} /> Time scrubber
        </h2>
        <input
          type="range"
          min={0}
          max={60}
          value={daysBack}
          className="scrubber"
          onChange={(e) => setDaysBack(Number(e.target.value))}
          aria-label="Days back"
        />
        <p>
          <strong>{daysBack === 0 ? 'Today' : formatDate(scrubDate)}</strong>
          <span className="muted">
            {' '}
            — {pastCounts.tasks} open tasks · {pastCounts.events} events · {pastCounts.notes}{' '}
            notes · {pastCounts.habits} habits · {pastCounts.expenses} expenses
          </span>
        </p>
      </section>

      {recent.length === 0 && (
        <p className="muted empty-note">No history yet — changes will appear here as you work.</p>
      )}

      {[...byDay.entries()].map(([day, events]) => (
        <section key={day} className="card">
          <h2>{formatDate(day)}</h2>
          <ul className="plain-list">
            {events.map((e, i) => (
              <li key={`${e.ts}-${i}`} className="row small">
                <span className="timeline-time muted">
                  {new Date(e.ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </span>
                <span className="grow">
                  <span className={e.action === 'deleted' ? 'warn' : ''}>{e.action}</span>{' '}
                  {ENTITY_LABEL[e.entity]} · {e.label || '(untitled)'}
                </span>
                {e.action === 'deleted' && e.before != null && !existingIds.has(e.id) && (
                  <button
                    className="chip row"
                    onClick={() => onRestore(e.entity, e.before)}
                  >
                    <RotateCcw size={12} strokeWidth={1.5} /> Restore
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
