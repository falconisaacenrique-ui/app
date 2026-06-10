import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from '../quickadd';

// Wednesday, June 10 2026, 08:00 local
const NOW = new Date(2026, 5, 10, 8, 0);

describe('parseQuickAdd', () => {
  it('plain text becomes a task', () => {
    const p = parseQuickAdd('write journal', NOW);
    expect(p.kind).toBe('task');
    expect(p.text).toBe('write journal');
    expect(p.date).toBeUndefined();
  });

  it('a weekday becomes a task due next occurrence', () => {
    const p = parseQuickAdd('buy groceries friday', NOW);
    expect(p.kind).toBe('task');
    expect(p.text).toBe('buy groceries');
    expect(p.date).toBe('2026-06-12');
  });

  it('a time makes it an event', () => {
    const p = parseQuickAdd('dentist tomorrow 3pm', NOW);
    expect(p.kind).toBe('event');
    expect(p.text).toBe('dentist');
    expect(p.date).toBe('2026-06-11');
    expect(p.time).toBe('15:00');
  });

  it('24h times parse', () => {
    const p = parseQuickAdd('standup today 09:30', NOW);
    expect(p.kind).toBe('event');
    expect(p.time).toBe('09:30');
    expect(p.date).toBe('2026-06-10');
  });

  it('"remind me to" becomes a reminder with defaults', () => {
    const p = parseQuickAdd('remind me to call mom 9am', NOW);
    expect(p.kind).toBe('reminder');
    expect(p.text).toBe('call mom');
    expect(p.date).toBe('2026-06-10');
    expect(p.time).toBe('09:00');
  });

  it('reminder without time defaults to 09:00', () => {
    const p = parseQuickAdd('remind me to water plants tomorrow', NOW);
    expect(p.kind).toBe('reminder');
    expect(p.date).toBe('2026-06-11');
    expect(p.time).toBe('09:00');
  });

  it('month-day dates parse and roll to next year when past', () => {
    const p = parseQuickAdd('flight jun 12', NOW);
    expect(p.date).toBe('2026-06-12');
    const past = parseQuickAdd('party jan 5', NOW);
    expect(past.date).toBe('2027-01-05');
  });

  it('weekday today rolls to next week, never today', () => {
    const p = parseQuickAdd('gym wednesday', NOW); // NOW is a Wednesday
    expect(p.date).toBe('2026-06-17');
  });
});

describe('parseExpense', () => {
  it('splits trailing amounts off the description', async () => {
    const { parseExpense } = await import('../quickadd');
    expect(parseExpense('Coffee 4.50')).toEqual({ description: 'Coffee', amount: 4.5 });
    expect(parseExpense('Bus ticket $2')).toEqual({ description: 'Bus ticket', amount: 2 });
    expect(parseExpense('Lunch 12,99')).toEqual({ description: 'Lunch', amount: 12.99 });
  });

  it('returns null amount when there is none', async () => {
    const { parseExpense } = await import('../quickadd');
    expect(parseExpense('Groceries')).toEqual({ description: 'Groceries', amount: null });
    expect(parseExpense('42')).toEqual({ description: '42', amount: null });
  });
});
