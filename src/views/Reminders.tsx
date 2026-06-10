import { useState } from 'react';
import { X } from 'lucide-react';
import type { Reminder } from '../types';
import { formatDateTime, uid } from '../utils';

interface Props {
  reminders: Reminder[];
  setReminders: React.Dispatch<React.SetStateAction<Reminder[]>>;
}

export default function Reminders({ reminders, setReminders }: Props) {
  const [text, setText] = useState('');
  const [datetime, setDatetime] = useState('');
  const [notifStatus, setNotifStatus] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );

  function addReminder(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !datetime) return;
    setReminders((prev) => [
      ...prev,
      { id: uid(), text: text.trim(), datetime, done: false, notified: false },
    ]);
    setText('');
    setDatetime('');
  }

  async function enableNotifications() {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setNotifStatus(result);
  }

  const now = new Date().toISOString();
  const sorted = [...reminders].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.datetime.localeCompare(b.datetime);
  });

  return (
    <div className="view">
      <header className="view-header">
        <h1>Reminders</h1>
      </header>

      {notifStatus === 'default' && (
        <div className="banner">
          <span>Enable notifications to get alerted when reminders are due.</span>
          <button className="primary" onClick={enableNotifications}>
            Enable
          </button>
        </div>
      )}
      {notifStatus === 'denied' && (
        <p className="muted small">
          Notifications are blocked in your browser settings — reminders will still
          highlight in the app when due.
        </p>
      )}

      <form onSubmit={addReminder} className="inline-form card">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Remind me to…"
        />
        <input
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
        />
        <button type="submit" className="primary">
          Add
        </button>
      </form>

      {sorted.length === 0 && <p className="muted">No reminders set.</p>}
      <ul className="plain-list">
        {sorted.map((r) => {
          const overdue = !r.done && new Date(r.datetime).toISOString() <= now;
          return (
            <li key={r.id} className={`card row ${r.done ? 'done' : ''}`}>
              <input
                type="checkbox"
                checked={r.done}
                onChange={() =>
                  setReminders((prev) =>
                    prev.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)),
                  )
                }
              />
              <span className="grow">
                {r.text}
                <span className={`badge ${overdue ? 'overdue' : ''}`}>
                  {overdue ? 'due · ' : ''}
                  {formatDateTime(r.datetime)}
                </span>
              </span>
              <button
                className="icon-btn"
                aria-label="Delete reminder"
                onClick={() => setReminders((prev) => prev.filter((x) => x.id !== r.id))}
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
