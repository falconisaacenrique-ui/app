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
import CycleChip from '../components/CycleChip';
import type { Habit } from '../types';
import { doneThisWeek, lastNDays, streak, todayStr, uid } from '../utils';
import type { UndoToast } from '../App';

interface Props {
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
  showUndo: (message: string, undo: NonNullable<UndoToast['undo']>) => void;
  showToast: (message: string) => void;
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
const ICON_KEYS = Object.keys(ICONS) as IconKey[];
const TARGETS = ['7', '6', '5', '4', '3', '2', '1'] as const;
const MILESTONES = new Set([3, 7, 14, 30, 60, 100, 365]);

function HabitIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Icon = ICONS[name as IconKey] ?? Flame;
  return <Icon size={size} strokeWidth={1.5} />;
}

function targetLabel(t: string): string {
  return t === '7' ? 'Every day' : `${t}× a week`;
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

function SmartAddHabit({ onAdd }: { onAdd: (h: Omit<Habit, 'id' | 'doneDates'>) => void }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<IconKey>('exercise');
  const [target, setTarget] = useState<(typeof TARGETS)[number]>('7');

  return (
    <form
      className="smart-add card"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd({ name: name.trim(), icon, target: Number(target) });
        setName('');
      }}
    >
      <div className="row">
        <input
          className="grow"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New habit…"
          aria-label="New habit"
        />
        <button type="submit" className="primary">
          Add
        </button>
      </div>
      <div className="chip-row">
        <CycleChip
          value={icon}
          options={ICON_KEYS}
          format={(k) => k}
          label="Icon"
          onChange={setIcon}
        />
        <span className="chip-preview">
          <HabitIcon name={icon} size={14} />
        </span>
        <CycleChip
          value={target}
          options={TARGETS}
          format={targetLabel}
          label="Weekly target"
          active={target !== '7'}
          onChange={setTarget}
        />
      </div>
      <p className="hint muted small">Tap the chips to change icon and how often.</p>
    </form>
  );
}

export default function Habits({ habits, setHabits, showUndo, showToast }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [justChecked, setJustChecked] = useState<string | null>(null);
  const today = todayStr();
  const week = lastNDays(7);

  function toggle(habit: Habit, date: string) {
    const turningOn = !habit.doneDates.includes(date);
    const newDates = turningOn
      ? [...habit.doneDates, date]
      : habit.doneDates.filter((d) => d !== date);
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, doneDates: newDates } : h)));

    if (turningOn && date === today) {
      setJustChecked(habit.id);
      setTimeout(() => setJustChecked(null), 600);
      const s = streak(newDates);
      if (MILESTONES.has(s)) {
        showToast(`${habit.name}: ${s}-day streak — keep it alive`);
      } else {
        const othersDone = habits
          .filter((h) => h.id !== habit.id)
          .every((h) => h.doneDates.includes(today));
        if (othersDone && habits.length > 1) showToast('All habits done today. Well done.');
      }
    }
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

      <SmartAddHabit
        onAdd={(h) => setHabits((prev) => [...prev, { ...h, id: uid(), doneDates: [] }])}
      />

      {habits.length === 0 && (
        <p className="muted empty-note">
          Habits build with small daily check-offs — add your first one above.
        </p>
      )}
      <ul className="plain-list">
        {habits.map((h) => {
          if (editingId === h.id) {
            return (
              <li key={h.id} className="card">
                <EditHabitForm
                  habit={h}
                  onSave={(patch) => {
                    setHabits((prev) =>
                      prev.map((x) => (x.id === h.id ? { ...x, ...patch } : x)),
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
            <li key={h.id} className={`card habit list-enter ${justChecked === h.id ? 'pulse' : ''}`}>
              <div className="row">
                <span className="grow row">
                  <HabitIcon name={h.icon} />
                  <strong>{h.name}</strong>
                  {s > 0 && (
                    <span className={`badge streak ${MILESTONES.has(s) ? 'milestone' : ''}`}>
                      <Flame size={11} strokeWidth={1.5} /> {s} day{s > 1 ? 's' : ''}
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
                  <Pencil size={15} strokeWidth={1.5} />
                </button>
                <button className="icon-btn" aria-label="Delete habit" onClick={() => remove(h)}>
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
              <div className="week-row">
                {week.map((d) => (
                  <button
                    key={d}
                    className={`day-pip ${h.doneDates.includes(d) ? 'on' : ''} ${d === today ? 'today' : ''}`}
                    title={d}
                    aria-label={`${h.name} on ${d}`}
                    onClick={() => toggle(h, d)}
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

function EditHabitForm({
  habit,
  onSave,
}: {
  habit: Habit;
  onSave: (patch: Partial<Habit>) => void;
}) {
  const [name, setName] = useState(habit.name);
  const [icon, setIcon] = useState<IconKey>(
    (habit.icon in ICONS ? habit.icon : 'exercise') as IconKey,
  );
  const [target, setTarget] = useState<(typeof TARGETS)[number]>(
    String(habit.target ?? 7) as (typeof TARGETS)[number],
  );
  return (
    <form
      className="smart-add"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim(), icon, target: Number(target) });
      }}
    >
      <div className="row">
        <input className="grow" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="primary">
          Save
        </button>
      </div>
      <div className="chip-row">
        <CycleChip value={icon} options={ICON_KEYS} format={(k) => k} label="Icon" onChange={setIcon} />
        <span className="chip-preview">
          <HabitIcon name={icon} size={14} />
        </span>
        <CycleChip
          value={target}
          options={TARGETS}
          format={targetLabel}
          label="Weekly target"
          onChange={setTarget}
        />
      </div>
    </form>
  );
}
