import { describe, expect, it } from 'vitest';
import { doneThisWeek, formatMoney, lastNDays, streak, toDateStr } from '../utils';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

describe('streak', () => {
  it('is zero with no completions', () => {
    expect(streak([])).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(streak([daysAgo(0), daysAgo(1), daysAgo(2)])).toBe(3);
  });

  it('still counts if today is not yet done', () => {
    expect(streak([daysAgo(1), daysAgo(2)])).toBe(2);
  });

  it('breaks on a gap', () => {
    expect(streak([daysAgo(0), daysAgo(2), daysAgo(3)])).toBe(1);
  });
});

describe('lastNDays', () => {
  it('returns n days ending today', () => {
    const days = lastNDays(7);
    expect(days).toHaveLength(7);
    expect(days[6]).toBe(daysAgo(0));
    expect(days[0]).toBe(daysAgo(6));
  });
});

describe('doneThisWeek', () => {
  it('counts completions within the Mon-Sun week of the date', () => {
    const wed = new Date(2026, 5, 10); // Wed Jun 10 2026
    expect(doneThisWeek(['2026-06-08', '2026-06-09', '2026-06-14'], wed)).toBe(3);
    expect(doneThisWeek(['2026-06-07'], wed)).toBe(0); // previous Sunday
    expect(doneThisWeek(['2026-06-15'], wed)).toBe(0); // next Monday
  });
});

describe('formatMoney', () => {
  it('formats with the given currency', () => {
    expect(formatMoney(10, 'USD')).toContain('10');
    expect(formatMoney(10, 'EUR')).toContain('10');
  });

  it('falls back gracefully on an invalid code', () => {
    expect(formatMoney(10, 'NOPE')).toContain('10');
  });
});
