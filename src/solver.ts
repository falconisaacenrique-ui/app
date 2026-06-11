/**
 * The Solver — a simulated-annealing scheduler. Treats the week as an
 * optimization problem: place tasks (with durations, deadlines, priorities)
 * into the free gaps between calendar events, preferring the user's
 * productive hours.
 */
import { mulberry32 } from './oracle';

export interface SolverTask {
  id: string;
  text: string;
  duration: number; // minutes
  due?: string; // YYYY-MM-DD
  priority: 'low' | 'medium' | 'high';
}

export interface BusyBlock {
  date: string;
  start: number; // minutes from midnight
  end: number;
}

export interface PlanBlock {
  taskId: string;
  text: string;
  date: string;
  start: number;
  end: number;
}

export interface SolverInput {
  tasks: SolverTask[];
  busy: BusyBlock[];
  days: string[]; // ordered, first = today
  workStart: number; // minutes
  workEnd: number;
  hourWeight?: number[]; // 24 values, 0..1, higher = better hour
  dayStartMin?: number; // earliest start on days[0] (e.g. "now")
  seed?: number;
}

export interface Plan {
  blocks: PlanBlock[];
  unscheduled: SolverTask[];
}

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 } as const;

interface Slot {
  date: string;
  dayIndex: number;
  start: number;
  end: number;
}

function freeSlots(input: SolverInput): Slot[] {
  const slots: Slot[] = [];
  input.days.forEach((date, dayIndex) => {
    const busy = input.busy
      .filter((b) => b.date === date)
      .sort((a, b) => a.start - b.start);
    let cursor = Math.max(
      input.workStart,
      dayIndex === 0 ? (input.dayStartMin ?? input.workStart) : input.workStart,
    );
    for (const b of busy) {
      if (b.start > cursor) slots.push({ date, dayIndex, start: cursor, end: Math.min(b.start, input.workEnd) });
      cursor = Math.max(cursor, b.end);
    }
    if (cursor < input.workEnd) slots.push({ date, dayIndex, start: cursor, end: input.workEnd });
  });
  return slots.filter((s) => s.end - s.start >= 15);
}

/** Greedy placement of tasks (in the given order) into free slots. */
function place(order: SolverTask[], slots: Slot[]): { blocks: PlanBlock[]; unscheduled: SolverTask[] } {
  const remaining = slots.map((s) => ({ ...s }));
  const blocks: PlanBlock[] = [];
  const unscheduled: SolverTask[] = [];
  for (const task of order) {
    let placed = false;
    for (const slot of remaining) {
      if (slot.end - slot.start >= task.duration) {
        blocks.push({
          taskId: task.id,
          text: task.text,
          date: slot.date,
          start: slot.start,
          end: slot.start + task.duration,
        });
        slot.start += task.duration;
        placed = true;
        break;
      }
    }
    if (!placed) unscheduled.push(task);
  }
  return { blocks, unscheduled };
}

function energy(
  result: { blocks: PlanBlock[]; unscheduled: SolverTask[] },
  input: SolverInput,
  taskById: Map<string, SolverTask>,
): number {
  let e = 0;
  const dayIndex = new Map(input.days.map((d, i) => [d, i]));
  for (const b of result.blocks) {
    const task = taskById.get(b.taskId)!;
    const di = dayIndex.get(b.date) ?? 0;
    // late relative to deadline = heavy penalty
    if (task.due && b.date > task.due) e += 80 * PRIORITY_WEIGHT[task.priority];
    // high priority wants earlier days
    e += di * PRIORITY_WEIGHT[task.priority];
    // prefer productive hours
    if (input.hourWeight) {
      const hour = Math.floor(b.start / 60) % 24;
      e += (1 - (input.hourWeight[hour] ?? 0.5)) * 4;
    }
  }
  for (const t of result.unscheduled) {
    e += 200 * PRIORITY_WEIGHT[t.priority];
  }
  return e;
}

/** Simulated annealing over task orderings; placement is greedy per ordering. */
export function solve(input: SolverInput, iterations = 3000): Plan {
  const slots = freeSlots(input);
  const taskById = new Map(input.tasks.map((t) => [t.id, t]));
  if (input.tasks.length === 0) return { blocks: [], unscheduled: [] };

  const rand = mulberry32(input.seed ?? 1234);
  // sensible initial order: deadline first, then priority
  let order = [...input.tasks].sort((a, b) => {
    const da = a.due ?? '9999';
    const db = b.due ?? '9999';
    if (da !== db) return da.localeCompare(db);
    return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  });
  const initial = place(order, slots);
  let currentE = energy(initial, input, taskById);
  let best = initial;
  let bestE = currentE;

  for (let i = 0; i < iterations; i++) {
    const temp = 1 - i / iterations;
    const next = [...order];
    const a = Math.floor(rand() * next.length);
    const b = Math.floor(rand() * next.length);
    [next[a], next[b]] = [next[b], next[a]];
    const candidate = place(next, slots);
    const candidateE = energy(candidate, input, taskById);
    if (candidateE < currentE || rand() < Math.exp((currentE - candidateE) / (temp * 20 + 0.01))) {
      order = next;
      currentE = candidateE;
      if (candidateE < bestE) {
        best = candidate;
        bestE = candidateE;
      }
    }
  }
  best.blocks.sort((a, b) => (a.date === b.date ? a.start - b.start : a.date.localeCompare(b.date)));
  return best;
}

export function minutesToHM(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
