import { useState } from 'react';
import { CalendarRange, Sparkles } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { hourDensity } from '../oracle';
import { occursOn } from '../recurrence';
import { minutesToHM, solve, type Plan as SolverPlan } from '../solver';
import type { CalendarEvent, Task } from '../types';
import { formatDate, formatTime, toDateStr, todayStr } from '../utils';

interface Props {
  tasks: Task[];
  events: CalendarEvent[];
}

export interface StoredPlan {
  generatedAt: number;
  blocks: SolverPlan['blocks'];
}

export default function PlanView({ tasks, events }: Props) {
  const [plan, setPlan] = useLocalStorage<StoredPlan | null>('lifehub.plan', null);
  const [unscheduled, setUnscheduled] = useState<string[]>([]);
  const today = todayStr();

  function generate() {
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(toDateStr(d));
    }
    const busy = days.flatMap((date) =>
      events
        .filter((e) => occursOn(e.date, e.repeat, date) && e.time)
        .map((e) => {
          const [h, m] = e.time!.split(':').map(Number);
          return { date, start: h * 60 + m, end: h * 60 + m + 60 };
        }),
    );
    const open = tasks
      .filter((t) => !t.done)
      .map((t) => ({
        id: t.id,
        text: t.text,
        duration: t.duration ?? 30,
        due: t.due,
        priority: t.priority,
      }));
    const doneHours = tasks.filter((t) => t.doneAt).map((t) => new Date(t.doneAt!).getHours());
    const now = new Date();
    const result = solve({
      tasks: open,
      busy,
      days,
      workStart: 8 * 60,
      workEnd: 22 * 60,
      hourWeight: doneHours.length >= 5 ? hourDensity(doneHours) : undefined,
      dayStartMin: now.getHours() * 60 + now.getMinutes() + 15,
    });
    setPlan({ generatedAt: Date.now(), blocks: result.blocks });
    setUnscheduled(result.unscheduled.map((t) => t.text));
  }

  const byDay = new Map<string, SolverPlan['blocks']>();
  for (const b of plan?.blocks ?? []) {
    byDay.set(b.date, [...(byDay.get(b.date) ?? []), b]);
  }
  const stillOpen = new Set(tasks.filter((t) => !t.done).map((t) => t.id));

  return (
    <div className="view">
      <header className="view-header">
        <h1>Plan</h1>
        <p className="muted">
          A simulated-annealing solver places your open tasks into the free gaps of the next 7
          days — around your events, before deadlines, in your productive hours.
        </p>
      </header>

      <div className="row" style={{ marginBottom: '1rem' }}>
        <button className="primary row" onClick={generate}>
          <Sparkles size={15} strokeWidth={1.5} /> {plan ? 'Re-plan my week' : 'Plan my week'}
        </button>
        {plan && (
          <span className="muted small">
            planned {new Date(plan.generatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>

      {!plan && (
        <p className="muted empty-note">
          Add tasks (give them durations in the task editor for better plans), then press the
          button. Tasks default to 30 minutes.
        </p>
      )}

      {plan &&
        [...byDay.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, blocks]) => (
            <section key={date} className="card">
              <h2>
                <CalendarRange size={15} strokeWidth={1.5} />
                {date === today ? 'Today' : formatDate(date)}
              </h2>
              <ul className="plain-list">
                {blocks.map((b) => (
                  <li key={`${b.taskId}-${b.start}`} className={`row ${stillOpen.has(b.taskId) ? '' : 'done'}`}>
                    <span className="timeline-time muted">{formatTime(minutesToHM(b.start))}</span>
                    <span className="grow">{b.text}</span>
                    <span className="badge">{b.end - b.start} min</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

      {unscheduled.length > 0 && (
        <section className="card">
          <h2>Could not fit this week</h2>
          <ul className="plain-list small muted">
            {unscheduled.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
