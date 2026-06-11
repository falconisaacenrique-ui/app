import { useMemo, useState } from 'react';
import { AlertTriangle, BrainCircuit, Clock, TrendingUp } from 'lucide-react';
import {
  forecastSpend,
  hourDensity,
  peakWindow,
  pearson,
  predictLogistic,
  trainLogistic,
  type TrainSample,
} from '../oracle';
import type { Expense, Habit, Task } from '../types';
import { formatMoney, formatTime, lastNDays, todayStr } from '../utils';

interface Props {
  tasks: Task[];
  habits: Habit[];
  expenses: Expense[];
  budget: number;
  currency: string;
}

function taskFeatures(t: Task, today: string, nowMs: number): number[] {
  const ageDays = Math.max(0, (nowMs - t.createdAt) / 86_400_000);
  const overdueDays = t.due && t.due < today
    ? (new Date(today).getTime() - new Date(t.due).getTime()) / 86_400_000
    : 0;
  const prio = t.priority === 'high' ? 2 : t.priority === 'medium' ? 1 : 0;
  return [ageDays, overdueDays, prio, t.due ? 1 : 0, t.text.length];
}

export default function Insights({ tasks, habits, expenses, budget, currency }: Props) {
  const today = todayStr();

  // --- Completion prophecy: train on resolved history, score open tasks ---
  const [nowMs] = useState(() => Date.now());
  const { model, atRisk } = useMemo(() => {
    const samples: TrainSample[] = tasks
      .filter((t) => t.done || (nowMs - t.createdAt) / 86_400_000 > 14)
      .map((t) => ({ features: taskFeatures(t, today, nowMs), label: t.done ? 1 : 0 }));
    const trained = trainLogistic(samples);
    const scored = trained
      ? tasks
          .filter((t) => !t.done)
          .map((t) => ({ task: t, p: predictLogistic(trained, taskFeatures(t, today, nowMs)) }))
          .sort((a, b) => a.p - b.p)
          .slice(0, 5)
      : [];
    return { model: trained, atRisk: scored };
  }, [tasks, today, nowMs]);

  // --- Budget forecast: Monte Carlo over historical daily spends ---
  const month = today.slice(0, 7);
  const spent = expenses.filter((e) => e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0);
  const dailyTotals = new Map<string, number>();
  for (const e of expenses) dailyTotals.set(e.date, (dailyTotals.get(e.date) ?? 0) + e.amount);
  const history = lastNDays(60)
    .filter((d) => d < today)
    .map((d) => dailyTotals.get(d) ?? 0);
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const daysRemaining = daysInMonth - Number(today.slice(8));
  const forecast = history.some((v) => v > 0)
    ? forecastSpend(spent, history, daysRemaining)
    : null;

  // --- Circadian fingerprint from completion timestamps ---
  const doneHours = tasks
    .filter((t) => t.doneAt)
    .map((t) => new Date(t.doneAt!).getHours());
  const density = hourDensity(doneHours);
  const peak = doneHours.length >= 5 ? peakWindow(density) : null;

  // --- Correlations: each habit vs daily task completion ---
  const days = lastNDays(42);
  const doneByDay = new Map<string, number>();
  for (const t of tasks) {
    if (!t.doneAt) continue;
    const d = new Date(t.doneAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    doneByDay.set(key, (doneByDay.get(key) ?? 0) + 1);
  }
  const taskSeries = days.map((d) => doneByDay.get(d) ?? 0);
  const correlations = habits
    .map((h) => {
      const habitSeries = days.map((d) => (h.doneDates.includes(d) ? 1 : 0));
      const onDays = habitSeries.filter((v) => v === 1).length;
      if (onDays < 5 || onDays > days.length - 5) return null;
      const r = pearson(habitSeries, taskSeries);
      return r !== null && Math.abs(r) >= 0.3 ? { habit: h, r } : null;
    })
    .filter((c): c is { habit: Habit; r: number } => c !== null)
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  return (
    <div className="view">
      <header className="view-header">
        <h1>Insights</h1>
        <p className="muted">
          Statistics computed on this device, from your own history. Nothing leaves your browser.
        </p>
      </header>

      <section className="card">
        <h2>
          <AlertTriangle size={15} strokeWidth={1.5} /> Completion prophecy
        </h2>
        {!model ? (
          <p className="muted">
            Needs more history — complete or age a few tasks and the model trains itself.
          </p>
        ) : atRisk.length === 0 ? (
          <p className="muted">No open tasks to score.</p>
        ) : (
          <>
            <p className="muted small">
              A model trained on your own completion history. Lowest odds first — do them now or
              let them go.
            </p>
            <ul className="plain-list">
              {atRisk.map(({ task, p }) => (
                <li key={task.id} className="row">
                  <span className="grow">{task.text}</span>
                  <span className={`badge ${p < 0.35 ? 'overdue' : ''}`}>
                    {Math.round(p * 100)}% likely
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card">
        <h2>
          <TrendingUp size={15} strokeWidth={1.5} /> Spending forecast
        </h2>
        {!forecast ? (
          <p className="muted">Log expenses for a few days and the simulation starts.</p>
        ) : (
          <>
            <p>
              500 simulated month-ends:{' '}
              <strong>{formatMoney(forecast.expected, currency)}</strong>
              <span className="muted">
                {' '}
                (range {formatMoney(forecast.low, currency)} – {formatMoney(forecast.high, currency)})
              </span>
            </p>
            {budget > 0 && (
              <p className={forecast.expected > budget ? 'warn' : 'muted'}>
                {forecast.expected > budget
                  ? `On track to exceed your ${formatMoney(budget, currency)} budget.`
                  : forecast.high > budget
                    ? 'Within budget on average, but the upper range crosses it — watch the next days.'
                    : 'Comfortably within budget at the current pace.'}
              </p>
            )}
          </>
        )}
      </section>

      <section className="card">
        <h2>
          <Clock size={15} strokeWidth={1.5} /> Your power hours
        </h2>
        {!peak ? (
          <p className="muted">Complete a few more tasks and your rhythm will appear here.</p>
        ) : (
          <>
            <p>
              You actually finish things around{' '}
              <strong>
                {formatTime(`${String(peak.start).padStart(2, '0')}:00`)}–
                {formatTime(`${String(peak.end).padStart(2, '0')}:00`)}
              </strong>{' '}
              — the planner uses this.
            </p>
            <div className="hour-chart" aria-hidden>
              {density.map((v, h) => (
                <div key={h} className="hour-col" title={`${h}:00`}>
                  <div className="hour-bar" style={{ height: `${Math.max(4, v * 100)}%` }} />
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2>
          <BrainCircuit size={15} strokeWidth={1.5} /> Cross-life correlations
        </h2>
        {correlations.length === 0 ? (
          <p className="muted">
            Nothing significant yet — correlations need ~6 weeks of habit and task history.
          </p>
        ) : (
          <ul className="plain-list">
            {correlations.map(({ habit, r }) => (
              <li key={habit.id} className="small">
                On days you do <strong>{habit.name}</strong>, you complete{' '}
                <strong>{r > 0 ? 'more' : 'fewer'}</strong> tasks (r = {r.toFixed(2)}).
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
