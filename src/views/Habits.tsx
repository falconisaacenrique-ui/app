import { useState } from 'react';
import type { Habit } from '../types';
import { lastNDays, streak, todayStr, uid } from '../utils';

interface Props {
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
}

const ICONS = ['💪', '📖', '💧', '🧘', '🏃', '🛏️', '🥗', '✍️'];

export default function Habits({ habits, setHabits }: Props) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const today = todayStr();
  const week = lastNDays(7);

  function addHabit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setHabits((prev) => [...prev, { id: uid(), name: name.trim(), icon, doneDates: [] }]);
    setName('');
  }

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

  return (
    <div className="view">
      <header className="view-header">
        <h1>Habits</h1>
      </header>

      <form onSubmit={addHabit} className="inline-form card">
        <select value={icon} onChange={(e) => setIcon(e.target.value)}>
          {ICONS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New habit (e.g. Drink water)"
        />
        <button type="submit" className="primary">
          Add
        </button>
      </form>

      {habits.length === 0 && <p className="muted">Add a habit to start tracking.</p>}
      <ul className="plain-list">
        {habits.map((h) => {
          const s = streak(h.doneDates);
          return (
            <li key={h.id} className="card habit">
              <div className="row">
                <span className="grow">
                  {h.icon} <strong>{h.name}</strong>
                  {s > 0 && <span className="badge streak">🔥 {s} day{s > 1 ? 's' : ''}</span>}
                </span>
                <button
                  className="icon-btn"
                  aria-label="Delete habit"
                  onClick={() => setHabits((prev) => prev.filter((x) => x.id !== h.id))}
                >
                  ✕
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
                    {new Date(d + 'T00:00').toLocaleDateString(undefined, {
                      weekday: 'narrow',
                    })}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
