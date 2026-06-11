import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Bell,
  Calendar as CalendarIcon,
  CalendarRange,
  CheckSquare,
  ClipboardList,
  Flame,
  GraduationCap,
  History as HistoryIcon,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Sprout,
  StickyNote,
  Wallet,
  X,
} from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { nextDatetime } from './recurrence';
import { parseQuickAdd } from './quickadd';
import { fireRules, parseRules } from './dsl';
import {
  diffCollections,
  JOURNAL_CAP,
  type EntityKind,
  type JournalEvent,
} from './journal';
import type { Fact } from './sm2';
import { streak, todayStr, uid } from './utils';
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
import Review from './views/Review';
import PlanView from './views/Plan';
import Insights from './views/Insights';
import Garden from './views/Garden';
import Remember from './views/Remember';
import History from './views/History';

interface NavItem {
  view: View;
  label: string;
  icon: typeof Bell;
}

const PRIMARY_NAV: NavItem[] = [
  { view: 'dashboard', label: 'Today', icon: LayoutDashboard },
  { view: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { view: 'tasks', label: 'Tasks', icon: CheckSquare },
  { view: 'habits', label: 'Habits', icon: Flame },
];

const MORE_NAV: NavItem[] = [
  { view: 'plan', label: 'Plan', icon: CalendarRange },
  { view: 'insights', label: 'Insights', icon: BarChart3 },
  { view: 'garden', label: 'Garden', icon: Sprout },
  { view: 'notes', label: 'Notes', icon: StickyNote },
  { view: 'reminders', label: 'Reminders', icon: Bell },
  { view: 'budget', label: 'Budget', icon: Wallet },
  { view: 'remember', label: 'Remember', icon: GraduationCap },
  { view: 'review', label: 'Weekly review', icon: ClipboardList },
  { view: 'history', label: 'History', icon: HistoryIcon },
  { view: 'search', label: 'Search', icon: SearchIcon },
  { view: 'settings', label: 'Settings', icon: SettingsIcon },
];

const VIEWS = new Set<string>([...PRIMARY_NAV, ...MORE_NAV].map((n) => n.view));

const SHORTCUT_VIEWS: Record<string, View> = {
  d: 'dashboard',
  c: 'calendar',
  t: 'tasks',
  h: 'habits',
  n: 'notes',
  r: 'reminders',
  b: 'budget',
  w: 'review',
  s: 'settings',
  p: 'plan',
  i: 'insights',
  g: 'garden',
  m: 'remember',
  y: 'history',
};

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
  undo?: () => void;
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
  const [facts, setFacts] = useLocalStorage<Fact[]>('lifehub.facts', []);
  const [journal, setJournal] = useLocalStorage<JournalEvent[]>('lifehub.journal', []);
  const [rulesText, setRulesText] = useLocalStorage<string>('lifehub.rules', '');
  const [ruleFires, setRuleFires] = useLocalStorage<Record<string, string>>('lifehub.ruleFires', {});
  const [settings, setSettings] = useLocalStorage<Settings>('lifehub.settings', {
    currency: 'USD',
  });
  const [toast, setToast] = useState<UndoToast | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingG = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hash-based routing so views are linkable and the back button works.
  useEffect(() => {
    const onHash = () => {
      setViewState(viewFromHash());
      setQuickAddOpen(false);
      setMoreOpen(false);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setView = useCallback((v: View) => {
    setMoreOpen(false);
    if (viewFromHash() === v) return;
    window.location.hash = `/${v}`;
  }, []);

  // Manual theme override; 'system' (or unset) follows the OS preference.
  useEffect(() => {
    const theme = settings.theme ?? 'system';
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [settings.theme]);

  const showToast = useCallback((message: string, undo?: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const showUndo = useCallback(
    (message: string, undo: () => void) => showToast(message, undo),
    [showToast],
  );

  // The Time Machine: journal every change by diffing collections.
  const prevCollections = useRef<{
    task: Task[];
    event: CalendarEvent[];
    note: Note[];
    reminder: Reminder[];
    habit: Habit[];
    expense: Expense[];
    fact: Fact[];
  } | null>(null);
  useEffect(() => {
    const current = {
      task: tasks,
      event: events,
      note: notes,
      reminder: reminders,
      habit: habits,
      expense: expenses,
      fact: facts,
    };
    const prev = prevCollections.current;
    prevCollections.current = current;
    if (!prev) return;
    const ts = Date.now();
    const changes: JournalEvent[] = [
      ...diffCollections('task', prev.task, tasks, (t) => t.text, ts),
      ...diffCollections('event', prev.event, events, (e) => e.title, ts),
      ...diffCollections('note', prev.note, notes, (n) => n.title || 'Untitled', ts),
      ...diffCollections('reminder', prev.reminder, reminders, (r) => r.text, ts),
      ...diffCollections('habit', prev.habit, habits, (h) => h.name, ts),
      ...diffCollections('expense', prev.expense, expenses, (e) => e.description, ts),
      ...diffCollections('fact', prev.fact, facts, (f) => f.front, ts),
    ];
    if (changes.length > 0) {
      setJournal((j) => [...j, ...changes].slice(-JOURNAL_CAP));
    }
  }, [tasks, events, notes, reminders, habits, expenses, facts, setJournal]);

  // The rules engine: user-written rules fire at most once per rule per day.
  useEffect(() => {
    const { rules } = parseRules(rulesText);
    if (rules.length === 0) return;
    const today = todayStr();
    const month = today.slice(0, 7);
    const ctx = {
      habitStreak: (name: string) => {
        const habit = habits.find((h) => h.name.toLowerCase() === name.toLowerCase());
        return habit ? streak(habit.doneDates) : 0;
      },
      tasksOverdue: tasks.filter((t) => !t.done && t.due && t.due < today).length,
      spentThisMonth: expenses
        .filter((e) => e.date.startsWith(month))
        .reduce((s, e) => s + e.amount, 0),
      allHabitsDoneToday:
        habits.length > 0 && habits.every((h) => h.doneDates.includes(today)),
    };
    const fired = fireRules(rules, ctx).filter((r) => ruleFires[r.source] !== today);
    if (fired.length === 0) return;
    // Defer the mutations so the effect itself never sets state synchronously.
    const timer = setTimeout(() => {
      applyFired();
    }, 0);
    function applyFired() {
      for (const rule of fired) {
      const { action } = rule;
      if (action.type === 'task') {
        setTasks((prev) => [
          ...prev,
          { id: uid(), text: action.text, done: false, priority: 'medium', createdAt: Date.now() },
        ]);
      } else if (action.type === 'note') {
        setNotes((prev) => [
          { id: uid(), title: action.text, content: '', updatedAt: Date.now(), pinned: false },
          ...prev,
        ]);
      } else {
        setReminders((prev) => [
          ...prev,
          {
            id: uid(),
            text: action.text,
            datetime: `${today}T20:00`,
            done: false,
            notified: false,
          },
        ]);
      }
      }
      setRuleFires((prev) => ({
        ...prev,
        ...Object.fromEntries(fired.map((r) => [r.source, today])),
      }));
      showToast(`Rule fired: ${fired[0].action.type} "${fired[0].action.text}"`);
    }
    return () => clearTimeout(timer);
  }, [rulesText, habits, tasks, expenses, ruleFires, setRuleFires, setTasks, setNotes, setReminders, showToast]);

  // Global keyboard shortcuts: n = quick add, / = search, g+letter = go to view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        if (e.key === 'Escape') (target as HTMLInputElement).blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        setQuickAddOpen(false);
        setMoreOpen(false);
        return;
      }
      if (pendingG.current) {
        clearTimeout(pendingG.current);
        pendingG.current = null;
        const v = SHORTCUT_VIEWS[e.key];
        if (v) {
          e.preventDefault();
          setView(v);
        }
        return;
      }
      if (e.key === 'n') {
        e.preventDefault();
        setQuickAddOpen(true);
      } else if (e.key === '/') {
        e.preventDefault();
        setView('search');
      } else if (e.key === 'g') {
        pendingG.current = setTimeout(() => {
          pendingG.current = null;
        }, 1200);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setView]);

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
          repeat: parsed.repeat,
        },
      ]);
      setView('reminders');
      showToast(`Reminder set: ${parsed.text}`);
    } else if (parsed.kind === 'event') {
      setEvents((prev) => [
        ...prev,
        {
          id: uid(),
          title: parsed.text,
          date: parsed.date ?? todayStr(),
          time: parsed.time,
          color: '#4f46e5',
          repeat: parsed.repeat,
        },
      ]);
      setView('calendar');
      showToast(`Event added: ${parsed.text}`);
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
          repeat: parsed.repeat,
        },
      ]);
      setView('tasks');
      showToast(`Task added: ${parsed.text}`);
    }
    setQuickAddText('');
    setQuickAddOpen(false);
  }

  function restoreFromHistory(entity: EntityKind, item: unknown) {
    if (entity === 'task') setTasks((prev) => [...prev, item as Task]);
    else if (entity === 'event') setEvents((prev) => [...prev, item as CalendarEvent]);
    else if (entity === 'note') setNotes((prev) => [item as Note, ...prev]);
    else if (entity === 'reminder') setReminders((prev) => [...prev, item as Reminder]);
    else if (entity === 'habit') setHabits((prev) => [...prev, item as Habit]);
    else if (entity === 'expense') setExpenses((prev) => [...prev, item as Expense]);
    else if (entity === 'fact') setFacts((prev) => [...prev, item as Fact]);
    showToast('Restored.');
  }

  const navButton = ({ view: v, label, icon: Icon }: NavItem) => (
    <button
      key={v}
      className={`nav-item ${view === v ? 'active' : ''}`}
      aria-current={view === v ? 'page' : undefined}
      onClick={() => setView(v)}
    >
      <Icon className="nav-icon" size={18} strokeWidth={1.5} />
      <span className="nav-label">{label}</span>
    </button>
  );

  const moreActive = MORE_NAV.some((n) => n.view === view);
  const today = todayStr();
  const month = today.slice(0, 7);
  const overBudget =
    budget > 0 &&
    expenses.filter((e) => e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0) > budget;

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name">LifeHub</span>
        </div>
        {PRIMARY_NAV.map(navButton)}
        <div className="nav-extra">{MORE_NAV.map(navButton)}</div>
        <button
          className={`nav-item nav-more ${moreActive ? 'active' : ''}`}
          aria-label="More"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((o) => !o)}
        >
          <MoreHorizontal className="nav-icon" size={18} strokeWidth={1.5} />
          <span className="nav-label">More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="sheet" role="menu" onClick={(e) => e.stopPropagation()}>
            {MORE_NAV.map(({ view: v, label, icon: Icon }) => (
              <button
                key={v}
                role="menuitem"
                className={`sheet-item ${view === v ? 'active' : ''}`}
                onClick={() => setView(v)}
              >
                <Icon size={18} strokeWidth={1.5} />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

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
            onQuickAdd={() => setQuickAddOpen(true)}
            showToast={showToast}
          />
        )}
        {view === 'calendar' && (
          <Calendar events={events} setEvents={setEvents} tasks={tasks} showUndo={showUndo} />
        )}
        {view === 'tasks' && (
          <Tasks tasks={tasks} setTasks={setTasks} showUndo={showUndo} showToast={showToast} />
        )}
        {view === 'notes' && <Notes notes={notes} setNotes={setNotes} showUndo={showUndo} />}
        {view === 'reminders' && (
          <Reminders reminders={reminders} setReminders={setReminders} showUndo={showUndo} />
        )}
        {view === 'habits' && (
          <Habits habits={habits} setHabits={setHabits} showUndo={showUndo} showToast={showToast} />
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
          <SettingsView
            settings={settings}
            setSettings={setSettings}
            rulesText={rulesText}
            setRulesText={setRulesText}
          />
        )}
        {view === 'review' && (
          <Review
            events={events}
            tasks={tasks}
            reminders={reminders}
            habits={habits}
            expenses={expenses}
            budget={budget}
            currency={settings.currency}
          />
        )}
        {view === 'plan' && <PlanView tasks={tasks} events={events} />}
        {view === 'insights' && (
          <Insights
            tasks={tasks}
            habits={habits}
            expenses={expenses}
            budget={budget}
            currency={settings.currency}
          />
        )}
        {view === 'garden' && <Garden habits={habits} tasks={tasks} overBudget={overBudget} />}
        {view === 'remember' && (
          <Remember facts={facts} setFacts={setFacts} showUndo={showUndo} />
        )}
        {view === 'history' && (
          <History
            journal={journal}
            collections={{
              task: tasks,
              event: events,
              note: notes,
              reminder: reminders,
              habit: habits,
              expense: expenses,
            }}
            onRestore={restoreFromHistory}
          />
        )}
      </main>

      <button className="fab" aria-label="Quick add (n)" onClick={() => setQuickAddOpen(true)}>
        <Plus size={22} strokeWidth={1.5} />
      </button>

      {quickAddOpen && (
        <div className="modal-backdrop" onClick={() => setQuickAddOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submitQuickAdd}>
            <div className="row">
              <input
                autoFocus
                className="grow"
                value={quickAddText}
                onChange={(e) => setQuickAddText(e.target.value)}
                placeholder="Add anything…"
              />
              <button
                type="button"
                className="icon-btn"
                aria-label="Close"
                onClick={() => setQuickAddOpen(false)}
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
            <p className="muted small">
              Try <em>dentist tomorrow 3pm</em> · <em>gym every monday</em> ·{' '}
              <em>remind me to call mom 9am</em>
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
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo!();
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
