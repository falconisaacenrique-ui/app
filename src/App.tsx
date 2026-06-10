import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  CheckSquare,
  Flame,
  LayoutDashboard,
  Plus,
  Search as SearchIcon,
  Settings as SettingsIcon,
  StickyNote,
  Wallet,
} from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { nextDatetime } from './recurrence';
import { parseQuickAdd } from './quickadd';
import { todayStr, uid } from './utils';
import type {
  CalendarEvent,
  Expense,
  Habit,
  Note,
  Reminder,
  Settings,
  Task,
  View,
} from './types';
import Dashboard from './views/Dashboard';
import Calendar from './views/Calendar';
import Tasks from './views/Tasks';
import Notes from './views/Notes';
import Reminders from './views/Reminders';
import Habits from './views/Habits';
import Budget from './views/Budget';
import SearchView from './views/Search';
import SettingsView from './views/Settings';

const NAV: { view: View; label: string; icon: typeof Bell }[] = [
  { view: 'dashboard', label: 'Today', icon: LayoutDashboard },
  { view: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { view: 'tasks', label: 'Tasks', icon: CheckSquare },
  { view: 'notes', label: 'Notes', icon: StickyNote },
  { view: 'reminders', label: 'Reminders', icon: Bell },
  { view: 'habits', label: 'Habits', icon: Flame },
  { view: 'budget', label: 'Budget', icon: Wallet },
  { view: 'search', label: 'Search', icon: SearchIcon },
  { view: 'settings', label: 'Settings', icon: SettingsIcon },
];

const VIEWS = new Set<string>(NAV.map((n) => n.view));

function viewFromHash(): View {
  const v = window.location.hash.replace(/^#\/?/, '');
  return (VIEWS.has(v) ? v : 'dashboard') as View;
}

/** Notify via the service worker when available (required on Android), else directly. */
async function notify(body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification('LifeHub reminder', { body });
      return;
    }
  } catch {
    // fall through to direct notification
  }
  try {
    new Notification('LifeHub reminder', { body });
  } catch {
    // notification not available in this context
  }
}

export interface UndoToast {
  message: string;
  undo: () => void;
}

export default function App() {
  const [view, setViewState] = useState<View>(viewFromHash);
  const [events, setEvents] = useLocalStorage<CalendarEvent[]>('lifehub.events', []);
  const [notes, setNotes] = useLocalStorage<Note[]>('lifehub.notes', []);
  const [reminders, setReminders] = useLocalStorage<Reminder[]>('lifehub.reminders', []);
  const [tasks, setTasks] = useLocalStorage<Task[]>('lifehub.tasks', []);
  const [habits, setHabits] = useLocalStorage<Habit[]>('lifehub.habits', []);
  const [expenses, setExpenses] = useLocalStorage<Expense[]>('lifehub.expenses', []);
  const [budget, setBudget] = useLocalStorage<number>('lifehub.budget', 0);
  const [settings, setSettings] = useLocalStorage<Settings>('lifehub.settings', {
    currency: 'USD',
  });
  const [toast, setToast] = useState<UndoToast | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hash-based routing so views are linkable and the back button works.
  useEffect(() => {
    const onHash = () => setViewState(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setView = useCallback((v: View) => {
    window.location.hash = `/${v}`;
  }, []);

  const showUndo = useCallback((message: string, undo: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  // Reminder engine: fire due notifications (side effects outside the state
  // updater), then mark notified or advance repeating reminders.
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const due = reminders.filter(
        (r) => !r.done && !r.notified && new Date(r.datetime).getTime() <= now.getTime(),
      );
      if (due.length === 0) return;
      for (const r of due) void notify(r.text);
      const dueIds = new Set(due.map((r) => r.id));
      setReminders((prev) =>
        prev.map((r) => {
          if (!dueIds.has(r.id)) return r;
          if (r.repeat) {
            return { ...r, datetime: nextDatetime(r.datetime, r.repeat, now), notified: false };
          }
          return { ...r, notified: true };
        }),
      );
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [reminders, setReminders]);

  function submitQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseQuickAdd(quickAddText);
    if (!parsed.text) return;
    if (parsed.kind === 'reminder') {
      setReminders((prev) => [
        ...prev,
        {
          id: uid(),
          text: parsed.text,
          datetime: `${parsed.date}T${parsed.time}`,
          done: false,
          notified: false,
        },
      ]);
      setView('reminders');
    } else if (parsed.kind === 'event') {
      setEvents((prev) => [
        ...prev,
        {
          id: uid(),
          title: parsed.text,
          date: parsed.date ?? todayStr(),
          time: parsed.time,
          color: '#4f46e5',
        },
      ]);
      setView('calendar');
    } else {
      setTasks((prev) => [
        ...prev,
        {
          id: uid(),
          text: parsed.text,
          done: false,
          due: parsed.date,
          priority: 'medium',
          createdAt: Date.now(),
        },
      ]);
      setView('tasks');
    }
    setQuickAddText('');
    setQuickAddOpen(false);
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name">LifeHub</span>
        </div>
        {NAV.map(({ view: v, label, icon: Icon }) => (
          <button
            key={v}
            className={`nav-item ${view === v ? 'active' : ''}`}
            aria-current={view === v ? 'page' : undefined}
            onClick={() => setView(v)}
          >
            <Icon className="nav-icon" size={18} strokeWidth={1.5} />
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>

      <main className="main">
        {view === 'dashboard' && (
          <Dashboard
            events={events}
            tasks={tasks}
            setTasks={setTasks}
            reminders={reminders}
            habits={habits}
            expenses={expenses}
            budget={budget}
            currency={settings.currency}
            onNavigate={setView}
          />
        )}
        {view === 'calendar' && (
          <Calendar events={events} setEvents={setEvents} tasks={tasks} showUndo={showUndo} />
        )}
        {view === 'tasks' && <Tasks tasks={tasks} setTasks={setTasks} showUndo={showUndo} />}
        {view === 'notes' && <Notes notes={notes} setNotes={setNotes} showUndo={showUndo} />}
        {view === 'reminders' && (
          <Reminders reminders={reminders} setReminders={setReminders} showUndo={showUndo} />
        )}
        {view === 'habits' && (
          <Habits habits={habits} setHabits={setHabits} showUndo={showUndo} />
        )}
        {view === 'budget' && (
          <Budget
            expenses={expenses}
            setExpenses={setExpenses}
            budget={budget}
            setBudget={setBudget}
            currency={settings.currency}
            showUndo={showUndo}
          />
        )}
        {view === 'search' && (
          <SearchView
            events={events}
            tasks={tasks}
            notes={notes}
            reminders={reminders}
            expenses={expenses}
            currency={settings.currency}
            onNavigate={setView}
          />
        )}
        {view === 'settings' && (
          <SettingsView settings={settings} setSettings={setSettings} />
        )}
      </main>

      <button
        className="fab"
        aria-label="Quick add"
        onClick={() => setQuickAddOpen(true)}
      >
        <Plus size={22} strokeWidth={1.5} />
      </button>

      {quickAddOpen && (
        <div className="modal-backdrop" onClick={() => setQuickAddOpen(false)}>
          <form
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitQuickAdd}
          >
            <input
              autoFocus
              value={quickAddText}
              onChange={(e) => setQuickAddText(e.target.value)}
              placeholder='Try "dentist tomorrow 3pm" or "remind me to call mom 9am"'
            />
            <p className="muted small">
              Times become events, "remind…" becomes a reminder, everything else a task.
            </p>
            <button type="submit" className="primary">
              Add
            </button>
          </form>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          <button
            onClick={() => {
              toast.undo();
              setToast(null);
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
