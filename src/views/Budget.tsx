import { useState } from 'react';
import type { Expense } from '../types';
import { formatDate, formatMoney, todayStr, uid } from '../utils';

interface Props {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  budget: number;
  setBudget: React.Dispatch<React.SetStateAction<number>>;
}

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Fun', 'Health', 'Other'];

export default function Budget({ expenses, setExpenses, budget, setBudget }: Props) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [date, setDate] = useState(todayStr());

  const month = todayStr().slice(0, 7);
  const monthExpenses = expenses
    .filter((e) => e.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const spent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const byCategory = new Map<string, number>();
  for (const e of monthExpenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  }
  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  function addExpense(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!description.trim() || !Number.isFinite(value) || value <= 0) return;
    setExpenses((prev) => [
      ...prev,
      { id: uid(), description: description.trim(), amount: value, category, date },
    ]);
    setDescription('');
    setAmount('');
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>Budget</h1>
        <p className="muted">
          {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </p>
      </header>

      <section className="card">
        <div className="row">
          <span className="grow">
            Spent <strong>{formatMoney(spent)}</strong>
            {budget > 0 && (
              <>
                {' '}
                of {formatMoney(budget)} ·{' '}
                <span className={spent > budget ? 'warn' : ''}>
                  {formatMoney(Math.abs(budget - spent))} {spent > budget ? 'over' : 'left'}
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

      <form onSubmit={addExpense} className="inline-form card">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What did you buy?"
        />
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="submit" className="primary">
          Add
        </button>
      </form>

      {categoryRows.length > 0 && (
        <section className="card">
          <h2>By category</h2>
          {categoryRows.map(([cat, total]) => (
            <div key={cat} className="row small">
              <span className="grow">{cat}</span>
              <span>{formatMoney(total)}</span>
            </div>
          ))}
        </section>
      )}

      {monthExpenses.length === 0 && <p className="muted">No expenses logged this month.</p>}
      <ul className="plain-list">
        {monthExpenses.map((e) => (
          <li key={e.id} className="card row">
            <span className="grow">
              {e.description}
              <span className="badge">{e.category}</span>
              <span className="badge">{formatDate(e.date)}</span>
            </span>
            <strong>{formatMoney(e.amount)}</strong>
            <button
              className="icon-btn"
              aria-label="Delete expense"
              onClick={() => setExpenses((prev) => prev.filter((x) => x.id !== e.id))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
