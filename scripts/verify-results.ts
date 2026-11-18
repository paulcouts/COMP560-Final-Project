/** Audit saved measurements without rerunning search or trusting the verified flag. */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import Cube from 'cubejs';
import { apply, deserialize, format, isSolved, toFacelets } from '../src/cube/state';
const args = process.argv.slice(2), at = args.indexOf('--input');
const folder = at < 0 ? 'results/main' : args[at + 1];
const manifest = JSON.parse(await readFile(`${folder}/manifest.json`, 'utf8'));
const hash = (x: string | Uint8Array) => createHash('sha256').update(x).digest('hex');
assert.equal(hash(await readFile(manifest.config.corpus)), manifest.corpusSha256, 'Corpus changed');
assert.equal(hash(await readFile('package-lock.json')), manifest.lockfileSha256, 'Dependencies changed');
const records: string[] = [];
async function walk(dir: string) {
  for (const e of (await readdir(dir, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    const path = `${dir}/${e.name}`;
    if (e.isDirectory()) await walk(path);
    else if (/\.(ts|mjs)$/.test(path)) records.push(`${path}:${hash(await readFile(path))}`);
  }
}
for (const dir of ['src/cube','src/search','src/reference']) await walk(dir);
for (const p of ['scripts/benchmark.ts','scripts/benchmark-worker.mjs','scripts/worker-task.ts']) records.push(`${p}:${hash(await readFile(p))}`);
assert.equal(hash(records.join('\n')), manifest.solverSourceSha256, 'Solver differs from the measured version; rerun benchmarks');
for (const kind of ['co','eo','cp']) assert.equal(hash(await readFile(`public/pdb/${kind}.bin`)), manifest.databaseManifest.tables[kind].sha256, `${kind} table changed`);
const corpus = JSON.parse(await readFile(manifest.config.corpus, 'utf8'));
const instances = new Map<string, any>(corpus.instances.map((i: any) => [i.id, i]));
const rows = (await readFile(`${folder}/raw.jsonl`, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
const cfg = manifest.config;
assert.equal(rows.length, instances.size * cfg.algorithms.length * cfg.repetitions, 'Incomplete run');
const seen = new Set<string>(), optima = new Map<string, number>();
let verified = 0;
for (const row of rows) {
  const id = `${row.instanceId}/${row.algorithm}/${row.repetition}`;
  assert(!seen.has(id), `Duplicate ${id}`); seen.add(id);
  assert(instances.has(row.instanceId)); assert(cfg.algorithms.includes(row.algorithm));
  assert(Number.isInteger(row.repetition) && row.repetition >= 0 && row.repetition < cfg.repetitions);
  assert.equal(row.runId, manifest.runId); assert.deepEqual(row.limits, cfg.limits);
  assert.deepEqual(row.state, instances.get(row.instanceId).state);
  assert(Number.isFinite(row.stats.searchMs) && row.stats.searchMs >= 0);
  if (row.status !== 'solved') { assert.equal(row.moves, null); assert.equal(row.verified, false); continue; }
  const state = deserialize(row.state), replay = apply(state, row.moves);
  assert(isSolved(replay), `${id}: custom replay failed`);
  const independent = Cube.fromString(toFacelets(state)).move(format(row.moves));
  assert(independent.isSolved(), `${id}: independent replay failed`);
  assert.equal(row.solutionLength, row.moves.length); assert.equal(row.solution, format(row.moves));
  assert.equal(row.verified, true);
  if (row.algorithm !== 'two-phase') {
    assert.equal(row.optimality, 'proven');
    if (optima.has(row.instanceId)) assert.equal(row.moves.length, optima.get(row.instanceId), 'Optimal lengths disagree');
    optima.set(row.instanceId, row.moves.length);
  }
  verified++;
}
console.log(`Audited ${rows.length} measurements, ${verified} solutions replayed in two engines; source, corpus, dependency, and database hashes match.`);
