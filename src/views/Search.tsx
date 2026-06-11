import { useMemo, useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  CheckSquare,
  StickyNote,
  Wallet,
} from 'lucide-react';
import { SearchIndex } from '../searchengine';
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
  const q = query.trim();

  // Inverted index with TF-IDF ranking and trigram fuzzy matching — typos welcome.
  const { index, byId } = useMemo(() => {
    const all: Result[] = [
      ...notes.map((n) => ({
        id: `n-${n.id}`,
        view: 'notes' as View,
        icon: StickyNote,
        label: n.title || 'Untitled',
        detail: n.content.slice(0, 80),
        text: `${n.title} ${n.content}`,
      })),
      ...tasks.map((t) => ({
        id: `t-${t.id}`,
        view: 'tasks' as View,
        icon: CheckSquare,
        label: t.text,
        detail: t.due ? formatDate(t.due) : undefined,
        text: t.text,
      })),
      ...events.map((e) => ({
        id: `e-${e.id}`,
        view: 'calendar' as View,
        icon: CalendarIcon,
        label: e.title,
        detail: formatDate(e.date),
        text: `${e.title} ${e.notes ?? ''}`,
      })),
      ...reminders.map((r) => ({
        id: `r-${r.id}`,
        view: 'reminders' as View,
        icon: Bell,
        label: r.text,
        detail: formatDateTime(r.datetime),
        text: r.text,
      })),
      ...expenses.map((e) => ({
        id: `x-${e.id}`,
        view: 'budget' as View,
        icon: Wallet,
        label: e.description,
        detail: `${formatMoney(e.amount, currency)} · ${formatDate(e.date)}`,
        text: `${e.description} ${e.category}`,
      })),
    ];
    return {
      index: new SearchIndex(all.map((r) => ({ id: r.id, text: (r as Result & { text: string }).text }))),
      byId: new Map(all.map((r) => [r.id, r])),
    };
  }, [notes, tasks, events, reminders, expenses, currency]);

  const results: Result[] = !q
    ? []
    : index
        .search(q)
        .map((hit) => byId.get(hit.id))
        .filter((r): r is Result => r !== undefined);

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
