import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  CheckSquare,
  ClipboardList,
  Clock,
  Flame,
  Pause,
  Play,
  Plus,
  Wallet,
  X,
} from 'lucide-react';
import Check from '../components/Check';
import CycleChip from '../components/CycleChip';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { occursOn } from '../recurrence';
import { startSound, stopSound, type SoundKind } from '../audio';
import { minutesToHM } from '../solver';
import type { StoredPlan } from './Plan';
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
  onQuickAdd: () => void;
  showToast: (message: string) => void;
}

interface TimelineItem {
  id: string;
  kind: 'event' | 'task' | 'reminder' | 'plan';
  time?: string; // HH:MM, undefined = all-day
  label: string;
  overdue?: boolean;
}

const FOCUS_MINUTES = ['25', '15', '45', '60'] as const;
const SOUNDS = ['off', 'rain', 'wind', 'deep'] as const;

/** Focus timer with procedurally synthesized soundscapes (Web Audio). */
function FocusCard({ showToast }: { showToast: (m: string) => void }) {
  const [minutes, setMinutes] = useState<(typeof FOCUS_MINUTES)[number]>('25');
  const [sound, setSound] = useState<(typeof SOUNDS)[number]>('off');
  const [remaining, setRemaining] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopTimer() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stopSound();
  }

  function start() {
    stopTimer();
    setRemaining(Number(minutes) * 60);
    if (sound !== 'off') startSound(sound as SoundKind);
    timer.current = setInterval(() => {
      setRemaining((r) => {
        if (r === null) return r;
        if (r <= 1) {
          stopTimer();
          showToast('Focus session complete.');
          return null;
        }
        return r - 1;
      });
    }, 1000);
  }

  function pause() {
    stopTimer();
    setRemaining(null);
  }

  useEffect(() => () => stopTimer(), []);

  return (
    <section className="card">
      <h2>
        <Clock size={15} strokeWidth={1.5} /> Focus
      </h2>
      {remaining === null ? (
        <div className="chip-row">
          <CycleChip
            value={minutes}
            options={FOCUS_MINUTES}
            format={(m) => `${m} min`}
            label="Session length"
            onChange={setMinutes}
          />
          <CycleChip
            value={sound}
            options={SOUNDS}
            format={(s) => (s === 'off' ? 'No sound' : s)}
            label="Soundscape"
            active={sound !== 'off'}
            onChange={(s) => {
              setSound(s);
            }}
          />
          <button className="chip row" onClick={start}>
            <Play size={13} strokeWidth={1.5} /> Start
          </button>
        </div>
      ) : (
        <div className="row">
          <span className="big-number grow">
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
          </span>
          <button className="chip row" onClick={pause}>
            <Pause size={13} strokeWidth={1.5} /> Stop
          </button>
        </div>
      )}
    </section>
  );
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
  onQuickAdd,
  showToast,
}: Props) {
  const today = todayStr();
  const [welcomed, setWelcomed] = useLocalStorage<boolean>('lifehub.welcomed', false);
  const [plan] = useLocalStorage<StoredPlan | null>('lifehub.plan', null);

  const hasAnyData =
    events.length > 0 ||
    tasks.length > 0 ||
    reminders.length > 0 ||
    habits.length > 0 ||
    expenses.length > 0;

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
        overdue: t.due! < today,
      })),
    ...(plan?.blocks ?? [])
      .filter(
        (b) =>
          b.date === today &&
          tasks.some((t) => t.id === b.taskId && !t.done && (!t.due || t.due > today)),
      )
      .map((b) => ({
        id: `p-${b.taskId}-${b.start}`,
        kind: 'plan' as const,
        time: minutesToHM(b.start),
        label: `${b.text} (planned)`,
      })),
  ].sort((a, b) => (a.time ?? '00:00').localeCompare(b.time ?? '00:00'));

  const openTasks = tasks.filter((t) => !t.done);
  const dueToday = openTasks.filter((t) => t.due && t.due <= today).length;
  const habitsDone = habits.filter((h) => h.doneDates.includes(today)).length;
  const habitsLeft = habits.length - habitsDone;
  const month = today.slice(0, 7);
  const spent = expenses
    .filter((e) => e.date.startsWith(month))
    .reduce((sum, e) => sum + e.amount, 0);

  const KIND_ICON = { event: CalendarIcon, reminder: Bell, task: CheckSquare, plan: Clock };
  const KIND_VIEW: Record<TimelineItem['kind'], View> = {
    event: 'calendar',
    reminder: 'reminders',
    task: 'tasks',
    plan: 'plan',
  };

  const taskSummary =
    openTasks.length === 0
      ? 'All caught up — nice.'
      : dueToday > 0
        ? `${dueToday} due today of ${openTasks.length} open`
        : `${openTasks.length} open, nothing pressing today`;

  const habitSummary =
    habits.length === 0
      ? null
      : habitsLeft === 0
        ? 'All done today. Well done.'
        : `${habitsDone} of ${habits.length} done — ${habitsLeft} to go`;

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

      {!welcomed && !hasAnyData && (
        <section className="card welcome">
          <div className="row">
            <h2 className="grow">Welcome to LifeHub</h2>
            <button className="icon-btn" aria-label="Dismiss" onClick={() => setWelcomed(true)}>
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
          <p className="muted small">
            Your calendar, tasks, notes, reminders, habits, and budget — all in one private
            place. Everything stays on your device. Start with one of these:
          </p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="primary row" onClick={onQuickAdd}>
              <Plus size={15} strokeWidth={1.5} /> Add anything
            </button>
            <button className="chip" onClick={() => onNavigate('habits')}>
              Track a habit
            </button>
            <button className="chip" onClick={() => onNavigate('calendar')}>
              Plan your week
            </button>
          </div>
        </section>
      )}

      <section className="card timeline">
        <h2>
          <CalendarIcon size={15} strokeWidth={1.5} /> Your day
        </h2>
        {timeline.length === 0 ? (
          <p className="muted">
            Nothing scheduled —{' '}
            <button className="link accent" onClick={onQuickAdd}>
              add something
            </button>{' '}
            or enjoy the open day.
          </p>
        ) : (
          <ul className="plain-list">
            {timeline.map((item) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <li key={item.id} className="row timeline-item list-enter">
                  <span className="timeline-time muted">
                    {item.time ? formatTime(item.time) : '—'}
                  </span>
                  <Icon size={14} strokeWidth={1.5} className="muted" />
                  {item.kind === 'task' ? (
                    <span className="row grow">
                      <Check
                        checked={false}
                        label={`Complete ${item.label}`}
                        onToggle={() =>
                          setTasks((prev) =>
                            prev.map((t) =>
                              `t-${t.id}` === item.id
                                ? { ...t, done: true, doneAt: Date.now() }
                                : t,
                            ),
                          )
                        }
                      />
                      <span className="grow">
                        {item.label}
                        {item.overdue && <span className="badge overdue">overdue</span>}
                      </span>
                    </span>
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

      <FocusCard showToast={showToast} />

      <div className="dash-grid">
        <section className="card clickable" onClick={() => onNavigate('tasks')}>
          <h2>
            <CheckSquare size={15} strokeWidth={1.5} /> Tasks
          </h2>
          <p className={openTasks.length === 0 ? 'muted' : ''}>{taskSummary}</p>
        </section>

        <section className="card clickable" onClick={() => onNavigate('habits')}>
          <h2>
            <Flame size={15} strokeWidth={1.5} /> Habits
          </h2>
          {habitSummary === null ? (
            <p className="cta-text">
              <Plus size={14} strokeWidth={1.5} /> Add your first habit
            </p>
          ) : (
            <>
              <p>{habitSummary}</p>
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
          {expenses.length === 0 && budget === 0 ? (
            <p className="cta-text">
              <Plus size={14} strokeWidth={1.5} /> Track your spending
            </p>
          ) : (
            <>
              <p>
                Spent <strong>{formatMoney(spent, currency)}</strong>
                {budget > 0 && <> of {formatMoney(budget, currency)}</>}
              </p>
              {budget > 0 && (
                <div className="progress">
                  <div
                    className={`progress-bar ${spent > budget ? 'over' : ''}`}
                    style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }}
                  />
                </div>
              )}
            </>
          )}
        </section>

        {hasAnyData && (
          <section className="card clickable" onClick={() => onNavigate('review')}>
            <h2>
              <ClipboardList size={15} strokeWidth={1.5} /> Weekly review
            </h2>
            <p className="muted">How the week went, and what's ahead.</p>
          </section>
        )}
      </div>
    </div>
  );
}
