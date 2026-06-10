import { useEffect, useState } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import type {
  CalendarEvent,
  Expense,
  Habit,
  Note,
  Reminder,
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

const NAV: { view: View; label: string; icon: string }[] = [
  { view: 'dashboard', label: 'Home', icon: '🏠' },
  { view: 'calendar', label: 'Calendar', icon: '📅' },
  { view: 'tasks', label: 'Tasks', icon: '✅' },
  { view: 'notes', label: 'Notes', icon: '📝' },
  { view: 'reminders', label: 'Reminders', icon: '⏰' },
  { view: 'habits', label: 'Habits', icon: '🔥' },
  { view: 'budget', label: 'Budget', icon: '💰' },
];

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [events, setEvents] = useLocalStorage<CalendarEvent[]>('lifehub.events', []);
  const [notes, setNotes] = useLocalStorage<Note[]>('lifehub.notes', []);
  const [reminders, setReminders] = useLocalStorage<Reminder[]>('lifehub.reminders', []);
  const [tasks, setTasks] = useLocalStorage<Task[]>('lifehub.tasks', []);
  const [habits, setHabits] = useLocalStorage<Habit[]>('lifehub.habits', []);
  const [expenses, setExpenses] = useLocalStorage<Expense[]>('lifehub.expenses', []);
  const [budget, setBudget] = useLocalStorage<number>('lifehub.budget', 0);

  // Fire a browser notification once when a reminder comes due.
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      setReminders((prev) => {
        const due = prev.filter(
          (r) => !r.done && !r.notified && new Date(r.datetime).getTime() <= now,
        );
        if (due.length === 0) return prev;
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          for (const r of due) {
            new Notification('LifeHub reminder', { body: r.text });
          }
        }
        const dueIds = new Set(due.map((r) => r.id));
        return prev.map((r) => (dueIds.has(r.id) ? { ...r, notified: true } : r));
      });
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [setReminders]);

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">
          <span className="brand-mark">◆</span>
          <span className="brand-name">LifeHub</span>
        </div>
        {NAV.map((item) => (
          <button
            key={item.view}
            className={`nav-item ${view === item.view ? 'active' : ''}`}
            onClick={() => setView(item.view)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <main className="main">
        {view === 'dashboard' && (
          <Dashboard
            events={events}
            tasks={tasks}
            reminders={reminders}
            habits={habits}
            expenses={expenses}
            budget={budget}
            onNavigate={setView}
          />
        )}
        {view === 'calendar' && <Calendar events={events} setEvents={setEvents} />}
        {view === 'tasks' && <Tasks tasks={tasks} setTasks={setTasks} />}
        {view === 'notes' && <Notes notes={notes} setNotes={setNotes} />}
        {view === 'reminders' && (
          <Reminders reminders={reminders} setReminders={setReminders} />
        )}
        {view === 'habits' && <Habits habits={habits} setHabits={setHabits} />}
        {view === 'budget' && (
          <Budget
            expenses={expenses}
            setExpenses={setExpenses}
            budget={budget}
            setBudget={setBudget}
          />
        )}
      </main>
    </div>
  );
}
