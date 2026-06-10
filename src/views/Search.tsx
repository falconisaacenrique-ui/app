import { useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  CheckSquare,
  StickyNote,
  Wallet,
} from 'lucide-react';
import type { CalendarEvent, Expense, Note, Reminder, Task, View } from '../types';
import { formatDate, formatDateTime, formatMoney } from '../utils';

interface Props {
  events: CalendarEvent[];
  tasks: Task[];
  notes: Note[];
  reminders: Reminder[];
  expenses: Expense[];
  currency: string;
  onNavigate: (view: View) => void;
}

interface Result {
  id: string;
  view: View;
  icon: typeof Bell;
  label: string;
  detail?: string;
}

export default function Search({
  events,
  tasks,
  notes,
  reminders,
  expenses,
  currency,
  onNavigate,
}: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const matches = (...fields: (string | undefined)[]) =>
    fields.some((f) => f?.toLowerCase().includes(q));

  const results: Result[] = !q
    ? []
    : [
        ...notes
          .filter((n) => matches(n.title, n.content))
          .map((n) => ({
            id: `n-${n.id}`,
            view: 'notes' as View,
            icon: StickyNote,
            label: n.title || 'Untitled',
            detail: n.content.slice(0, 80),
          })),
        ...tasks
          .filter((t) => matches(t.text))
          .map((t) => ({
            id: `t-${t.id}`,
            view: 'tasks' as View,
            icon: CheckSquare,
            label: t.text,
            detail: t.due ? formatDate(t.due) : undefined,
          })),
        ...events
          .filter((e) => matches(e.title, e.notes))
          .map((e) => ({
            id: `e-${e.id}`,
            view: 'calendar' as View,
            icon: CalendarIcon,
            label: e.title,
            detail: formatDate(e.date),
          })),
        ...reminders
          .filter((r) => matches(r.text))
          .map((r) => ({
            id: `r-${r.id}`,
            view: 'reminders' as View,
            icon: Bell,
            label: r.text,
            detail: formatDateTime(r.datetime),
          })),
        ...expenses
          .filter((e) => matches(e.description, e.category))
          .map((e) => ({
            id: `x-${e.id}`,
            view: 'budget' as View,
            icon: Wallet,
            label: e.description,
            detail: `${formatMoney(e.amount, currency)} · ${formatDate(e.date)}`,
          })),
      ];

  return (
    <div className="view">
      <header className="view-header">
        <h1>Search</h1>
      </header>

      <div className="card inline-form">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes, tasks, events, reminders, expenses…"
        />
      </div>

      {q && results.length === 0 && <p className="muted">No matches for “{query}”.</p>}
      <ul className="plain-list">
        {results.map((r) => {
          const Icon = r.icon;
          return (
            <li key={r.id}>
              <button className="card row search-result" onClick={() => onNavigate(r.view)}>
                <Icon size={15} strokeWidth={1.5} className="muted" />
                <span className="grow">
                  {r.label}
                  {r.detail && <div className="muted small">{r.detail}</div>}
                </span>
                <span className="badge">{r.view}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
