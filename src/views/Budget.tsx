import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react';
import CycleChip from '../components/CycleChip';
import { parseExpense } from '../quickadd';
import type { Expense } from '../types';
import { formatDate, formatMoney, todayStr, uid } from '../utils';
import type { UndoToast } from '../App';

interface Props {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  budget: number;
  setBudget: React.Dispatch<React.SetStateAction<number>>;
  currency: string;
  showUndo: (message: string, undo: NonNullable<UndoToast['undo']>) => void;
}

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Fun', 'Health', 'Other'] as const;

function SmartAddExpense({ onAdd }: { onAdd: (e: Omit<Expense, 'id'>) => void }) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Food');
  const [date, setDate] = useState(todayStr());
  const [showDate, setShowDate] = useState(false);
  const [error, setError] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseExpense(text);
    if (!parsed.description || parsed.amount === null || parsed.amount <= 0) {
      setError(true);
      return;
    }
    setError(false);
    onAdd({ description: parsed.description, amount: parsed.amount, category, date });
    setText('');
  }

  return (
    <form className="smart-add card" onSubmit={submit}>
      <div className="row">
        <input
          className="grow"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(false);
          }}
          placeholder="Coffee 4.50"
          aria-label="New expense"
        />
        <button type="submit" className="primary">
          Add
        </button>
      </div>
      <div className="chip-row">
        <CycleChip
          value={category}
          options={CATEGORIES}
          format={(c) => c}
          label="Category"
          onChange={setCategory}
        />
        <button
          type="button"
          className={`chip ${date !== todayStr() ? 'active' : ''}`}
          onClick={() => setShowDate((s) => !s)}
        >
          <CalendarDays size={13} strokeWidth={1.5} />
          {date === todayStr() ? 'Today' : formatDate(date)}
        </button>
        {showDate && (
          <input
            type="date"
            value={date}
            autoFocus
            onChange={(e) => {
              setDate(e.target.value);
              setShowDate(false);
            }}
          />
        )}
      </div>
      <p className={`hint small ${error ? 'warn' : 'muted'}`}>
        {error
          ? 'End with the amount — e.g. "Coffee 4.50"'
          : 'Write what you bought and the amount at the end.'}
      </p>
    </form>
  );
}

export default function Budget({
  expenses,
  setExpenses,
  budget,
  setBudget,
  currency,
  showUndo,
}: Props) {
  const thisMonth = todayStr().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);

  function shiftMonth(delta: number) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const monthExpenses = expenses
    .filter((e) => e.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const spent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const byCategory = new Map<string, number>();
  for (const e of monthExpenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  }
  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  const monthLabel = new Date(`${month}-01T00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  function remove(expense: Expense) {
    setExpenses((prev) => prev.filter((x) => x.id !== expense.id));
    showUndo(`Deleted "${expense.description}"`, () => setExpenses((prev) => [...prev, expense]));
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>Budget</h1>
      </header>

      <section className="card budget-summary">
        <div className="row">
          <span className="grow">
            <span className="big-number">{formatMoney(spent, currency)}</span>
            <span className="muted"> spent</span>
            {budget > 0 && (
              <>
                {' · '}
                <span className={spent > budget ? 'warn' : ''}>
                  {formatMoney(Math.abs(budget - spent), currency)}{' '}
                  {spent > budget ? 'over budget' : 'left'}
                </span>
              </>
            )}
          </span>
          {editingBudget ? (
            <input
              type="number"
              min="0"
              step="10"
              autoFocus
              defaultValue={budget || ''}
              placeholder="0"
              style={{ width: '7rem' }}
              onBlur={(e) => {
                setBudget(parseFloat(e.target.value) || 0);
                setEditingBudget(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
            />
          ) : (
            <button className="chip" onClick={() => setEditingBudget(true)}>
              {budget > 0 ? `Budget ${formatMoney(budget, currency)}` : 'Set monthly budget'}
            </button>
          )}
        </div>
        {budget > 0 && (
          <div className="progress">
            <div
              className={`progress-bar ${spent > budget ? 'over' : ''}`}
              style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }}
            />
          </div>
        )}
      </section>

      <SmartAddExpense onAdd={(e) => setExpenses((prev) => [...prev, { ...e, id: uid() }])} />

      <div className="cal-nav">
        <button onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        <strong>{monthLabel}</strong>
        <button onClick={() => shiftMonth(1)} aria-label="Next month">
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>

      {categoryRows.length > 0 && (
        <section className="card">
          <h2>By category</h2>
          {categoryRows.map(([cat, total]) => (
            <div key={cat} className="row small">
              <span className="grow">{cat}</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
          ))}
        </section>
      )}

      {monthExpenses.length === 0 && (
        <p className="muted empty-note">No expenses logged this month.</p>
      )}
      <ul className="plain-list">
        {monthExpenses.map((e) =>
          editingId === e.id ? (
            <li key={e.id} className="card">
              <EditExpenseForm
                expense={e}
                onSave={(patch) => {
                  setExpenses((prev) =>
                    prev.map((x) => (x.id === e.id ? { ...x, ...patch } : x)),
                  );
                  setEditingId(null);
                }}
              />
            </li>
          ) : (
            <li key={e.id} className="card row list-enter">
              <span className="grow">
                {e.description}
                <span className="badge">{e.category}</span>
                <span className="badge">{formatDate(e.date)}</span>
              </span>
              <strong>{formatMoney(e.amount, currency)}</strong>
              <button
                className="icon-btn"
                aria-label="Edit expense"
                onClick={() => setEditingId(e.id)}
              >
                <Pencil size={15} strokeWidth={1.5} />
              </button>
              <button className="icon-btn" aria-label="Delete expense" onClick={() => remove(e)}>
                <X size={16} strokeWidth={1.5} />
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function EditExpenseForm({
  expense,
  onSave,
}: {
  expense: Expense;
  onSave: (patch: Partial<Expense>) => void;
}) {
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(String(expense.amount));
  const [category, setCategory] = useState(expense.category);
  const [date, setDate] = useState(expense.date);
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        const value = parseFloat(amount);
        if (!description.trim() || !Number.isFinite(value) || value <= 0) return;
        onSave({ description: description.trim(), amount: value, category, date });
      }}
    >
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        aria-label="Description"
      />
      <input
        type="number"
        min="0.01"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        aria-label="Amount"
      />
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <button type="submit" className="primary">
        Save
      </button>
    </form>
  );
}
