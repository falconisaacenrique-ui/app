import { useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, Pencil, X } from 'lucide-react';
import Check from '../components/Check';
import CycleChip from '../components/CycleChip';
import SwipeRow from '../components/SwipeRow';
import { nextDate, REPEAT_LABELS } from '../recurrence';
import { parseQuickAdd } from '../quickadd';
import type { Priority, Repeat, Task } from '../types';
import { formatDate, todayStr, uid } from '../utils';
import type { UndoToast } from '../App';

interface Props {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  showUndo: (message: string, undo: NonNullable<UndoToast['undo']>) => void;
  showToast: (message: string) => void;
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const PRIORITIES = ['medium', 'high', 'low'] as const;
const REPEATS = ['', 'daily', 'weekly', 'monthly'] as const;
const DURATIONS = ['30', '15', '45', '60', '90'] as const;

function repeatLabel(r: '' | Repeat): string {
  return REPEAT_LABELS.find((x) => x.value === r)?.label ?? 'Once';
}

/** Single smart input + chips — type "gym friday" and the date is parsed for you. */
function SmartAddTask({ onAdd }: { onAdd: (t: Omit<Task, 'id' | 'createdAt'>) => void }) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [repeat, setRepeat] = useState<'' | Repeat>('');
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>('30');
  const [due, setDue] = useState('');
  const [showDate, setShowDate] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseQuickAdd(text);
    if (!parsed.text.trim()) return;
    onAdd({
      text: parsed.text,
      done: false,
      due: due || parsed.date || undefined,
      priority,
      repeat: repeat || parsed.repeat || undefined,
      duration: Number(duration),
    });
    setText('');
    setDue('');
    setShowDate(false);
  }

  return (
    <form className="smart-add card" onSubmit={submit}>
      <div className="row">
        <input
          className="grow"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task…"
          aria-label="New task"
        />
        <button type="submit" className="primary">
          Add
        </button>
      </div>
      <div className="chip-row">
        <button
          type="button"
          className={`chip ${due ? 'active' : ''}`}
          onClick={() => setShowDate((s) => !s)}
        >
          <CalendarDays size={13} strokeWidth={1.5} />
          {due ? formatDate(due) : 'Date'}
        </button>
        {showDate && (
          <input
            type="date"
            value={due}
            autoFocus
            onChange={(e) => {
              setDue(e.target.value);
              setShowDate(false);
            }}
          />
        )}
        <CycleChip
          value={priority}
          options={PRIORITIES}
          format={(p) => p}
          label="Priority"
          active={priority !== 'medium'}
          onChange={setPriority}
        />
        <CycleChip
          value={repeat}
          options={REPEATS}
          format={repeatLabel}
          label="Repeat"
          active={repeat !== ''}
          onChange={setRepeat}
        />
        <CycleChip
          value={duration}
          options={DURATIONS}
          format={(d) => `${d} min`}
          label="Duration (for the planner)"
          active={duration !== '30'}
          onChange={setDuration}
        />
      </div>
      <p className="hint muted small">
        Tip: type it naturally — <em>buy groceries friday</em>, <em>gym every monday</em>
      </p>
    </form>
  );
}

function EditTaskForm({
  task,
  onSave,
}: {
  task: Task;
  onSave: (patch: Partial<Task>) => void;
}) {
  const [text, setText] = useState(task.text);
  const [due, setDue] = useState(task.due ?? '');
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [repeat, setRepeat] = useState<'' | Repeat>(task.repeat ?? '');
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSave({
          text: text.trim(),
          due: due || undefined,
          priority,
          repeat: repeat || undefined,
        });
      }}
    >
      <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Task text" />
      <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select value={repeat} onChange={(e) => setRepeat(e.target.value as '' | Repeat)}>
        {REPEAT_LABELS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <button type="submit" className="primary">
        Save
      </button>
    </form>
  );
}

export default function Tasks({ tasks, setTasks, showUndo, showToast }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const today = todayStr();

  function complete(task: Task) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== task.id) return t;
        // Completing a repeating task reschedules it instead of finishing it.
        if (!t.done && t.repeat && t.due) {
          return { ...t, due: nextDate(t.due, t.repeat, today >= t.due ? today : t.due) };
        }
        return { ...t, done: !t.done, doneAt: t.done ? undefined : Date.now() };
      }),
    );
    if (!task.done && task.repeat && task.due) {
      showToast(`Rescheduled — repeats ${task.repeat}`);
    }
  }

  function remove(task: Task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    showUndo(`Deleted "${task.text}"`, () => setTasks((prev) => [...prev, task]));
  }

  function clearCompleted() {
    const done = tasks.filter((t) => t.done);
    if (done.length === 0) return;
    setTasks((prev) => prev.filter((t) => !t.done));
    showUndo(`Cleared ${done.length} completed`, () => setTasks((prev) => [...prev, ...done]));
  }

  const open = tasks.filter((t) => !t.done);
  const sortOpen = (list: Task[]) =>
    [...list].sort((a, b) => {
      const dueA = a.due ?? '9999';
      const dueB = b.due ?? '9999';
      if (dueA !== dueB) return dueA.localeCompare(dueB);
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });

  const groups: { label: string; items: Task[]; tone?: 'warn' }[] = [
    { label: 'Overdue', items: sortOpen(open.filter((t) => t.due && t.due < today)), tone: 'warn' },
    { label: 'Today', items: sortOpen(open.filter((t) => t.due === today)) },
    { label: 'Upcoming', items: sortOpen(open.filter((t) => t.due && t.due > today)) },
    { label: 'Anytime', items: sortOpen(open.filter((t) => !t.due)) },
  ];
  const completed = [...tasks.filter((t) => t.done)].sort(
    (a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0),
  );

  const renderTask = (t: Task) =>
    editingId === t.id ? (
      <li key={t.id} className="card">
        <EditTaskForm
          task={t}
          onSave={(patch) => {
            setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
            setEditingId(null);
          }}
        />
      </li>
    ) : (
      <li key={t.id} className="list-enter">
        <SwipeRow onSwipeRight={() => complete(t)} onSwipeLeft={() => remove(t)}>
          <div className={`card row task ${t.done ? 'done' : ''}`}>
            <Check checked={t.done} onToggle={() => complete(t)} label={`Complete ${t.text}`} />
            <span className="grow">
              {t.text}
              {t.priority !== 'medium' && (
                <span className={`badge prio-${t.priority}`}>{t.priority}</span>
              )}
              {t.repeat && <span className="badge">{t.repeat}</span>}
              {t.due && (
                <span className={`badge ${!t.done && t.due < today ? 'overdue' : ''}`}>
                  {formatDate(t.due)}
                </span>
              )}
            </span>
            <button className="icon-btn" aria-label="Edit task" onClick={() => setEditingId(t.id)}>
              <Pencil size={15} strokeWidth={1.5} />
            </button>
            <button className="icon-btn" aria-label="Delete task" onClick={() => remove(t)}>
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        </SwipeRow>
      </li>
    );

  return (
    <div className="view">
      <header className="view-header">
        <h1>Tasks</h1>
        {open.length > 0 && (
          <p className="muted">
            {open.length} open · swipe right to complete, left to delete
          </p>
        )}
      </header>

      <SmartAddTask
        onAdd={(t) => {
          setTasks((prev) => [...prev, { ...t, id: uid(), createdAt: Date.now() }]);
        }}
      />

      {open.length === 0 && completed.length === 0 && (
        <p className="muted empty-note">Nothing here yet — add your first task above.</p>
      )}

      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.label} className="task-group">
              <h3 className={`group-label ${g.tone ?? ''}`}>
                {g.label} <span className="muted">{g.items.length}</span>
              </h3>
              <ul className="plain-list">{g.items.map(renderTask)}</ul>
            </section>
          ),
      )}

      {completed.length > 0 && (
        <section className="task-group">
          <div className="row">
            <button
              className="group-label as-button grow"
              onClick={() => setShowCompleted((s) => !s)}
              aria-expanded={showCompleted}
            >
              {showCompleted ? (
                <ChevronDown size={14} strokeWidth={1.5} />
              ) : (
                <ChevronRight size={14} strokeWidth={1.5} />
              )}
              Completed <span className="muted">{completed.length}</span>
            </button>
            <button className="chip" onClick={clearCompleted}>
              Clear
            </button>
          </div>
          {showCompleted && <ul className="plain-list">{completed.map(renderTask)}</ul>}
        </section>
      )}
    </div>
  );
}
