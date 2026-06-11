/**
 * The Oracle — on-device statistics. No models downloaded, no APIs:
 * hand-rolled logistic regression, Monte Carlo forecasting, kernel density
 * estimation, and correlation mining over the user's own data.
 */

// ---------- Logistic regression (gradient descent) ----------

export interface TrainSample {
  features: number[];
  label: 0 | 1;
}

export interface LogisticModel {
  weights: number[];
  bias: number;
  means: number[];
  stds: number[];
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

export function trainLogistic(samples: TrainSample[], epochs = 300, lr = 0.3): LogisticModel | null {
  if (samples.length < 6) return null;
  const dim = samples[0].features.length;
  // standardize features
  const means = Array(dim).fill(0);
  const stds = Array(dim).fill(0);
  for (const s of samples) s.features.forEach((f, i) => (means[i] += f / samples.length));
  for (const s of samples)
    s.features.forEach((f, i) => (stds[i] += (f - means[i]) ** 2 / samples.length));
  for (let i = 0; i < dim; i++) stds[i] = Math.sqrt(stds[i]) || 1;
  const X = samples.map((s) => s.features.map((f, i) => (f - means[i]) / stds[i]));
  const y = samples.map((s) => s.label);

  let weights = Array(dim).fill(0);
  let bias = 0;
  for (let e = 0; e < epochs; e++) {
    const gw = Array(dim).fill(0);
    let gb = 0;
    for (let n = 0; n < X.length; n++) {
      const p = sigmoid(X[n].reduce((acc, x, i) => acc + x * weights[i], bias));
      const err = p - y[n];
      X[n].forEach((x, i) => (gw[i] += (err * x) / X.length));
      gb += err / X.length;
    }
    weights = weights.map((w, i) => w - lr * gw[i]);
    bias -= lr * gb;
  }
  return { weights, bias, means, stds };
}

export function predictLogistic(model: LogisticModel, features: number[]): number {
  const z = features.reduce(
    (acc, f, i) => acc + ((f - model.means[i]) / model.stds[i]) * model.weights[i],
    model.bias,
  );
  return sigmoid(z);
}

// ---------- Monte Carlo budget forecast ----------

export interface Forecast {
  expected: number;
  low: number; // 10th percentile
  high: number; // 90th percentile
}

/** Seedable PRNG (mulberry32) so results are testable. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  // Box-Muller
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Forecast month-end spending from spent-so-far plus simulated remaining days
 * drawn from the historical daily-spend distribution.
 */
export function forecastSpend(
  spentSoFar: number,
  historicalDailySpends: number[],
  daysRemaining: number,
  runs = 500,
  seed = 42,
): Forecast | null {
  if (historicalDailySpends.length < 5 || daysRemaining < 0) return null;
  const mean = historicalDailySpends.reduce((a, b) => a + b, 0) / historicalDailySpends.length;
  const sd = Math.sqrt(
    historicalDailySpends.reduce((a, b) => a + (b - mean) ** 2, 0) / historicalDailySpends.length,
  );
  const rand = mulberry32(seed);
  const outcomes: number[] = [];
  for (let r = 0; r < runs; r++) {
    let total = spentSoFar;
    for (let d = 0; d < daysRemaining; d++) {
      total += Math.max(0, mean + sd * gaussian(rand));
    }
    outcomes.push(total);
  }
  outcomes.sort((a, b) => a - b);
  return {
    expected: outcomes[Math.floor(runs / 2)],
    low: outcomes[Math.floor(runs * 0.1)],
    high: outcomes[Math.floor(runs * 0.9)],
  };
}

// ---------- Circadian fingerprint (kernel density estimation) ----------

/** Density over the 24 hours from a list of hour-of-day observations. */
export function hourDensity(hours: number[], bandwidth = 1.5): number[] {
  const density = Array(24).fill(0);
  if (hours.length === 0) return density;
  for (let h = 0; h < 24; h++) {
    for (const obs of hours) {
      // circular distance so 23h and 1h are neighbours
      const d = Math.min(Math.abs(h - obs), 24 - Math.abs(h - obs));
      density[h] += Math.exp(-(d * d) / (2 * bandwidth * bandwidth));
    }
  }
  const max = Math.max(...density);
  return density.map((v) => (max > 0 ? v / max : 0));
}

/** The contiguous 3-hour window with the highest density. */
export function peakWindow(density: number[]): { start: number; end: number } | null {
  if (density.every((d) => d === 0)) return null;
  let best = 0;
  let bestStart = 0;
  for (let s = 0; s < 24; s++) {
    const sum = density[s] + density[(s + 1) % 24] + density[(s + 2) % 24];
    if (sum > best) {
      best = sum;
      bestStart = s;
    }
  }
  return { start: bestStart, end: (bestStart + 3) % 24 };
}

// ---------- Correlation mining ----------

export interface Correlation {
  label: string;
  r: number;
  n: number;
}

/** Pearson correlation between two equal-length series. */
export function pearson(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n < 3 || n !== b.length) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
  }
  if (va === 0 || vb === 0) return null;
  return cov / Math.sqrt(va * vb);
}
