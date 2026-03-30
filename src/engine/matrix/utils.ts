/**
 * Matrix utility functions for the physics engine.
 */

/** Create a zero-filled Float64Array */
export function zeros(n: number): Float64Array {
  return new Float64Array(n);
}

/** Create a Float64Array filled with a given value */
export function filled(n: number, val: number): Float64Array {
  const arr = new Float64Array(n);
  arr.fill(val);
  return arr;
}

/** Compute L2 norm of a vector */
export function norm2(v: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i];
  }
  return Math.sqrt(sum);
}

/** Compute relative difference between two vectors: ||a-b|| / ||a|| */
export function relDiff(a: Float64Array, b: Float64Array): number {
  let diffSq = 0;
  let normSq = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    diffSq += d * d;
    normSq += a[i] * a[i];
  }
  if (normSq === 0) return diffSq > 0 ? Infinity : 0;
  return Math.sqrt(diffSq / normSq);
}

/** Copy Float64Array */
export function copyArray(src: Float64Array): Float64Array {
  return new Float64Array(src);
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp value between min and max */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Compute trapezoidal integral of f over [0, 1] given uniform samples */
export function trapezoidalIntegral(f: Float64Array, dx: number): number {
  const n = f.length;
  if (n < 2) return 0;
  let sum = 0.5 * (f[0] + f[n - 1]);
  for (let i = 1; i < n - 1; i++) {
    sum += f[i];
  }
  return sum * dx;
}
