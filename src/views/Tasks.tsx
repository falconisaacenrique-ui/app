import { useState } from 'react';
import type { Priority, Task } from '../types';
import { formatDate, todayStr, uid } from '../utils';

interface Props {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export default function Tasks({ tasks, setTasks }: Props) {
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');

  const today = todayStr();

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setTasks((prev) => [
      ...prev,
      {
        id: uid(),
        text: text.trim(),
        done: false,
        due: due || undefined,
        priority,
        createdAt: Date.now(),
      },
    ]);
    setText('');
    setDue('');
  }

  const visible = tasks
    .filter((t) =>
      filter === 'all' ? true : filter === 'active' ? !t.done : t.done,
    )
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

      <form onSubmit={addTask} className="inline-form card">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What needs doing?"
        />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button type="submit" className="primary">
          Add
        </button>
      </form>

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
        {visible.map((t) => (
          <li key={t.id} className={`card row task ${t.done ? 'done' : ''}`}>
            <input
              type="checkbox"
              checked={t.done}
              onChange={() =>
                setTasks((prev) =>
                  prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)),
                )
              }
            />
            <span className="grow">
              {t.text}
              <span className={`badge prio-${t.priority}`}>{t.priority}</span>
              {t.due && (
                <span className={`badge ${!t.done && t.due < today ? 'overdue' : ''}`}>
                  {!t.done && t.due < today ? 'overdue · ' : ''}
                  {formatDate(t.due)}
                </span>
              )}
            </span>
            <button
              className="icon-btn"
              aria-label="Delete task"
              onClick={() => setTasks((prev) => prev.filter((x) => x.id !== t.id))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
