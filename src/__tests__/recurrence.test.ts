import { describe, expect, it } from 'vitest';
import { nextDate, nextDatetime, occursOn } from '../recurrence';

describe('occursOn', () => {
  it('matches the start date with or without repeat', () => {
    expect(occursOn('2026-06-10', undefined, '2026-06-10')).toBe(true);
    expect(occursOn('2026-06-10', 'weekly', '2026-06-10')).toBe(true);
  });

  it('never occurs before the start date', () => {
    expect(occursOn('2026-06-10', 'daily', '2026-06-09')).toBe(false);
  });

  it('daily occurs every later day', () => {
    expect(occursOn('2026-06-10', 'daily', '2026-06-11')).toBe(true);
    expect(occursOn('2026-06-10', 'daily', '2027-01-01')).toBe(true);
  });

  it('weekly occurs on the same weekday only', () => {
    // 2026-06-10 is a Wednesday
    expect(occursOn('2026-06-10', 'weekly', '2026-06-17')).toBe(true);
    expect(occursOn('2026-06-10', 'weekly', '2026-06-18')).toBe(false);
  });

  it('monthly occurs on the same day of month', () => {
    expect(occursOn('2026-06-10', 'monthly', '2026-07-10')).toBe(true);
    expect(occursOn('2026-06-10', 'monthly', '2026-07-11')).toBe(false);
  });

  it('non-repeating items only occur once', () => {
    expect(occursOn('2026-06-10', undefined, '2026-06-11')).toBe(false);
  });
});

describe('nextDate', () => {
  it('advances daily by one day', () => {
    expect(nextDate('2026-06-10', 'daily', '2026-06-10')).toBe('2026-06-11');
  });

  it('advances weekly to the same weekday next week', () => {
    expect(nextDate('2026-06-10', 'weekly', '2026-06-10')).toBe('2026-06-17');
  });

  it('advances monthly to the same day next month', () => {
    expect(nextDate('2026-06-10', 'monthly', '2026-06-10')).toBe('2026-07-10');
  });

  it('catches up from a past start to after the given date', () => {
    expect(nextDate('2026-06-03', 'weekly', '2026-06-18')).toBe('2026-06-24');
  });
});

describe('nextDatetime', () => {
  it('advances past now and keeps the time of day', () => {
    const now = new Date(2026, 5, 15, 12, 0); // Jun 15 2026 12:00
    expect(nextDatetime('2026-06-10T09:00', 'daily', now)).toBe('2026-06-16T09:00');
  });

  it('weekly reminder lands on the same weekday', () => {
    const now = new Date(2026, 5, 10, 10, 0); // Wed Jun 10, after 09:00 fired
    expect(nextDatetime('2026-06-10T09:00', 'weekly', now)).toBe('2026-06-17T09:00');
  });
});
