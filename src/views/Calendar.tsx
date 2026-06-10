import { useRef, useState } from 'react';
import { CheckSquare, ChevronLeft, ChevronRight, Download, Pencil, Upload, X } from 'lucide-react';
import { exportICS, importICS } from '../ics';
import { occursOn, REPEAT_LABELS } from '../recurrence';
import type { CalendarEvent, Repeat, Task } from '../types';
import { formatDate, formatTime, toDateStr, todayStr, uid } from '../utils';
import type { UndoToast } from '../App';

interface Props {
  events: CalendarEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  tasks: Task[];
  showUndo: (message: string, undo: UndoToast['undo']) => void;
}

const COLORS = ['#4f46e5', '#64748b', '#a8a29e', '#171717'];

interface EventFormState {
  title: string;
  time: string;
  notes: string;
  color: string;
  repeat: '' | Repeat;
}

const EMPTY_FORM: EventFormState = { title: '', time: '', notes: '', color: COLORS[0], repeat: '' };

function EventForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: EventFormState;
  submitLabel: string;
  onSubmit: (state: EventFormState) => void;
}) {
  const [state, setState] = useState(initial);
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!state.title.trim()) return;
        onSubmit({ ...state, title: state.title.trim() });
        setState(EMPTY_FORM);
      }}
    >
      <input
        value={state.title}
        onChange={(e) => setState({ ...state, title: e.target.value })}
        placeholder="Event title…"
      />
      <input
        type="time"
        value={state.time}
        onChange={(e) => setState({ ...state, time: e.target.value })}
      />
      <select
        value={state.repeat}
        onChange={(e) => setState({ ...state, repeat: e.target.value as '' | Repeat })}
      >
        {REPEAT_LABELS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <input
        value={state.notes}
        onChange={(e) => setState({ ...state, notes: e.target.value })}
        placeholder="Notes (optional)"
      />
      <div className="color-row">
        {COLORS.map((c) => (
          <button
            type="button"
            key={c}
            className={`color-swatch ${c === state.color ? 'active' : ''}`}
            style={{ background: c }}
            aria-label={`Color ${c}`}
            onClick={() => setState({ ...state, color: c })}
          />
        ))}
      </div>
      <button type="submit" className="primary">
        {submitLabel}
      </button>
    </form>
  );
}

export default function Calendar({ events, setEvents, tasks, showUndo }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(todayStr());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const fileRef = useRef<HTMLInputElement>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayStr();

  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDateStr(new Date(year, month, i + 1))),
  ];

  const eventsOn = (date: string) => events.filter((e) => occursOn(e.date, e.repeat, date));
  const tasksOn = (date: string) => tasks.filter((t) => !t.done && t.due === date);

  const selectedEvents = eventsOn(selected).sort((a, b) =>
    (a.time ?? '').localeCompare(b.time ?? ''),
  );
  const selectedTasks = tasksOn(selected);

  function remove(event: CalendarEvent) {
    setEvents((prev) => prev.filter((x) => x.id !== event.id));
    showUndo(`Deleted "${event.title}"`, () => setEvents((prev) => [...prev, event]));
  }

  function downloadICS() {
    const blob = new Blob([exportICS(events)], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lifehub-calendar.ics';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportICS(file: File) {
    const imported = importICS(await file.text());
    if (imported.length === 0) return;
    setEvents((prev) => [...prev, ...imported]);
    showUndo(`Imported ${imported.length} event${imported.length > 1 ? 's' : ''}`, () =>
      setEvents((prev) => prev.filter((e) => !imported.some((i) => i.id === e.id))),
    );
  }

  // Sunday-start week containing `selected`, for week mode.
  const weekDates: string[] = (() => {
    const [y, m, d] = selected.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    base.setDate(base.getDate() - base.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(base);
      dd.setDate(base.getDate() + i);
      return toDateStr(dd);
    });
  })();

  function shiftWeek(delta: number) {
    const [y, m, d] = selected.split('-').map(Number);
    const dd = new Date(y, m - 1, d);
    dd.setDate(dd.getDate() + delta * 7);
    setSelected(toDateStr(dd));
    setCursor(new Date(dd.getFullYear(), dd.getMonth(), 1));
  }

  return (
    <div className="view">
      <header className="view-header row">
        <h1 className="grow">Calendar</h1>
        <div className="filter-row" style={{ marginBottom: 0 }}>
          {(['month', 'week'] as const).map((m) => (
            <button
              key={m}
              className={`chip ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <button className="icon-btn" aria-label="Export calendar (.ics)" title="Export .ics" onClick={downloadICS}>
          <Download size={15} strokeWidth={1.5} />
        </button>
        <button
          className="icon-btn"
          aria-label="Import calendar (.ics)"
          title="Import .ics"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={15} strokeWidth={1.5} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".ics,text/calendar"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportICS(file);
            e.target.value = '';
          }}
        />
      </header>

      {mode === 'month' ? (
        <>
          <div className="cal-nav">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month">
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <strong>
              {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </strong>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month">
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
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
                    {eventsOn(date)
                      .slice(0, 3)
                      .map((e) => (
                        <span key={e.id} className="dot" style={{ background: e.color }} />
                      ))}
                    {tasksOn(date).length > 0 && <span className="dot dot-task" />}
                  </div>
                </button>
              ),
            )}
          </div>
        </>
      ) : (
        <>
          <div className="cal-nav">
            <button onClick={() => shiftWeek(-1)} aria-label="Previous week">
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <strong>
              {formatDate(weekDates[0])} – {formatDate(weekDates[6])}
            </strong>
            <button onClick={() => shiftWeek(1)} aria-label="Next week">
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="week-list">
            {weekDates.map((date) => {
              const dayEvents = eventsOn(date).sort((a, b) =>
                (a.time ?? '').localeCompare(b.time ?? ''),
              );
              const dayTasks = tasksOn(date);
              return (
                <button
                  key={date}
                  className={`card week-day ${date === selected ? 'selected-day' : ''} ${date === today ? 'today-day' : ''}`}
                  onClick={() => setSelected(date)}
                >
                  <span className={`week-day-label ${date === today ? 'accent' : 'muted'}`}>
                    {formatDate(date)}
                  </span>
                  {dayEvents.length === 0 && dayTasks.length === 0 ? (
                    <span className="muted small">—</span>
                  ) : (
                    <span className="week-day-items">
                      {dayEvents.map((e) => (
                        <span key={e.id} className="small">
                          <span className="dot" style={{ background: e.color }} />
                          {e.time ? `${formatTime(e.time)} ` : ''}
                          {e.title}
                        </span>
                      ))}
                      {dayTasks.map((t) => (
                        <span key={t.id} className="small muted">
                          <CheckSquare size={11} strokeWidth={1.5} /> {t.text}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      <section className="card">
        <h2>{formatDate(selected)}</h2>
        {selectedEvents.length === 0 && selectedTasks.length === 0 && (
          <p className="muted">Nothing on this day.</p>
        )}
        <ul className="plain-list">
          {selectedEvents.map((e) =>
            editingId === e.id ? (
              <li key={e.id}>
                <EventForm
                  initial={{
                    title: e.title,
                    time: e.time ?? '',
                    notes: e.notes ?? '',
                    color: e.color,
                    repeat: e.repeat ?? '',
                  }}
                  submitLabel="Save"
                  onSubmit={(s) => {
                    setEvents((prev) =>
                      prev.map((x) =>
                        x.id === e.id
                          ? {
                              ...x,
                              title: s.title,
                              time: s.time || undefined,
                              notes: s.notes || undefined,
                              color: s.color,
                              repeat: s.repeat || undefined,
                            }
                          : x,
                      ),
                    );
                    setEditingId(null);
                  }}
                />
              </li>
            ) : (
              <li key={e.id} className="row event-row">
                <span className="dot" style={{ background: e.color }} />
                <span className="grow">
                  {e.time && <strong>{formatTime(e.time)} · </strong>}
                  {e.title}
                  {e.repeat && <span className="badge">{e.repeat}</span>}
                  {e.notes && <div className="muted small">{e.notes}</div>}
                </span>
                <button
                  className="icon-btn"
                  aria-label="Edit event"
                  onClick={() => setEditingId(e.id)}
                >
                  <Pencil size={14} strokeWidth={1.5} />
                </button>
                <button className="icon-btn" aria-label="Delete event" onClick={() => remove(e)}>
                  <X size={15} strokeWidth={1.5} />
                </button>
              </li>
            ),
          )}
          {selectedTasks.map((t) => (
            <li key={t.id} className="row muted">
              <CheckSquare size={14} strokeWidth={1.5} />
              <span className="grow">{t.text}</span>
              <span className="badge">task</span>
            </li>
          ))}
        </ul>

        {editingId === null && (
          <EventForm
            initial={EMPTY_FORM}
            submitLabel="Add"
            onSubmit={(s) =>
              setEvents((prev) => [
                ...prev,
                {
                  id: uid(),
                  title: s.title,
                  date: selected,
                  time: s.time || undefined,
                  notes: s.notes || undefined,
                  color: s.color,
                  repeat: s.repeat || undefined,
                },
              ])
            }
          />
        )}
      </section>
    </div>
  );
}
