import { useState } from 'react';
import { Clock, Pencil, X } from 'lucide-react';
import Check from '../components/Check';
import CycleChip from '../components/CycleChip';
import SwipeRow from '../components/SwipeRow';
import { REPEAT_LABELS } from '../recurrence';
import { parseQuickAdd } from '../quickadd';
import type { Reminder, Repeat } from '../types';
import { formatDateTime, uid } from '../utils';
import type { UndoToast } from '../App';

interface Props {
  reminders: Reminder[];
  setReminders: React.Dispatch<React.SetStateAction<Reminder[]>>;
  showUndo: (message: string, undo: NonNullable<UndoToast['undo']>) => void;
}

const REPEATS = ['', 'daily', 'weekly', 'monthly'] as const;

function repeatLabel(r: '' | Repeat): string {
  return REPEAT_LABELS.find((x) => x.value === r)?.label ?? 'Once';
}

function SmartAddReminder({
  onAdd,
}: {
  onAdd: (r: Omit<Reminder, 'id' | 'done' | 'notified'>) => void;
}) {
  const [text, setText] = useState('');
  const [datetime, setDatetime] = useState('');
  const [showWhen, setShowWhen] = useState(false);
  const [repeat, setRepeat] = useState<'' | Repeat>('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseQuickAdd(`remind me to ${text}`);
    if (!parsed.text.trim()) return;
    const when = datetime || `${parsed.date}T${parsed.time}`;
    onAdd({ text: parsed.text, datetime: when, repeat: repeat || undefined });
    setText('');
    setDatetime('');
    setShowWhen(false);
  }

  return (
    <form className="smart-add card" onSubmit={submit}>
      <div className="row">
        <input
          className="grow"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Remind me to…"
          aria-label="New reminder"
        />
        <button type="submit" className="primary">
          Add
        </button>
      </div>
      <div className="chip-row">
        <button
          type="button"
          className={`chip ${datetime ? 'active' : ''}`}
          onClick={() => setShowWhen((s) => !s)}
        >
          <Clock size={13} strokeWidth={1.5} />
          {datetime ? formatDateTime(datetime) : 'When'}
        </button>
        {showWhen && (
          <input
            type="datetime-local"
            value={datetime}
            autoFocus
            onChange={(e) => setDatetime(e.target.value)}
          />
        )}
        <CycleChip
          value={repeat}
          options={REPEATS}
          format={repeatLabel}
          label="Repeat"
          active={repeat !== ''}
          onChange={setRepeat}
        />
      </div>
      <p className="hint muted small">
        Type the time in the text — <em>call mom tomorrow 9am</em>
      </p>
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
    setNotifStatus(await Notification.requestPermission());
  }

  function toggle(r: Reminder) {
    setReminders((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)),
    );
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

      <SmartAddReminder
        onAdd={(r) =>
          setReminders((prev) => [...prev, { ...r, id: uid(), done: false, notified: false }])
        }
      />

      {sorted.length === 0 && (
        <p className="muted empty-note">No reminders yet — never forget a thing again.</p>
      )}
      <ul className="plain-list">
        {sorted.map((r) =>
          editingId === r.id ? (
            <li key={r.id} className="card">
              <EditReminderForm
                reminder={r}
                onSave={(patch) => {
                  setReminders((prev) =>
                    prev.map((x) => (x.id === r.id ? { ...x, ...patch, notified: false } : x)),
                  );
                  setEditingId(null);
                }}
              />
            </li>
          ) : (
            <li key={r.id} className="list-enter">
              <SwipeRow onSwipeRight={() => toggle(r)} onSwipeLeft={() => remove(r)}>
                <div className={`card row ${r.done ? 'done' : ''}`}>
                  <Check checked={r.done} onToggle={() => toggle(r)} label={`Done ${r.text}`} />
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
                    <Pencil size={15} strokeWidth={1.5} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="Delete reminder"
                    onClick={() => remove(r)}
                  >
                    <X size={16} strokeWidth={1.5} />
                  </button>
                </div>
              </SwipeRow>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function EditReminderForm({
  reminder,
  onSave,
}: {
  reminder: Reminder;
  onSave: (patch: Partial<Reminder>) => void;
}) {
  const [text, setText] = useState(reminder.text);
  const [datetime, setDatetime] = useState(reminder.datetime);
  const [repeat, setRepeat] = useState<'' | Repeat>(reminder.repeat ?? '');
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim() || !datetime) return;
        onSave({ text: text.trim(), datetime, repeat: repeat || undefined });
      }}
    >
      <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Reminder text" />
      <input
        type="datetime-local"
        value={datetime}
        onChange={(e) => setDatetime(e.target.value)}
      />
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
