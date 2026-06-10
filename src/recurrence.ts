import type { Repeat } from './types';
import { toDateStr } from './utils';

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whether a (possibly repeating) item starting on startDate occurs on date. */
export function occursOn(startDate: string, repeat: Repeat | undefined, date: string): boolean {
  if (date === startDate) return true;
  if (!repeat || date < startDate) return false;
  const start = parseDate(startDate);
  const target = parseDate(date);
  if (repeat === 'daily') return true;
  if (repeat === 'weekly') return start.getDay() === target.getDay();
  return start.getDate() === target.getDate(); // monthly, by day of month
}

/** The next date (YYYY-MM-DD) strictly after `after` on which the item occurs. */
export function nextDate(startDate: string, repeat: Repeat, after: string): string {
  const cursor = parseDate(after > startDate ? after : startDate);
  for (let i = 0; i < 366; i++) {
    cursor.setDate(cursor.getDate() + 1);
    const candidate = toDateStr(cursor);
    if (occursOn(startDate, repeat, candidate)) return candidate;
  }
  return startDate; // unreachable for valid repeats
}

/**
 * Advance a reminder datetime ("YYYY-MM-DDTHH:MM") past `now` by its repeat
 * interval, preserving the time of day.
 */
export function nextDatetime(datetime: string, repeat: Repeat, now: Date): string {
  const [date, time] = datetime.split('T');
  let next = date;
  const nowStr = toDateStr(now);
  do {
    next = nextDate(date, repeat, next);
  } while (next < nowStr || (next === nowStr && time <= formatHM(now)));
  return `${next}T${time}`;
}

function formatHM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const REPEAT_LABELS: { value: '' | Repeat; label: string }[] = [
  { value: '', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];
