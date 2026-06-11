import { useEffect, useRef } from 'react';
import { drawPlant, plantFor } from '../garden';
import { streak, todayStr } from '../utils';
import type { Habit, Task } from '../types';

interface Props {
  habits: Habit[];
  tasks: Task[];
  overBudget: boolean;
}

export default function Garden({ habits, tasks, overBudget }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const today = todayStr();
  const tasksDoneTotal = tasks.filter((t) => t.done).length;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parentW = canvas.parentElement?.clientWidth ?? 340;
    const W = Math.min(860, parentW - 2);
    const H = 300;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const style = getComputedStyle(document.documentElement);
    const stem = style.getPropertyValue('--text').trim() || '#161616';
    const accent = style.getPropertyValue('--accent').trim() || '#4f46e5';
    const mutedColor = style.getPropertyValue('--muted').trim() || '#6b6b6b';

    const groundY = H - 36;

    // weather: sun when within budget, rain when over
    ctx.strokeStyle = mutedColor;
    ctx.lineWidth = 1;
    if (!overBudget) {
      const sx = W - 54;
      const sy = 44;
      ctx.beginPath();
      ctx.arc(sx, sy, 14, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * 20, sy + Math.sin(a) * 20);
        ctx.lineTo(sx + Math.cos(a) * 26, sy + Math.sin(a) * 26);
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < 26; i++) {
        const x = 20 + ((i * 73) % (W - 40));
        const y = 24 + ((i * 37) % 80);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + 9);
        ctx.stroke();
      }
    }

    // ground
    ctx.strokeStyle = mutedColor;
    ctx.beginPath();
    ctx.moveTo(12, groundY);
    ctx.lineTo(W - 12, groundY);
    ctx.stroke();

    // a fence post per 5 completed tasks (cap 12) — your work builds the place
    const posts = Math.min(12, Math.floor(tasksDoneTotal / 5));
    for (let i = 0; i < posts; i++) {
      const x = 20 + i * 12;
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x, groundY - 12);
      ctx.stroke();
    }

    // plants
    const n = habits.length;
    habits.forEach((h, i) => {
      const x = n === 1 ? W / 2 : 60 + (i * (W - 120)) / Math.max(1, n - 1);
      const spec = plantFor(h.id, streak(h.doneDates), h.doneDates.length);
      drawPlant(ctx, spec, x, groundY, stem, accent);
      ctx.fillStyle = mutedColor;
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      const label = h.name.length > 14 ? h.name.slice(0, 13) + '…' : h.name;
      ctx.fillText(label, x, groundY + 16);
    });
  }, [habits, overBudget, tasksDoneTotal, today]);

  const bestStreak = habits.reduce((best, h) => Math.max(best, streak(h.doneDates)), 0);

  return (
    <div className="view">
      <header className="view-header">
        <h1>Garden</h1>
        <p className="muted">
          Grown from your real life: habits are plants (streaks make them flower), finished tasks
          build the fence, and the weather is your budget.
        </p>
      </header>

      {habits.length === 0 ? (
        <p className="muted empty-note">Plant something — add a habit and it sprouts here.</p>
      ) : (
        <section className="card garden-card">
          <canvas ref={canvasRef} aria-label="Your garden" />
          <p className="muted small">
            {habits.length} plant{habits.length > 1 ? 's' : ''}
            {bestStreak > 0 && <> · longest streak {bestStreak} days</>}
            {' · '}
            {overBudget ? 'raining (over budget)' : 'sunny (within budget)'}
          </p>
        </section>
      )}
    </div>
  );
}
