/**
 * Spaced repetition — the SM-2 algorithm (the one behind Anki),
 * for the "Remember" module.
 */
import { toDateStr } from './utils';

export interface Fact {
  id: string;
  front: string;
  back: string;
  ease: number; // easiness factor, starts at 2.5
  interval: number; // days
  reps: number;
  due: string; // YYYY-MM-DD
  createdAt: number;
}

export type Quality = 'again' | 'good' | 'easy';

const QUALITY_VALUE: Record<Quality, number> = { again: 1, good: 4, easy: 5 };

/** Apply one review to a fact, returning the rescheduled fact. */
export function review(fact: Fact, quality: Quality, today: Date = new Date()): Fact {
  const q = QUALITY_VALUE[quality];
  let { ease, interval, reps } = fact;

  if (q < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round(interval * ease);
    if (quality === 'easy') interval = Math.round(interval * 1.3);
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  const due = new Date(today);
  due.setDate(due.getDate() + interval);
  return { ...fact, ease, interval, reps, due: toDateStr(due) };
}

export function dueFacts(facts: Fact[], today: string): Fact[] {
  return facts.filter((f) => f.due <= today).sort((a, b) => a.due.localeCompare(b.due));
}
