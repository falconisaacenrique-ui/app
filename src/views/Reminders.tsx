import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { REPEAT_LABELS } from '../recurrence';
import type { Reminder, Repeat } from '../types';
import { formatDateTime, uid } from '../utils';
import type { UndoToast } from '../App';

interface Props {
  reminders: Reminder[];
  setReminders: React.Dispatch<React.SetStateAction<Reminder[]>>;
  showUndo: (message: string, undo: UndoToast['undo']) => void;
}

interface ReminderFormState {
  text: string;
  datetime: string;
  repeat: '' | Repeat;
}

function ReminderForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: ReminderFormState;
  submitLabel: string;
  onSubmit: (state: ReminderFormState) => void;
}) {
  const [state, setState] = useState(initial);
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!state.text.trim() || !state.datetime) return;
        onSubmit({ ...state, text: state.text.trim() });
        setState(initial);
      }}
    >
      <input
        value={state.text}
        onChange={(e) => setState({ ...state, text: e.target.value })}
        placeholder="Remind me to…"
      />
      <input
        type="datetime-local"
        value={state.datetime}
        onChange={(e) => setState({ ...state, datetime: e.target.value })}
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
      <button type="submit" className="primary">
        {submitLabel}
      </button>
    </form>
  );
}

export default function Reminders({ reminders, setReminders, showUndo }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );

  async function enableNotifications() {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setNotifStatus(result);
  }

  function remove(reminder: Reminder) {
    setReminders((prev) => prev.filter((x) => x.id !== reminder.id));
    showUndo(`Deleted "${reminder.text}"`, () => setReminders((prev) => [...prev, reminder]));
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
          Notifications are blocked in your browser settings — reminders will still highlight in
          the app when due.
        </p>
      )}

      <div className="card">
        <ReminderForm
          initial={{ text: '', datetime: '', repeat: '' }}
          submitLabel="Add"
          onSubmit={(s) =>
            setReminders((prev) => [
              ...prev,
              {
                id: uid(),
                text: s.text,
                datetime: s.datetime,
                done: false,
                notified: false,
                repeat: s.repeat || undefined,
              },
            ])
          }
        />
      </div>

      {sorted.length === 0 && <p className="muted">No reminders set.</p>}
      <ul className="plain-list">
        {sorted.map((r) =>
          editingId === r.id ? (
            <li key={r.id} className="card">
              <ReminderForm
                initial={{ text: r.text, datetime: r.datetime, repeat: r.repeat ?? '' }}
                submitLabel="Save"
                onSubmit={(s) => {
                  setReminders((prev) =>
                    prev.map((x) =>
                      x.id === r.id
                        ? {
                            ...x,
                            text: s.text,
                            datetime: s.datetime,
                            repeat: s.repeat || undefined,
                            notified: false,
                          }
                        : x,
                    ),
                  );
                  setEditingId(null);
                }}
              />
            </li>
          ) : (
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
                {r.repeat && <span className="badge">{r.repeat}</span>}
                <span
                  className={`badge ${!r.done && new Date(r.datetime).toISOString() <= now ? 'overdue' : ''}`}
                >
                  {formatDateTime(r.datetime)}
                </span>
              </span>
              <button
                className="icon-btn"
                aria-label="Edit reminder"
                onClick={() => setEditingId(r.id)}
              >
                <Pencil size={14} strokeWidth={1.5} />
              </button>
              <button className="icon-btn" aria-label="Delete reminder" onClick={() => remove(r)}>
                <X size={15} strokeWidth={1.5} />
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
