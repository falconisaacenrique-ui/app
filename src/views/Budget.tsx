import { useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react';
import type { Expense } from '../types';
import { formatDate, formatMoney, todayStr, uid } from '../utils';
import type { UndoToast } from '../App';

interface Props {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  budget: number;
  setBudget: React.Dispatch<React.SetStateAction<number>>;
  currency: string;
  showUndo: (message: string, undo: UndoToast['undo']) => void;
}

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Fun', 'Health', 'Other'];

interface ExpenseFormState {
  description: string;
  amount: string;
  category: string;
  date: string;
}

function ExpenseForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: ExpenseFormState;
  submitLabel: string;
  onSubmit: (state: ExpenseFormState) => void;
}) {
  const [state, setState] = useState(initial);
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        const value = parseFloat(state.amount);
        if (!state.description.trim() || !Number.isFinite(value) || value <= 0) return;
        onSubmit({ ...state, description: state.description.trim() });
        setState(initial);
      }}
    >
      <input
        value={state.description}
        onChange={(e) => setState({ ...state, description: e.target.value })}
        placeholder="What did you buy?"
      />
      <input
        type="number"
        min="0.01"
        step="0.01"
        value={state.amount}
        onChange={(e) => setState({ ...state, amount: e.target.value })}
        placeholder="Amount"
      />
      <select
        value={state.category}
        onChange={(e) => setState({ ...state, category: e.target.value })}
      >
        {CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <input
        type="date"
        value={state.date}
        onChange={(e) => setState({ ...state, date: e.target.value })}
      />
      <button type="submit" className="primary">
        {submitLabel}
      </button>
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
    showUndo(`Deleted "${expense.description}"`, () =>
      setExpenses((prev) => [...prev, expense]),
    );
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>Budget</h1>
      </header>

      <div className="cal-nav">
        <button onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        <strong>{monthLabel}</strong>
        <button onClick={() => shiftMonth(1)} aria-label="Next month">
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>

      <section className="card">
        <div className="row">
          <span className="grow">
            Spent <strong>{formatMoney(spent, currency)}</strong>
            {budget > 0 && (
              <>
                {' '}
                of {formatMoney(budget, currency)} ·{' '}
                <span className={spent > budget ? 'warn' : ''}>
                  {formatMoney(Math.abs(budget - spent), currency)}{' '}
                  {spent > budget ? 'over' : 'left'}
                </span>
              </>
            )}
          </span>
          <label className="row small muted">
            Monthly budget:&nbsp;
            <input
              type="number"
              min="0"
              step="10"
              value={budget || ''}
              placeholder="0"
              style={{ width: '6.5rem' }}
              onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
            />
          </label>
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

      <div className="card">
        <ExpenseForm
          initial={{ description: '', amount: '', category: CATEGORIES[0], date: todayStr() }}
          submitLabel="Add"
          onSubmit={(s) =>
            setExpenses((prev) => [
              ...prev,
              {
                id: uid(),
                description: s.description,
                amount: parseFloat(s.amount),
                category: s.category,
                date: s.date,
              },
            ])
          }
        />
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

      {monthExpenses.length === 0 && <p className="muted">No expenses logged this month.</p>}
      <ul className="plain-list">
        {monthExpenses.map((e) =>
          editingId === e.id ? (
            <li key={e.id} className="card">
              <ExpenseForm
                initial={{
                  description: e.description,
                  amount: String(e.amount),
                  category: e.category,
                  date: e.date,
                }}
                submitLabel="Save"
                onSubmit={(s) => {
                  setExpenses((prev) =>
                    prev.map((x) =>
                      x.id === e.id
                        ? {
                            ...x,
                            description: s.description,
                            amount: parseFloat(s.amount),
                            category: s.category,
                            date: s.date,
                          }
                        : x,
                    ),
                  );
                  setEditingId(null);
                }}
              />
            </li>
          ) : (
            <li key={e.id} className="card row">
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
                <Pencil size={14} strokeWidth={1.5} />
              </button>
              <button className="icon-btn" aria-label="Delete expense" onClick={() => remove(e)}>
                <X size={15} strokeWidth={1.5} />
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
