/**
 * The rules engine — a tiny domain-specific language with its own
 * tokenizer, parser, and evaluator. Users program their life:
 *
 *   when habit "gym" streak >= 7 then add task "buy protein"
 *   when tasks overdue >= 3 then add note "triage day"
 *   when spent > 500 then add reminder "review spending"
 *   when all habits done then add note "perfect day"
 */

export interface RuleContext {
  habitStreak: (name: string) => number;
  tasksOverdue: number;
  spentThisMonth: number;
  allHabitsDoneToday: boolean;
}

export type RuleAction =
  | { type: 'task'; text: string }
  | { type: 'note'; text: string }
  | { type: 'reminder'; text: string };

export interface Rule {
  source: string;
  test: (ctx: RuleContext) => boolean;
  action: RuleAction;
}

type Token = { kind: 'word' | 'string' | 'number' | 'cmp'; value: string };

function tokenizeRule(src: string): Token[] | string {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === '"') {
      const end = src.indexOf('"', i + 1);
      if (end < 0) return 'unterminated string';
      tokens.push({ kind: 'string', value: src.slice(i + 1, end) });
      i = end + 1;
    } else if (/[<>=]/.test(ch)) {
      const two = src.slice(i, i + 2);
      if (two === '>=' || two === '<=') {
        tokens.push({ kind: 'cmp', value: two });
        i += 2;
      } else {
        tokens.push({ kind: 'cmp', value: ch });
        i++;
      }
    } else if (/[0-9]/.test(ch)) {
      const m = src.slice(i).match(/^\d+(\.\d+)?/)!;
      tokens.push({ kind: 'number', value: m[0] });
      i += m[0].length;
    } else if (/[a-zA-Z]/.test(ch)) {
      const m = src.slice(i).match(/^[a-zA-Z]+/)!;
      tokens.push({ kind: 'word', value: m[0].toLowerCase() });
      i += m[0].length;
    } else {
      return `unexpected character "${ch}"`;
    }
  }
  return tokens;
}

function compare(cmp: string, a: number, b: number): boolean {
  switch (cmp) {
    case '>': return a > b;
    case '>=': return a >= b;
    case '<': return a < b;
    case '<=': return a <= b;
    case '=': return a === b;
    default: return false;
  }
}

/** Parse one rule line. Returns a Rule or an error message. */
export function parseRule(source: string): Rule | string {
  const toks = tokenizeRule(source.trim());
  if (typeof toks === 'string') return toks;
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  const expectWord = (w: string): string | null =>
    peek()?.kind === 'word' && peek().value === w ? (next(), null) : `expected "${w}"`;

  let err = expectWord('when');
  if (err) return err;

  let test: (ctx: RuleContext) => boolean;
  const head = next();
  if (!head) return 'incomplete rule';

  if (head.kind === 'word' && head.value === 'habit') {
    const name = next();
    if (name?.kind !== 'string') return 'expected habit name in quotes';
    err = expectWord('streak');
    if (err) return err;
    const cmp = next();
    if (cmp?.kind !== 'cmp') return 'expected a comparison (>=, >, =, <, <=)';
    const num = next();
    if (num?.kind !== 'number') return 'expected a number';
    const n = Number(num.value);
    test = (ctx) => compare(cmp.value, ctx.habitStreak(name.value), n);
  } else if (head.kind === 'word' && head.value === 'tasks') {
    err = expectWord('overdue');
    if (err) return err;
    const cmp = next();
    if (cmp?.kind !== 'cmp') return 'expected a comparison';
    const num = next();
    if (num?.kind !== 'number') return 'expected a number';
    const n = Number(num.value);
    test = (ctx) => compare(cmp.value, ctx.tasksOverdue, n);
  } else if (head.kind === 'word' && head.value === 'spent') {
    const cmp = next();
    if (cmp?.kind !== 'cmp') return 'expected a comparison';
    const num = next();
    if (num?.kind !== 'number') return 'expected a number';
    const n = Number(num.value);
    test = (ctx) => compare(cmp.value, ctx.spentThisMonth, n);
  } else if (head.kind === 'word' && head.value === 'all') {
    err = expectWord('habits');
    if (err) return err;
    err = expectWord('done');
    if (err) return err;
    test = (ctx) => ctx.allHabitsDoneToday;
  } else {
    return `unknown condition "${head.value}" (try: habit, tasks overdue, spent, all habits done)`;
  }

  err = expectWord('then');
  if (err) return err;
  err = expectWord('add');
  if (err) return err;
  const kind = next();
  if (kind?.kind !== 'word' || !['task', 'note', 'reminder'].includes(kind.value)) {
    return 'expected an action: add task / add note / add reminder';
  }
  const text = next();
  if (text?.kind !== 'string') return 'expected the action text in quotes';
  if (pos !== toks.length) return 'unexpected trailing input';

  return {
    source: source.trim(),
    test,
    action: { type: kind.value as RuleAction['type'], text: text.value },
  };
}

/** Parse a rules file (one rule per line, # comments). */
export function parseRules(text: string): { rules: Rule[]; errors: { line: number; message: string }[] } {
  const rules: Rule[] = [];
  const errors: { line: number; message: string }[] = [];
  text.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const result = parseRule(trimmed);
    if (typeof result === 'string') errors.push({ line: i + 1, message: result });
    else rules.push(result);
  });
  return { rules, errors };
}

/** Evaluate rules; returns the actions of those whose condition holds. */
export function fireRules(rules: Rule[], ctx: RuleContext): Rule[] {
  return rules.filter((r) => r.test(ctx));
}
