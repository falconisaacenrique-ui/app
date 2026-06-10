import {
  Bell,
  Calendar as CalendarIcon,
  CheckSquare,
  Flame,
  StickyNote,
  Wallet,
} from 'lucide-react';
import type { CalendarEvent, Expense, Habit, Reminder, Task, View } from '../types';
import { formatMoney, formatTime, todayStr } from '../utils';

interface Props {
  events: CalendarEvent[];
  tasks: Task[];
  reminders: Reminder[];
  habits: Habit[];
  expenses: Expense[];
  budget: number;
  onNavigate: (view: View) => void;
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
  reminders,
  habits,
  expenses,
  budget,
  onNavigate,
}: Props) {
  const today = todayStr();
  const todayEvents = events
    .filter((e) => e.date === today)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const dueTasks = tasks.filter((t) => !t.done && t.due && t.due <= today);
  const openTasks = tasks.filter((t) => !t.done);
  const upcomingReminders = reminders
    .filter((r) => !r.done)
    .sort((a, b) => a.datetime.localeCompare(b.datetime))
    .slice(0, 5);
  const habitsDone = habits.filter((h) => h.doneDates.includes(today)).length;
  const month = today.slice(0, 7);
  const spent = expenses
    .filter((e) => e.date.startsWith(month))
    .reduce((sum, e) => sum + e.amount, 0);

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="view">
      <header className="view-header">
        <h1>{greeting()}</h1>
        <p className="muted">{dateLabel}</p>
      </header>

      <div className="dash-grid">
        <section className="card clickable" onClick={() => onNavigate('calendar')}>
          <h2>
            <CalendarIcon size={15} strokeWidth={1.5} /> Today's events
          </h2>
          {todayEvents.length === 0 ? (
            <p className="muted">Nothing scheduled today.</p>
          ) : (
            <ul className="plain-list">
              {todayEvents.map((e) => (
                <li key={e.id}>
                  <span className="dot" style={{ background: e.color }} />
                  {e.time && <strong>{formatTime(e.time)}</strong>} {e.title}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card clickable" onClick={() => onNavigate('tasks')}>
          <h2>
            <CheckSquare size={15} strokeWidth={1.5} /> Tasks
          </h2>
          {dueTasks.length > 0 && (
            <p className="warn">
              {dueTasks.length} task{dueTasks.length > 1 ? 's' : ''} due or overdue
            </p>
          )}
          <p className="muted">
            {openTasks.length === 0
              ? 'All caught up.'
              : `${openTasks.length} open task${openTasks.length > 1 ? 's' : ''}`}
          </p>
        </section>

        <section className="card clickable" onClick={() => onNavigate('reminders')}>
          <h2>
            <Bell size={15} strokeWidth={1.5} /> Reminders
          </h2>
          {upcomingReminders.length === 0 ? (
            <p className="muted">No upcoming reminders.</p>
          ) : (
            <ul className="plain-list">
              {upcomingReminders.map((r) => (
                <li key={r.id}>
                  <strong>{new Date(r.datetime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</strong>{' '}
                  {r.text}
                </li>
              ))}
            </ul>
          )}
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
            Spent <strong>{formatMoney(spent)}</strong>
            {budget > 0 && <> of {formatMoney(budget)} budget</>}
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

        <section className="card clickable" onClick={() => onNavigate('notes')}>
          <h2>
            <StickyNote size={15} strokeWidth={1.5} /> Notes
          </h2>
          <p className="muted">Jot something down</p>
        </section>
      </div>
    </div>
  );
}
