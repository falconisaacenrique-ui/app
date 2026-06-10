import { useState } from 'react';
import type { CalendarEvent } from '../types';
import { formatDate, formatTime, toDateStr, todayStr, uid } from '../utils';

interface Props {
  events: CalendarEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Calendar({ events, setEvents }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(todayStr());
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayStr();

  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toDateStr(new Date(year, month, i + 1)),
    ),
  ];

  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = eventsByDate.get(e.date) ?? [];
    list.push(e);
    eventsByDate.set(e.date, list);
  }

  const selectedEvents = (eventsByDate.get(selected) ?? []).sort((a, b) =>
    (a.time ?? '').localeCompare(b.time ?? ''),
  );

  function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setEvents((prev) => [
      ...prev,
      { id: uid(), title: title.trim(), date: selected, time: time || undefined, color },
    ]);
    setTitle('');
    setTime('');
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>Calendar</h1>
      </header>

      <div className="cal-nav">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button>
        <strong>
          {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </strong>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button>
      </div>

      <div className="cal-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="cal-head">
            {d}
          </div>
        ))}
        {cells.map((date, i) =>
          date === null ? (
            <div key={`empty-${i}`} className="cal-cell empty" />
          ) : (
            <button
              key={date}
              className={`cal-cell ${date === today ? 'today' : ''} ${date === selected ? 'selected' : ''}`}
              onClick={() => setSelected(date)}
            >
              <span>{Number(date.slice(8))}</span>
              <div className="cal-dots">
                {(eventsByDate.get(date) ?? []).slice(0, 3).map((e) => (
                  <span key={e.id} className="dot" style={{ background: e.color }} />
                ))}
              </div>
            </button>
          ),
        )}
      </div>

      <section className="card">
        <h2>{formatDate(selected)}</h2>
        {selectedEvents.length === 0 && <p className="muted">No events.</p>}
        <ul className="plain-list">
          {selectedEvents.map((e) => (
            <li key={e.id} className="row">
              <span className="dot" style={{ background: e.color }} />
              <span className="grow">
                {e.time && <strong>{formatTime(e.time)} · </strong>}
                {e.title}
              </span>
              <button
                className="icon-btn"
                aria-label="Delete event"
                onClick={() => setEvents((prev) => prev.filter((x) => x.id !== e.id))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={addEvent} className="inline-form">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add event…"
          />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <div className="color-row">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`color-swatch ${c === color ? 'active' : ''}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <button type="submit" className="primary">
            Add
          </button>
        </form>
      </section>
    </div>
  );
}
