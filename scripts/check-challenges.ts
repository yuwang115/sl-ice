/**
 * Play every challenge headlessly with reference strategies and check that
 * each ends the way its description and hints promise.
 *
 *   npm run challenges:check          # all cases, in parallel
 *   npm run challenges:check -- 2 5   # only the cases of challenges 2 and 5
 *
 * Re-run after any change to the physics, a scenario file or a challenge
 * definition. Outcomes are judged by the same rules the game store applies
 * (buildCheckState + resolveChallengeOutcome on every model step).
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { challenges } from '../src/challenges';
import { buildCheckState, resolveChallengeOutcome, type ChallengeOutcome } from '../src/challenges/outcome';
import { defaultParams, extractStatePayload, initializeModel, stepPhysics } from '../src/engine/physics';
import type { ScenarioConfig, UserParams } from '../src/engine/types';

/** Same step the app uses (useSimulationBridge). */
const DT_YEARS = 0.1;

interface ParamChange {
  readonly year: number;
  readonly params: Partial<UserParams>;
}

interface Case {
  readonly challenge: number;
  readonly label: string;
  /** Applied on top of the challenge's initial params at year 0. */
  readonly params?: Partial<UserParams>;
  readonly schedule?: readonly ParamChange[];
  readonly expect: ChallengeOutcome;
}

const at = (year: number, params: Partial<UserParams>): ParamChange => ({ year, params });

const CASES: readonly Case[] = [
  { challenge: 1, label: 'no action', expect: 'time_up' },
  { challenge: 1, label: 'ocean back to +0°C at year 100', schedule: [at(100, { T_ocean_delta: 0 })], expect: 'won' },
  { challenge: 1, label: '1.6x snowfall', params: { precip_scale: 1.6 }, expect: 'won' },
  { challenge: 1, label: 'ocean +5°C', params: { T_ocean_delta: 5 }, expect: 'lost' },
  { challenge: 2, label: 'no action', expect: 'time_up' },
  { challenge: 2, label: 'ocean back to +0°C at year 150', schedule: [at(150, { T_ocean_delta: 0 })], expect: 'won' },
  { challenge: 2, label: 'ocean back to +0°C at year 400', schedule: [at(400, { T_ocean_delta: 0 })], expect: 'lost' },
  { challenge: 3, label: 'no action', expect: 'time_up' },
  { challenge: 3, label: 'ocean back to +0°C at year 30', schedule: [at(30, { T_ocean_delta: 0 })], expect: 'won' },
  { challenge: 3, label: 'ocean +5°C', params: { T_ocean_delta: 5 }, expect: 'lost' },
  { challenge: 4, label: 'no action', expect: 'lost' },
  { challenge: 4, label: 'drainage 3 /yr at year 50', schedule: [at(50, { drain_efficiency: 3 })], expect: 'won' },
  { challenge: 4, label: 'drainage 3 /yr at year 150', schedule: [at(150, { drain_efficiency: 3 })], expect: 'time_up' },
  { challenge: 5, label: 'no action', expect: 'time_up' },
  {
    challenge: 5, label: 'ocean -1°C, 1.5x snow, atmosphere +0°C at year 100',
    schedule: [at(100, { T_atm_delta: 0, T_ocean_delta: -1, precip_scale: 1.5 })], expect: 'won',
  },
  {
    challenge: 5, label: 'same rescue at year 300',
    schedule: [at(300, { T_atm_delta: 0, T_ocean_delta: -1, precip_scale: 1.5 })], expect: 'lost',
  },
  { challenge: 6, label: 'no action (barrier under grounded ice)', expect: 'time_up' },
  { challenge: 6, label: 'barrier at 800 km, 50%', params: { curtain_position: 800, curtain_efficiency: 0.5 }, expect: 'won' },
  { challenge: 6, label: 'barrier at 700 km, 30%', params: { curtain_position: 700, curtain_efficiency: 0.3 }, expect: 'time_up' },
  { challenge: 7, label: 'watch', expect: 'won' },
];

interface Result {
  readonly outcome: ChallengeOutcome | null;
  readonly year: number;
  readonly volumeChange: number;
  readonly seaLevel: number;
  readonly glKm: number;
}

function play(c: Case): Result {
  const challenge = challenges.find((ch) => ch.id === c.challenge);
  if (!challenge) throw new Error(`Unknown challenge ${c.challenge}`);
  const path = resolve(process.cwd(), 'public/data/scenarios', `${challenge.scenario}.json`);
  const config = JSON.parse(readFileSync(path, 'utf8')) as ScenarioConfig;

  const state = initializeModel(config);
  state.params = {
    ...defaultParams(), enable_hydrology: challenge.enable_hydrology,
    ...challenge.initial_params, ...c.params,
  };
  state.velocity_stale = true;
  const initialVolume = state.volume;
  const pending = [...(c.schedule ?? [])].sort((a, b) => a.year - b.year);
  let hysteresisLocked = false;
  let outcome: ChallengeOutcome | null = null;

  while (outcome === null && state.year <= challenge.duration_years + 1) {
    while (pending.length > 0 && state.year >= pending[0].year) {
      state.params = { ...state.params, ...pending.shift()!.params };
      state.velocity_stale = true; // as the worker does on update_params
    }
    const { events } = stepPhysics(state, config, DT_YEARS);
    hysteresisLocked ||= events.some((e) => e.type === 'hysteresis_locked');
    const check = buildCheckState(extractStatePayload(state), initialVolume, hysteresisLocked);
    outcome = resolveChallengeOutcome(challenge, check, state.year);
  }
  return {
    outcome,
    year: state.year,
    volumeChange: state.volume / initialVolume - 1,
    seaLevel: state.sea_level,
    glKm: state.gl_position / 1000,
  };
}

/** Run one case per child process (the engine is single-threaded). */
function runInChild(index: number): Promise<Result> {
  const script = fileURLToPath(import.meta.url);
  return new Promise((done, fail) => {
    const child = spawn('npx', ['vite-node', script, '--case', String(index)], { stdio: ['ignore', 'pipe', 'inherit'] });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    child.on('error', fail);
    child.on('close', (code) => {
      const line = output.trim().split('\n').pop() ?? '';
      if (code !== 0 || !line.startsWith('{')) {
        fail(new Error(`case ${index} exited with ${code}`));
        return;
      }
      done(JSON.parse(line) as Result);
    });
  });
}

async function runAll(indices: number[]): Promise<Map<number, Result>> {
  const results = new Map<number, Result>();
  const queue = [...indices];
  const workers = Array.from({ length: Math.min(queue.length, availableParallelism()) }, async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      results.set(next, await runInChild(next));
    }
  });
  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const caseFlag = args.indexOf('--case');
  if (caseFlag >= 0) {
    console.log(JSON.stringify(play(CASES[Number(args[caseFlag + 1])])));
    return;
  }

  const only = args.map(Number).filter((id) => Number.isInteger(id));
  const indices = CASES.map((_, i) => i).filter((i) => only.length === 0 || only.includes(CASES[i].challenge));
  const results = await runAll(indices);

  let failures = 0;
  for (const i of indices) {
    const c = CASES[i];
    const r = results.get(i)!;
    const ok = r.outcome === c.expect;
    if (!ok) failures++;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ch${c.challenge} ${c.label.padEnd(52)} ${String(r.outcome).padEnd(8)}` +
      `(expected ${c.expect.padEnd(7)}) year ${r.year.toFixed(0).padStart(4)}  ` +
      `ΔV ${(r.volumeChange * 100).toFixed(1).padStart(6)}%  SL ${r.seaLevel.toFixed(2)} m  GL ${r.glKm.toFixed(0)} km`,
    );
  }
  if (failures > 0) {
    console.error(`${failures} of ${indices.length} cases did not end as expected.`);
    process.exit(1);
  }
  console.log(`All ${indices.length} cases ended as expected.`);
}

await main();
