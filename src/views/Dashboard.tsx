import { Bell, Calendar as CalendarIcon, CheckSquare, Flame, Wallet } from 'lucide-react';
import { occursOn } from '../recurrence';
import type { CalendarEvent, Expense, Habit, Reminder, Task, View } from '../types';
import { formatMoney, formatTime, todayStr } from '../utils';

interface Props {
  events: CalendarEvent[];
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  reminders: Reminder[];
  habits: Habit[];
  expenses: Expense[];
  budget: number;
  currency: string;
  onNavigate: (view: View) => void;
}

interface TimelineItem {
  id: string;
  kind: 'event' | 'task' | 'reminder';
  time?: string; // HH:MM, undefined = all-day
  label: string;
  sublabel?: string;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard({
  events,
  tasks,
  setTasks,
  reminders,
  habits,
  expenses,
  budget,
  currency,
  onNavigate,
}: Props) {
  const today = todayStr();

  const timeline: TimelineItem[] = [
    ...events
      .filter((e) => occursOn(e.date, e.repeat, today))
      .map((e) => ({
        id: `e-${e.id}`,
        kind: 'event' as const,
        time: e.time,
        label: e.title,
      })),
    ...reminders
      .filter((r) => !r.done && r.datetime.slice(0, 10) === today)
      .map((r) => ({
        id: `r-${r.id}`,
        kind: 'reminder' as const,
        time: r.datetime.slice(11, 16),
        label: r.text,
      })),
    ...tasks
      .filter((t) => !t.done && t.due && t.due <= today)
      .map((t) => ({
        id: `t-${t.id}`,
        kind: 'task' as const,
        time: undefined,
        label: t.text,
        sublabel: t.due! < today ? 'overdue' : undefined,
      })),
  ].sort((a, b) => (a.time ?? '00:00').localeCompare(b.time ?? '00:00'));

  const openTasks = tasks.filter((t) => !t.done);
  const habitsDone = habits.filter((h) => h.doneDates.includes(today)).length;
  const month = today.slice(0, 7);
  const spent = expenses
    .filter((e) => e.date.startsWith(month))
    .reduce((sum, e) => sum + e.amount, 0);

  const KIND_ICON = { event: CalendarIcon, reminder: Bell, task: CheckSquare };
  const KIND_VIEW: Record<TimelineItem['kind'], View> = {
    event: 'calendar',
    reminder: 'reminders',
    task: 'tasks',
  };

  return (
    <div className="view">
      <header className="view-header">
        <h1>{greeting()}</h1>
        <p className="muted">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </header>

      <section className="card timeline">
        <h2>
          <CalendarIcon size={15} strokeWidth={1.5} /> Your day
        </h2>
        {timeline.length === 0 ? (
          <p className="muted">Nothing scheduled — enjoy the open day.</p>
        ) : (
          <ul className="plain-list">
            {timeline.map((item) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <li key={item.id} className="row timeline-item">
                  <span className="timeline-time muted">
                    {item.time ? formatTime(item.time) : '—'}
                  </span>
                  <Icon size={14} strokeWidth={1.5} className="muted" />
                  {item.kind === 'task' ? (
                    <label className="row grow">
                      <input
                        type="checkbox"
                        onChange={() =>
                          setTasks((prev) =>
                            prev.map((t) =>
                              `t-${t.id}` === item.id ? { ...t, done: true } : t,
                            ),
                          )
                        }
                      />
                      <span className="grow">
                        {item.label}
                        {item.sublabel && <span className="badge overdue">{item.sublabel}</span>}
                      </span>
                    </label>
                  ) : (
                    <button className="link grow" onClick={() => onNavigate(KIND_VIEW[item.kind])}>
                      {item.label}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="dash-grid">
        <section className="card clickable" onClick={() => onNavigate('tasks')}>
          <h2>
            <CheckSquare size={15} strokeWidth={1.5} /> Tasks
          </h2>
          <p className="muted">
            {openTasks.length === 0
              ? 'All caught up.'
              : `${openTasks.length} open task${openTasks.length > 1 ? 's' : ''}`}
          </p>
        </section>

        <section className="card clickable" onClick={() => onNavigate('habits')}>
          <h2>
            <Flame size={15} strokeWidth={1.5} /> Habits
          </h2>
          {habits.length === 0 ? (
            <p className="muted">No habits tracked yet.</p>
          ) : (
            <>
              <p>
                <strong>
                  {habitsDone}/{habits.length}
                </strong>{' '}
                done today
              </p>
              <div className="progress">
                <div
                  className="progress-bar"
                  style={{ width: `${habits.length ? (habitsDone / habits.length) * 100 : 0}%` }}
                />
              </div>
            </>
          )}
        </section>

        <section className="card clickable" onClick={() => onNavigate('budget')}>
          <h2>
            <Wallet size={15} strokeWidth={1.5} /> This month
          </h2>
          <p>
            Spent <strong>{formatMoney(spent, currency)}</strong>
            {budget > 0 && <> of {formatMoney(budget, currency)} budget</>}
          </p>
          {budget > 0 && (
            <div className="progress">
              <div
                className={`progress-bar ${spent > budget ? 'over' : ''}`}
                style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
