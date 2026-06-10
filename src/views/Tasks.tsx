import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { nextDate, REPEAT_LABELS } from '../recurrence';
import type { Priority, Repeat, Task } from '../types';
import { formatDate, todayStr, uid } from '../utils';
import type { UndoToast } from '../App';

interface Props {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  showUndo: (message: string, undo: UndoToast['undo']) => void;
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

interface TaskFormState {
  text: string;
  due: string;
  priority: Priority;
  repeat: '' | Repeat;
}

function TaskForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: TaskFormState;
  submitLabel: string;
  onSubmit: (state: TaskFormState) => void;
}) {
  const [state, setState] = useState(initial);
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!state.text.trim()) return;
        onSubmit({ ...state, text: state.text.trim() });
        setState(initial);
      }}
    >
      <input
        value={state.text}
        onChange={(e) => setState({ ...state, text: e.target.value })}
        placeholder="What needs doing?"
      />
      <input
        type="date"
        value={state.due}
        onChange={(e) => setState({ ...state, due: e.target.value })}
      />
      <select
        value={state.priority}
        onChange={(e) => setState({ ...state, priority: e.target.value as Priority })}
      >
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
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
      <button type="submit" className="primary">
        {submitLabel}
      </button>
    </form>
  );
}

export default function Tasks({ tasks, setTasks, showUndo }: Props) {
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const today = todayStr();

  function toggle(task: Task) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== task.id) return t;
        // Completing a repeating task reschedules it instead of finishing it.
        if (!t.done && t.repeat && t.due) {
          return { ...t, due: nextDate(t.due, t.repeat, today >= t.due ? today : t.due) };
        }
        return { ...t, done: !t.done };
      }),
    );
  }

  function remove(task: Task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    showUndo(`Deleted "${task.text}"`, () => setTasks((prev) => [...prev, task]));
  }

  const visible = tasks
    .filter((t) => (filter === 'all' ? true : filter === 'active' ? !t.done : t.done))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const dueA = a.due ?? '9999';
      const dueB = b.due ?? '9999';
      if (dueA !== dueB) return dueA.localeCompare(dueB);
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });

  return (
    <div className="view">
      <header className="view-header">
        <h1>Tasks</h1>
      </header>

      <div className="card">
        <TaskForm
          initial={{ text: '', due: '', priority: 'medium', repeat: '' }}
          submitLabel="Add"
          onSubmit={(s) =>
            setTasks((prev) => [
              ...prev,
              {
                id: uid(),
                text: s.text,
                done: false,
                due: s.due || undefined,
                priority: s.priority,
                repeat: s.repeat || undefined,
                createdAt: Date.now(),
              },
            ])
          }
        />
      </div>

      <div className="filter-row">
        {(['all', 'active', 'done'] as const).map((f) => (
          <button
            key={f}
            className={`chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {visible.length === 0 && <p className="muted">No tasks here.</p>}
      <ul className="plain-list">
        {visible.map((t) =>
          editingId === t.id ? (
            <li key={t.id} className="card">
              <TaskForm
                initial={{
                  text: t.text,
                  due: t.due ?? '',
                  priority: t.priority,
                  repeat: t.repeat ?? '',
                }}
                submitLabel="Save"
                onSubmit={(s) => {
                  setTasks((prev) =>
                    prev.map((x) =>
                      x.id === t.id
                        ? {
                            ...x,
                            text: s.text,
                            due: s.due || undefined,
                            priority: s.priority,
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
            <li key={t.id} className={`card row task ${t.done ? 'done' : ''}`}>
              <input type="checkbox" checked={t.done} onChange={() => toggle(t)} />
              <span className="grow">
                {t.text}
                <span className={`badge prio-${t.priority}`}>{t.priority}</span>
                {t.repeat && <span className="badge">{t.repeat}</span>}
                {t.due && (
                  <span className={`badge ${!t.done && t.due < today ? 'overdue' : ''}`}>
                    {!t.done && t.due < today ? 'overdue · ' : ''}
                    {formatDate(t.due)}
                  </span>
                )}
              </span>
              <button className="icon-btn" aria-label="Edit task" onClick={() => setEditingId(t.id)}>
                <Pencil size={14} strokeWidth={1.5} />
              </button>
              <button className="icon-btn" aria-label="Delete task" onClick={() => remove(t)}>
                <X size={15} strokeWidth={1.5} />
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
