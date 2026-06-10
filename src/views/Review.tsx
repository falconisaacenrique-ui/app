import { Bell, Calendar as CalendarIcon, CheckSquare, Flame, Wallet } from 'lucide-react';
import { occursOn } from '../recurrence';
import type { CalendarEvent, Expense, Habit, Reminder, Task } from '../types';
import { formatDate, formatMoney, lastNDays, toDateStr, todayStr } from '../utils';

interface Props {
  events: CalendarEvent[];
  tasks: Task[];
  reminders: Reminder[];
  habits: Habit[];
  expenses: Expense[];
  budget: number;
  currency: string;
}

/** Monday of the week containing today. */
function weekStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function Review({
  events,
  tasks,
  reminders,
  habits,
  expenses,
  budget,
  currency,
}: Props) {
  const start = weekStart();
  const startStr = toDateStr(start);
  const today = todayStr();
  const weekDays = lastNDays((new Date().getDay() + 6) % 7 + 1); // Mon..today

  const completed = tasks.filter((t) => t.done && t.doneAt && t.doneAt >= start.getTime());
  const slipped = tasks.filter((t) => !t.done && t.due && t.due < today);
  const open = tasks.filter((t) => !t.done);

  // Habit consistency: check-offs so far this week vs. target pro-rated to elapsed days.
  const habitStats = habits.map((h) => {
    const doneCount = h.doneDates.filter((d) => d >= startStr && d <= today).length;
    const target = h.target ?? 7;
    const expected = Math.max(1, Math.round((target * weekDays.length) / 7));
    return { habit: h, doneCount, expected };
  });
  const habitPct =
    habitStats.length === 0
      ? null
      : Math.round(
          (habitStats.reduce((s, x) => s + Math.min(1, x.doneCount / x.expected), 0) /
            habitStats.length) *
            100,
        );

  const spentThisWeek = expenses
    .filter((e) => e.date >= startStr && e.date <= today)
    .reduce((s, e) => s + e.amount, 0);

  // The coming 7 days.
  const upcoming: { date: string; label: string; kind: 'event' | 'reminder' }[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const ds = toDateStr(d);
    for (const e of events.filter((e) => occursOn(e.date, e.repeat, ds))) {
      upcoming.push({ date: ds, label: e.title, kind: 'event' });
    }
    for (const r of reminders.filter((r) => !r.done && r.datetime.slice(0, 10) === ds)) {
      upcoming.push({ date: ds, label: r.text, kind: 'reminder' });
    }
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>Weekly review</h1>
        <p className="muted">
          Week of {formatDate(startStr)} — a look back, and a look ahead.
        </p>
      </header>

      <section className="card">
        <h2>
          <CheckSquare size={15} strokeWidth={1.5} /> Tasks
        </h2>
        <p>
          <strong>{completed.length}</strong> completed this week ·{' '}
          <strong>{open.length}</strong> still open
          {slipped.length > 0 && (
            <>
              {' '}
              · <span className="warn">{slipped.length} slipped past due</span>
            </>
          )}
        </p>
        {slipped.length > 0 && (
          <ul className="plain-list small muted">
            {slipped.slice(0, 5).map((t) => (
              <li key={t.id}>
                {t.text} — due {formatDate(t.due!)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>
          <Flame size={15} strokeWidth={1.5} /> Habits
        </h2>
        {habitPct === null ? (
          <p className="muted">No habits tracked yet.</p>
        ) : (
          <>
            <p>
              <strong>{habitPct}%</strong> consistency so far this week
            </p>
            <ul className="plain-list small">
              {habitStats.map(({ habit, doneCount, expected }) => (
                <li key={habit.id} className="row">
                  <span className="grow">{habit.name}</span>
                  <span className={doneCount >= expected ? '' : 'muted'}>
                    {doneCount}/{expected}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card">
        <h2>
          <Wallet size={15} strokeWidth={1.5} /> Spending
        </h2>
        <p>
          <strong>{formatMoney(spentThisWeek, currency)}</strong> spent this week
          {budget > 0 && (
            <span className="muted"> · monthly budget {formatMoney(budget, currency)}</span>
          )}
        </p>
      </section>

      <section className="card">
        <h2>
          <CalendarIcon size={15} strokeWidth={1.5} /> The week ahead
        </h2>
        {upcoming.length === 0 ? (
          <p className="muted">Nothing scheduled in the next 7 days.</p>
        ) : (
          <ul className="plain-list small">
            {upcoming.slice(0, 10).map((u, i) => (
              <li key={i} className="row">
                {u.kind === 'event' ? (
                  <CalendarIcon size={13} strokeWidth={1.5} className="muted" />
                ) : (
                  <Bell size={13} strokeWidth={1.5} className="muted" />
                )}
                <span className="grow">{u.label}</span>
                <span className="muted">{formatDate(u.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
