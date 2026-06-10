import { useState } from 'react';
import {
  Bed,
  BookOpen,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  Pencil,
  PenLine,
  Salad,
  Sparkles,
  X,
} from 'lucide-react';
import type { Habit } from '../types';
import { doneThisWeek, lastNDays, streak, todayStr, uid } from '../utils';
import type { UndoToast } from '../App';

interface Props {
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
  showUndo: (message: string, undo: UndoToast['undo']) => void;
}

const ICONS = {
  exercise: Dumbbell,
  read: BookOpen,
  water: Droplet,
  mindfulness: Sparkles,
  walk: Footprints,
  sleep: Bed,
  eat: Salad,
  write: PenLine,
} as const;

type IconKey = keyof typeof ICONS;

function HabitIcon({ name }: { name: string }) {
  const Icon = ICONS[name as IconKey] ?? Flame;
  return <Icon size={16} strokeWidth={1.5} />;
}

interface HabitFormState {
  name: string;
  icon: IconKey;
  target: number;
}

function HabitForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: HabitFormState;
  submitLabel: string;
  onSubmit: (state: HabitFormState) => void;
}) {
  const [state, setState] = useState(initial);
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!state.name.trim()) return;
        onSubmit({ ...state, name: state.name.trim() });
        setState(initial);
      }}
    >
      <div className="icon-picker">
        {(Object.keys(ICONS) as IconKey[]).map((key) => (
          <button
            type="button"
            key={key}
            className={`icon-choice ${state.icon === key ? 'active' : ''}`}
            title={key}
            onClick={() => setState({ ...state, icon: key })}
          >
            <HabitIcon name={key} />
          </button>
        ))}
      </div>
      <input
        value={state.name}
        onChange={(e) => setState({ ...state, name: e.target.value })}
        placeholder="New habit (e.g. Drink water)"
      />
      <select
        value={state.target}
        onChange={(e) => setState({ ...state, target: Number(e.target.value) })}
      >
        <option value={7}>Every day</option>
        {[6, 5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n}× a week
          </option>
        ))}
      </select>
      <button type="submit" className="primary">
        {submitLabel}
      </button>
    </form>
  );
}

/** 12-week activity heatmap, columns = weeks, rows = days. */
function Heatmap({ doneDates }: { doneDates: string[] }) {
  const days = lastNDays(12 * 7);
  const set = new Set(doneDates);
  return (
    <div className="heatmap" title="Last 12 weeks">
      {days.map((d) => (
        <span key={d} className={`heat-cell ${set.has(d) ? 'on' : ''}`} title={d} />
      ))}
    </div>
  );
}

export default function Habits({ habits, setHabits, showUndo }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const today = todayStr();
  const week = lastNDays(7);

  function toggle(id: string, date: string) {
    setHabits((prev) =>
      prev.map((h) =>
        h.id === id
          ? {
              ...h,
              doneDates: h.doneDates.includes(date)
                ? h.doneDates.filter((d) => d !== date)
                : [...h.doneDates, date],
            }
          : h,
      ),
    );
  }

  function remove(habit: Habit) {
    setHabits((prev) => prev.filter((x) => x.id !== habit.id));
    showUndo(`Deleted "${habit.name}"`, () => setHabits((prev) => [...prev, habit]));
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>Habits</h1>
      </header>

      <div className="card">
        <HabitForm
          initial={{ name: '', icon: 'exercise', target: 7 }}
          submitLabel="Add"
          onSubmit={(s) =>
            setHabits((prev) => [
              ...prev,
              { id: uid(), name: s.name, icon: s.icon, doneDates: [], target: s.target },
            ])
          }
        />
      </div>

      {habits.length === 0 && <p className="muted">Add a habit to start tracking.</p>}
      <ul className="plain-list">
        {habits.map((h) => {
          if (editingId === h.id) {
            return (
              <li key={h.id} className="card">
                <HabitForm
                  initial={{
                    name: h.name,
                    icon: (h.icon in ICONS ? h.icon : 'exercise') as IconKey,
                    target: h.target ?? 7,
                  }}
                  submitLabel="Save"
                  onSubmit={(s) => {
                    setHabits((prev) =>
                      prev.map((x) =>
                        x.id === h.id ? { ...x, name: s.name, icon: s.icon, target: s.target } : x,
                      ),
                    );
                    setEditingId(null);
                  }}
                />
              </li>
            );
          }
          const s = streak(h.doneDates);
          const target = h.target ?? 7;
          const thisWeek = doneThisWeek(h.doneDates);
          return (
            <li key={h.id} className="card habit">
              <div className="row">
                <span className="grow row">
                  <HabitIcon name={h.icon} />
                  <strong>{h.name}</strong>
                  {s > 0 && (
                    <span className="badge streak">
                      {s} day{s > 1 ? 's' : ''}
                    </span>
                  )}
                  <span className={`badge ${thisWeek >= target ? 'streak' : ''}`}>
                    {thisWeek}/{target} this week
                  </span>
                </span>
                <button
                  className="icon-btn"
                  aria-label="Edit habit"
                  onClick={() => setEditingId(h.id)}
                >
                  <Pencil size={14} strokeWidth={1.5} />
                </button>
                <button className="icon-btn" aria-label="Delete habit" onClick={() => remove(h)}>
                  <X size={15} strokeWidth={1.5} />
                </button>
              </div>
              <div className="week-row">
                {week.map((d) => (
                  <button
                    key={d}
                    className={`day-pip ${h.doneDates.includes(d) ? 'on' : ''} ${d === today ? 'today' : ''}`}
                    title={d}
                    onClick={() => toggle(h.id, d)}
                  >
                    {new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </button>
                ))}
              </div>
              <Heatmap doneDates={h.doneDates} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
