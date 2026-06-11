import { describe, expect, it } from 'vitest';
import {
  forecastSpend,
  hourDensity,
  peakWindow,
  pearson,
  predictLogistic,
  trainLogistic,
} from '../oracle';
import { solve } from '../solver';
import { expand, plantFor } from '../garden';
import { SearchIndex } from '../searchengine';
import { fireRules, parseRule, parseRules } from '../dsl';
import { dueFacts, review, type Fact } from '../sm2';
import {
  diffCollections,
  mergeCollections,
  rewind,
  type JournalEvent,
} from '../journal';
import { parseQuickAdd } from '../quickadd';

describe('oracle: logistic regression', () => {
  it('learns a separable pattern', () => {
    // label 1 when feature > 5
    const samples = Array.from({ length: 60 }, (_, i) => ({
      features: [i % 10, 1],
      label: (i % 10 > 5 ? 1 : 0) as 0 | 1,
    }));
    const model = trainLogistic(samples)!;
    expect(predictLogistic(model, [9, 1])).toBeGreaterThan(0.8);
    expect(predictLogistic(model, [1, 1])).toBeLessThan(0.2);
  });

  it('returns null with too little data', () => {
    expect(trainLogistic([{ features: [1], label: 1 }])).toBeNull();
  });
});

describe('oracle: forecasting', () => {
  it('projects spending with a confidence band', () => {
    const f = forecastSpend(100, [10, 12, 8, 11, 9, 10], 10)!;
    expect(f.expected).toBeGreaterThan(150);
    expect(f.expected).toBeLessThan(280);
    expect(f.low).toBeLessThanOrEqual(f.expected);
    expect(f.high).toBeGreaterThanOrEqual(f.expected);
  });
});

describe('oracle: circadian', () => {
  it('finds the productive window', () => {
    const density = hourDensity([9, 9, 10, 10, 10, 11, 14]);
    const peak = peakWindow(density)!;
    expect(peak.start).toBeGreaterThanOrEqual(8);
    expect(peak.start).toBeLessThanOrEqual(10);
  });

  it('pearson detects correlation', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])!).toBeCloseTo(1);
    expect(Math.abs(pearson([1, 2, 3, 4], [4, 1, 3, 2])!)).toBeLessThan(0.9);
  });
});

describe('solver', () => {
  const input = {
    tasks: [
      { id: 'a', text: 'urgent', duration: 60, due: '2026-06-10', priority: 'high' as const },
      { id: 'b', text: 'later', duration: 30, due: '2026-06-12', priority: 'low' as const },
      { id: 'c', text: 'anytime', duration: 45, priority: 'medium' as const },
    ],
    busy: [{ date: '2026-06-10', start: 9 * 60, end: 17 * 60 }],
    days: ['2026-06-10', '2026-06-11', '2026-06-12'],
    workStart: 8 * 60,
    workEnd: 22 * 60,
  };

  it('schedules everything without overlaps inside work hours', () => {
    const plan = solve(input);
    expect(plan.unscheduled).toHaveLength(0);
    for (const b of plan.blocks) {
      expect(b.start).toBeGreaterThanOrEqual(8 * 60);
      expect(b.end).toBeLessThanOrEqual(22 * 60);
    }
    // no overlap on same day
    const byDay = new Map<string, { start: number; end: number }[]>();
    for (const b of plan.blocks) {
      const list = byDay.get(b.date) ?? [];
      for (const other of list) {
        expect(b.start >= other.end || b.end <= other.start).toBe(true);
      }
      list.push(b);
      byDay.set(b.date, list);
    }
  });

  it('respects calendar events and deadlines', () => {
    const plan = solve(input);
    const urgent = plan.blocks.find((b) => b.taskId === 'a')!;
    expect(urgent.date).toBe('2026-06-10'); // due today, must not slip
    // not inside the 9-17 busy block
    expect(urgent.end <= 9 * 60 || urgent.start >= 17 * 60).toBe(true);
  });
});

describe('garden: L-systems', () => {
  it('expands deterministically', () => {
    expect(expand('X', { X: 'F[+X]', F: 'FF' }, 2)).toBe('FF[+F[+X]]');
  });

  it('plants are deterministic per habit and grow with streaks', () => {
    const a1 = plantFor('habit-1', 2, 5);
    const a2 = plantFor('habit-1', 2, 5);
    expect(a1.instructions).toBe(a2.instructions);
    const grown = plantFor('habit-1', 40, 80);
    expect(grown.iterations).toBeGreaterThan(a1.iterations);
    expect(grown.flower).toBe(true);
  });
});

describe('search engine', () => {
  const index = new SearchIndex([
    { id: '1', text: 'Dentist appointment with x-rays' },
    { id: '2', text: 'Buy groceries and milk' },
    { id: '3', text: 'Quarterly budget review meeting' },
  ]);

  it('ranks exact matches first', () => {
    expect(index.search('dentist')[0].id).toBe('1');
  });

  it('survives typos via trigrams', () => {
    expect(index.search('dentst apointmnt')[0].id).toBe('1');
    expect(index.search('grocries')[0].id).toBe('2');
  });
});

describe('rules DSL', () => {
  const ctx = {
    habitStreak: (n: string) => (n === 'gym' ? 8 : 0),
    tasksOverdue: 4,
    spentThisMonth: 600,
    allHabitsDoneToday: true,
  };

  it('parses and fires habit streak rules', () => {
    const rule = parseRule('when habit "gym" streak >= 7 then add task "buy protein"');
    expect(typeof rule).not.toBe('string');
    const fired = fireRules([rule as Exclude<typeof rule, string>], ctx);
    expect(fired).toHaveLength(1);
    expect(fired[0].action).toEqual({ type: 'task', text: 'buy protein' });
  });

  it('handles all condition kinds', () => {
    const text = [
      'when tasks overdue >= 3 then add note "triage day"',
      'when spent > 500 then add reminder "review spending"',
      'when all habits done then add note "perfect day"',
      '# a comment',
    ].join('\n');
    const { rules, errors } = parseRules(text);
    expect(errors).toHaveLength(0);
    expect(fireRules(rules, ctx)).toHaveLength(3);
  });

  it('reports helpful errors with line numbers', () => {
    const { errors } = parseRules('when nonsense then add task "x"');
    expect(errors[0].line).toBe(1);
    expect(errors[0].message).toContain('unknown condition');
  });
});

describe('SM-2 spaced repetition', () => {
  const base: Fact = {
    id: 'f1', front: 'q', back: 'a', ease: 2.5, interval: 0, reps: 0,
    due: '2026-06-10', createdAt: 0,
  };
  const today = new Date(2026, 5, 10);

  it('grows intervals 1 -> 6 -> ease-multiplied', () => {
    const r1 = review(base, 'good', today);
    expect(r1.interval).toBe(1);
    const r2 = review(r1, 'good', today);
    expect(r2.interval).toBe(6);
    const r3 = review(r2, 'good', today);
    expect(r3.interval).toBeGreaterThan(10);
  });

  it('"again" resets the interval', () => {
    const learned = { ...base, interval: 30, reps: 5 };
    const r = review(learned, 'again', today);
    expect(r.interval).toBe(1);
    expect(r.reps).toBe(0);
  });

  it('selects due facts', () => {
    expect(dueFacts([base, { ...base, id: 'f2', due: '2026-07-01' }], '2026-06-10')).toHaveLength(1);
  });
});

describe('journal: time machine + merge', () => {
  type Item = { id: string; v: number };
  const label = (i: Item) => String(i.v);

  it('diffs created/updated/deleted', () => {
    const events = diffCollections<Item>('task', [{ id: 'a', v: 1 }, { id: 'b', v: 1 }], [{ id: 'a', v: 2 }, { id: 'c', v: 1 }], label, 100);
    const actions = events.map((e) => `${e.action}:${e.id}`).sort();
    expect(actions).toEqual(['created:c', 'deleted:b', 'updated:a']);
  });

  it('rewinds to a past state', () => {
    const events = diffCollections<Item>('task', [{ id: 'a', v: 1 }], [{ id: 'a', v: 2 }, { id: 'b', v: 1 }], label, 100);
    const past = rewind<Item>('task', [{ id: 'a', v: 2 }, { id: 'b', v: 1 }], events);
    expect(past).toEqual([{ id: 'a', v: 1 }]);
  });

  it('merge: newer write wins, tombstones beat stale copies', () => {
    const localJ: JournalEvent[] = [
      { ts: 100, entity: 'task', action: 'created', id: 'a', label: '' },
      { ts: 300, entity: 'task', action: 'updated', id: 'a', label: '' },
      { ts: 100, entity: 'task', action: 'created', id: 'gone', label: '' },
    ];
    const remoteJ: JournalEvent[] = [
      { ts: 100, entity: 'task', action: 'created', id: 'a', label: '' },
      { ts: 200, entity: 'task', action: 'updated', id: 'a', label: '' },
      { ts: 100, entity: 'task', action: 'created', id: 'gone', label: '' },
      { ts: 400, entity: 'task', action: 'deleted', id: 'gone', label: '' },
      { ts: 150, entity: 'task', action: 'created', id: 'remote-only', label: '' },
    ];
    const merged = mergeCollections<Item>(
      [{ id: 'a', v: 3 }, { id: 'gone', v: 1 }],
      localJ,
      [{ id: 'a', v: 2 }, { id: 'remote-only', v: 1 }],
      remoteJ,
    );
    const byId = new Map(merged.map((i) => [i.id, i]));
    expect(byId.get('a')!.v).toBe(3); // local update is newer
    expect(byId.has('gone')).toBe(false); // remote tombstone wins
    expect(byId.has('remote-only')).toBe(true); // union
  });
});

describe('quickadd recurrence', () => {
  const NOW = new Date(2026, 5, 10, 8, 0); // Wednesday

  it('"every day" becomes daily', () => {
    const p = parseQuickAdd('stretch every day', NOW);
    expect(p.repeat).toBe('daily');
    expect(p.text).toBe('stretch');
  });

  it('"every monday" becomes weekly on the right day', () => {
    const p = parseQuickAdd('gym every monday', NOW);
    expect(p.repeat).toBe('weekly');
    expect(p.date).toBe('2026-06-15');
  });

  it('"every month" with a time becomes a repeating event', () => {
    const p = parseQuickAdd('pay rent every month 9am', NOW);
    expect(p.repeat).toBe('monthly');
    expect(p.kind).toBe('event');
  });
});
