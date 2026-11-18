import { Worker } from 'node:worker_threads';
import { readFile, writeFile, appendFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import os from 'node:os';
import { rng } from '../src/cube/random';
import { apply, deserialize, isSolved, format, type SerializedCube } from '../src/cube/state';
import type { Algorithm, Limits, SolveResult } from '../src/search/solver';
const argv = process.argv.slice(2), at = argv.indexOf('--config');
const configPath = at >= 0 ? argv[at + 1] : 'experiments/main.json';
const config = JSON.parse(await readFile(configPath, 'utf8'));
const corpusText = await readFile(config.corpus, 'utf8'), corpus = JSON.parse(corpusText);
const hash = (x: string | Uint8Array) => createHash('sha256').update(x).digest('hex');
async function sourceHash(): Promise<string> {
  const records: string[] = [];
  async function walk(dir: string) {
    for (const e of (await readdir(dir, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
      const path = `${dir}/${e.name}`;
      if (e.isDirectory()) await walk(path); else if (/\.(ts|mjs)$/.test(path)) records.push(`${path}:${hash(await readFile(path))}`);
    }
  }
  await walk('src/cube'); await walk('src/search'); await walk('src/reference');
  for (const p of ['scripts/benchmark.ts','scripts/benchmark-worker.mjs','scripts/worker-task.ts']) records.push(`${p}:${hash(await readFile(p))}`);
  return hash(records.join('\n'));
}
await mkdir(config.output, { recursive: true });
const file = `${config.output}/raw.jsonl`;
// An explicit run replaces this named output. The README explains how to keep separate runs.
await writeFile(file, '');
const runId = new Date().toISOString(), metadata: Record<string, unknown> = {
  runId, config, configSha256: hash(await readFile(configPath)), corpusSha256: hash(corpusText), solverSourceSha256: await sourceHash(),
  lockfileSha256: hash(await readFile('package-lock.json')), databaseManifest: JSON.parse(await readFile('public/pdb/manifest.json','utf8')),
  node: process.version, platform: process.platform, os: os.release(), arch: process.arch,
  cpu: os.cpus()[0]?.model, logicalCores: os.cpus().length,
  commit: execSync('git rev-parse HEAD').toString().trim(), workingTreeDirty: execSync('git status --porcelain').toString().trim().length > 0,
  timing: 'Sequential worker; warm tables; three shallow warmup scrambles per method; wall-clock watchdog starts after worker started message. Custom timer checks at most 1024 generated nodes apart.',
  initializations: []
};
let worker: Worker | undefined;
async function ensureWorker() {
  if (worker) return;
  worker = new Worker(new URL('./benchmark-worker.mjs', import.meta.url));
  const current = worker;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { void current.terminate(); reject(new Error('Worker initialization timeout')); }, 60_000);
    current.once('error', e => { clearTimeout(timer); reject(e); });
    current.once('message', m => { clearTimeout(timer); (metadata.initializations as unknown[]).push(m); resolve(); });
  });
}
async function run(state: SerializedCube, algorithm: Algorithm, limits: Limits): Promise<SolveResult> {
  await ensureWorker(); const current = worker!;
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => { clearTimeout(timer); current.off('message', onMessage); current.off('error', onError); };
    const onError = (e: Error) => { cleanup(); reject(e); };
    const onMessage = (m: any) => {
      if (m.type === 'started') timer = setTimeout(() => {
        cleanup(); void current.terminate(); worker = undefined;
        resolve({ status: 'timeout', moves: null, verified: false, optimality: 'not-applicable',
          stats: { initializationMs: 0, searchMs: limits.timeMs, expanded: null, generated: null, iterations: null, lastThreshold: null } });
      }, limits.timeMs + 150);
      else if (m.type === 'result') { cleanup(); resolve(m.result); }
      else if (m.type === 'failed') { cleanup(); reject(new Error(m.error)); }
    };
    current.on('message', onMessage); current.on('error', onError); current.postMessage({ state, algorithm, limits });
  });
}
const random = rng(config.seed), jobs: { instance: any; algorithm: Algorithm; repetition: number }[] = [];
for (let repetition = 0; repetition < config.repetitions; repetition++) {
  const block = corpus.instances.flatMap((instance: any) => config.algorithms.map((algorithm: Algorithm) => ({ instance, algorithm, repetition })));
  for (let i = block.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [block[i],block[j]] = [block[j],block[i]]; }
  jobs.push(...block);
}
try {
  for (let i = 0; i < jobs.length; i++) {
    const { instance, algorithm, repetition } = jobs[i], result = await run(instance.state, algorithm, config.limits);
    if (result.status === 'solved' && (!result.moves || !isSolved(apply(deserialize(instance.state), result.moves)))) throw new Error(`Independent verification failed: ${instance.id}`);
    const row = { runId, instanceId: instance.id, seed: instance.seed, scrambleLength: instance.scrambleLength, scramble: instance.scramble,
      state: instance.state, algorithm, repetition, limits: config.limits, ...result,
      solution: result.moves ? format(result.moves) : null, solutionLength: result.moves?.length ?? null };
    await appendFile(file, JSON.stringify(row) + '\n');
    if ((i + 1) % 25 === 0 || i === jobs.length - 1) console.log(`${i + 1}/${jobs.length}: ${instance.id} ${algorithm} ${result.status}`);
  }
} finally {
  await worker?.terminate(); metadata.completedAt = new Date().toISOString();
  await writeFile(`${config.output}/manifest.json`, JSON.stringify(metadata, null, 2) + '\n');
}
console.log(`Saved ${file}`);
