/**
 * The Garden — L-system botany. Each habit grows a deterministic,
 * unique plant; streaks add growth iterations, flowers appear at
 * milestone streaks. Pure turtle-graphics on canvas.
 */
import { mulberry32 } from './oracle';

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Expand an L-system axiom n times under the given rules. */
export function expand(axiom: string, rules: Record<string, string>, iterations: number): string {
  let s = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = '';
    for (const ch of s) next += rules[ch] ?? ch;
    s = next;
    if (s.length > 30000) break; // safety cap
  }
  return s;
}

export interface PlantSpec {
  instructions: string;
  angle: number; // radians
  segment: number; // px per F
  flower: boolean;
  iterations: number;
}

/** Deterministic plant for a habit: growth from streak + lifetime checks. */
export function plantFor(habitId: string, streakDays: number, totalChecks: number): PlantSpec {
  const seed = hashString(habitId);
  const rand = mulberry32(seed);
  // species: one of a few branching grammars, chosen by seed
  const grammars = [
    { X: 'F[+X][-X]FX', F: 'FF' },
    { X: 'F[+X]F[-X]+X', F: 'FF' },
    { X: 'F[-X][+X]FX', F: 'FF' },
  ];
  const rules = grammars[seed % grammars.length];
  const growth = Math.min(5, 1 + Math.floor(Math.log2(1 + streakDays + totalChecks / 4)));
  return {
    instructions: expand('X', rules, growth),
    angle: (18 + rand() * 14) * (Math.PI / 180),
    segment: Math.max(1.6, 7 - growth),
    flower: streakDays >= 7,
    iterations: growth,
  };
}

interface Turtle {
  x: number;
  y: number;
  heading: number;
}

/** Draw a plant with its base at (x, baseY). */
export function drawPlant(
  ctx: CanvasRenderingContext2D,
  spec: PlantSpec,
  x: number,
  baseY: number,
  stemColor: string,
  flowerColor: string,
): void {
  const stack: Turtle[] = [];
  let t: Turtle = { x, y: baseY, heading: -Math.PI / 2 };
  ctx.strokeStyle = stemColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const tips: { x: number; y: number }[] = [];
  for (const ch of spec.instructions) {
    if (ch === 'F') {
      const nx = t.x + Math.cos(t.heading) * spec.segment;
      const ny = t.y + Math.sin(t.heading) * spec.segment;
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(nx, ny);
      t = { ...t, x: nx, y: ny };
    } else if (ch === '+') {
      t = { ...t, heading: t.heading + spec.angle };
    } else if (ch === '-') {
      t = { ...t, heading: t.heading - spec.angle };
    } else if (ch === '[') {
      stack.push({ ...t });
    } else if (ch === ']') {
      tips.push({ x: t.x, y: t.y });
      t = stack.pop() ?? t;
    }
  }
  ctx.stroke();
  if (spec.flower) {
    ctx.fillStyle = flowerColor;
    for (const tip of tips.filter((_, i) => i % 3 === 0).slice(0, 24)) {
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
