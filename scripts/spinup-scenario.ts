/**
 * Spin an idealized scenario up to steady state under default parameters and
 * write the result back as its `initial_H`.
 *
 *   npm run scenarios:spinup -- <scenario-name> [maxYears]
 *   e.g. npm run scenarios:spinup -- scenario_b_misi
 *
 * Converged = after ≥ 1000 model years, the volume changes by < 0.1 % and the
 * grounding line moves by < 2 km over a 100-year window. Re-run this whenever
 * the physics changes; tests/engine/physics.test.ts guards the shipped files.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeModel, stepPhysics } from '../src/engine/physics';
import type { ScenarioConfig } from '../src/engine/types';

const DT_YEARS = 0.1;
const WINDOW_YEARS = 100;
const MIN_YEARS = 1000;
const VOLUME_TOL = 1e-3;
const GL_TOL_KM = 2;

function formatArray(name: string, values: number[]): string {
  const rows: string[] = [];
  for (let i = 0; i < values.length; i += 10) {
    rows.push('    ' + values.slice(i, i + 10).join(', '));
  }
  return `  "${name}": [\n${rows.join(',\n')}\n  ]`;
}

/** Same layout as the hand-written files: scalars first, then 10-per-line arrays. */
function serialize(config: Record<string, unknown>): string {
  const arrayKeys = ['bedrock', 'initial_H'];
  const scalars = Object.entries(config)
    .filter(([key]) => !arrayKeys.includes(key))
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  const arrays = arrayKeys
    .filter((key) => Array.isArray(config[key]))
    .map((key) => formatArray(key, config[key] as number[]));
  return `{\n${[...scalars, ...arrays].join(',\n')}\n}\n`;
}

function spinUp(config: ScenarioConfig, maxYears: number) {
  const state = initializeModel(config);
  let lastVolume = state.volume;
  let lastGl = state.gl_position;
  let nextCheck = WINDOW_YEARS;
  let converged = false;

  while (state.year < maxYears && !converged) {
    stepPhysics(state, config, DT_YEARS);
    if (state.H.some((v) => !Number.isFinite(v))) {
      throw new Error(`Non-finite thickness at year ${state.year.toFixed(1)}`);
    }
    if (state.year < nextCheck) continue;

    const dVolume = (state.volume - lastVolume) / lastVolume;
    const dGlKm = (state.gl_position - lastGl) / 1000;
    console.log(
      `year ${state.year.toFixed(0).padStart(5)}  volume ${state.volume.toFixed(1)} km³ ` +
      `(${(dVolume * 100).toFixed(3)} %/${WINDOW_YEARS} yr)  GL ${(state.gl_position / 1000).toFixed(1)} km`,
    );
    converged = state.year >= MIN_YEARS && Math.abs(dVolume) < VOLUME_TOL && Math.abs(dGlKm) < GL_TOL_KM;
    lastVolume = state.volume;
    lastGl = state.gl_position;
    nextCheck += WINDOW_YEARS;
  }
  return { state, converged };
}

function main(): void {
  const [name, maxArg] = process.argv.slice(2);
  if (!name) {
    console.error('usage: npm run scenarios:spinup -- <scenario-name> [maxYears]');
    process.exit(1);
  }
  const path = resolve(process.cwd(), 'public/data/scenarios', `${name}.json`);
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  // Spin up from the analytic default profile, not a previous spin-up.
  const { initial_H: _previous, ...base } = raw;
  void _previous;

  const { state, converged } = spinUp(base as unknown as ScenarioConfig, Number(maxArg ?? 10000));
  if (!converged) {
    console.error(`Not converged after ${state.year.toFixed(0)} years — file left unchanged.`);
    process.exit(2);
  }
  const updated = { ...base, initial_H: Array.from(state.H, (v) => Math.round(v)) };
  writeFileSync(path, serialize(updated));
  console.log(`Wrote ${path} (GL ${(state.gl_position / 1000).toFixed(1)} km after ${state.year.toFixed(0)} years)`);
}

main();
