import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { LABELS, type Algorithm } from '../src/search/solver';
const args = process.argv.slice(2), at = args.indexOf('--input'), folder = at >= 0 ? args[at + 1] : 'results/main';
const manifest = JSON.parse(await readFile(`${folder}/manifest.json`, 'utf8')), config = manifest.config;
const rows = (await readFile(`${folder}/raw.jsonl`, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
const instanceIds = [...new Set<string>(rows.map(r => r.instanceId))];
if (rows.length !== config.lengths.length * config.instancesPerLength * config.repetitions * config.algorithms.length) throw new Error('Incomplete experiment. Refusing to publish a partial summary.');
const median = (a: number[]): number | null => { if (!a.length) return null; const s = [...a].sort((a,b) => a-b), n = s.length; return n % 2 ? s[Math.floor(n/2)] : (s[n/2-1] + s[n/2]) / 2; };
const instances = config.algorithms.flatMap((algorithm: Algorithm) => instanceIds.map(instanceId => {
  const runs = rows.filter(r => r.algorithm === algorithm && r.instanceId === instanceId);
  if (runs.length !== config.repetitions || new Set(runs.map(r => r.repetition)).size !== config.repetitions) throw new Error('Duplicate or missing repetitions.');
  const completed = runs.every(r => r.status === 'solved' && r.verified);
  return { algorithm, instanceId, scrambleLength: runs[0].scrambleLength, completed,
    medianMs: completed ? median(runs.map(r => r.stats.searchMs)) : null,
    medianNodes: completed && runs.every(r => r.stats.expanded !== null) ? median(runs.map(r => r.stats.expanded)) : null,
    length: completed ? median(runs.map(r => r.solutionLength)) : null,
    optimal: completed && runs.every(r => r.optimality === 'proven') };
}));
const methods = config.algorithms.map((algorithm: Algorithm) => {
  const r = instances.filter((x:any) => x.algorithm === algorithm), completed = r.filter((x:any) => x.completed);
  return { algorithm, label: LABELS[algorithm], solved: completed.length,
    medianMs: median(completed.map((x:any) => x.medianMs)), medianLength: median(completed.map((x:any) => x.length)),
    statuses: Object.fromEntries(['solved','node-limit','timeout','depth-limit','error'].map(s => [s,rows.filter(r => r.algorithm === algorithm && r.status === s).length])),
    byLength: config.lengths.map((length:number) => {
      const all = r.filter((x:any) => x.scrambleLength === length), ok = all.filter((x:any) => x.completed);
      return { length, count: all.length, solved: ok.length, fraction: ok.length / all.length,
        medianNodes: median(ok.filter((x:any) => x.medianNodes !== null).map((x:any) => x.medianNodes)), medianMs: median(ok.map((x:any) => x.medianMs)) };
    }) };
});
const commonIds = instanceIds.filter(id => config.algorithms.filter((a:Algorithm) => a !== 'two-phase').every((a:Algorithm) => instances.find((x:any) => x.algorithm === a && x.instanceId === id)?.completed));
const paired = config.algorithms.map((algorithm:Algorithm) => {
  const r = instances.filter((x:any) => x.algorithm === algorithm && commonIds.includes(x.instanceId));
  return { algorithm, count: r.length, medianMs: median(r.map((x:any) => x.medianMs)), medianNodes: median(r.filter((x:any) => x.medianNodes !== null).map((x:any) => x.medianNodes)) };
});
const comparisons = ['ida-zero','ida-simple','ida-orientation'].map(algorithm => {
  const pairs = instanceIds.flatMap(id => {
    const a = instances.find((x:any) => x.algorithm === algorithm && x.instanceId === id), b = instances.find((x:any) => x.algorithm === 'ida-combined' && x.instanceId === id);
    return a?.completed && b?.completed ? [{ timeRatio: a.medianMs / Math.max(b.medianMs, 1e-9), nodeRatio: a.medianNodes / Math.max(b.medianNodes, 1) }] : [];
  });
  return { baseline: algorithm, count: pairs.length, medianTimeRatio: median(pairs.map(p => p.timeRatio)), medianNodeRatio: median(pairs.map(p => p.nodeRatio)) };
});
const referenceQuality = instanceIds.flatMap(id => {
  const known = instances.filter((x:any) => x.instanceId === id && x.optimal), ref = instances.find((x:any) => x.instanceId === id && x.algorithm === 'two-phase' && x.completed);
  if (!known.length || !ref) return [];
  if (new Set(known.map((x:any) => x.length)).size !== 1) throw new Error('Custom solvers disagree on optimal distance.');
  return [{ instanceId: id, optimum: known[0].length, reference: ref.length, excess: ref.length - known[0].length }];
});
const summary = { schema: 1, runId: manifest.runId, instances: instanceIds.length, repetitions: config.repetitions, limits: config.limits, lengths: config.lengths,
  methods, perInstance: instances, commonSolvedCount: commonIds.length, paired, comparisons,
  referenceQuality: { count: referenceQuality.length, matches: referenceQuality.filter(x => x.excess === 0).length, medianExcess: median(referenceQuality.map(x => x.excess)), details: referenceQuality } };
await writeFile(`${folder}/summary.json`, JSON.stringify(summary, null, 2) + '\n');
await mkdir('public/results', { recursive: true }); await mkdir('paper/figures', { recursive: true });
for (const name of ['summary.json','manifest.json','raw.jsonl']) await copyFile(`${folder}/${name}`, `public/results/${name}`);
await writeFile(`${folder}/instances.csv`, ['instance,algorithm,scramble_length,completed,median_ms,median_nodes,solution_length', ...instances.map((x:any) => [x.instanceId,x.algorithm,x.scrambleLength,x.completed,x.medianMs ?? '',x.medianNodes ?? '',x.length ?? ''].join(','))].join('\n') + '\n');
const names: Record<string,string> = { 'ida-zero':'H0: Uninformed', 'ida-simple':'H1: Cubie count', 'ida-orientation':'H2: Orientation', 'ida-combined':'H3: Combined', 'two-phase':'Two-phase reference' };
const table = methods.map((m:any) => `${names[m.algorithm]} & ${m.solved}/${summary.instances} & ${m.medianMs?.toFixed(2) ?? '--'} & ${m.medianLength ?? '--'} \\\\`).join('\n');
const h3 = methods.find((m:any) => m.algorithm === 'ida-combined'), h1 = methods.find((m:any) => m.algorithm === 'ida-simple'), h2 = methods.find((m:any) => m.algorithm === 'ida-orientation'), h0 = methods.find((m:any) => m.algorithm === 'ida-zero');
const cp = comparisons.find(x => x.baseline === 'ida-simple')!;
const macros = { InstanceCount: summary.instances, RepetitionCount: summary.repetitions, RunCount: rows.length, HZeroSolved: h0.solved, HOneSolved: h1.solved, HTwoSolved: h2.solved, HThreeSolved: h3.solved,
  CommonCount: commonIds.length, PairCount: cp.count, PairNodeRatio: cp.medianNodeRatio?.toFixed(1), PairTimeRatio: cp.medianTimeRatio?.toFixed(1), RefKnown: summary.referenceQuality.count, RefMatches: summary.referenceQuality.matches, RefExcess: summary.referenceQuality.medianExcess,
  DatabaseLoadMs: manifest.initializations[0].databaseLoadMs.toFixed(2), ReferenceInitMs: manifest.initializations[0].referenceInitializationMs.toFixed(2),
  PairedHOneMs: paired.find((m:any) => m.algorithm === 'ida-simple')!.medianMs?.toFixed(3),
  PairedHThreeMs: paired.find((m:any) => m.algorithm === 'ida-combined')!.medianMs?.toFixed(3),
  CustomTimeoutCount: rows.filter(r => r.algorithm !== 'two-phase' && r.status === 'timeout').length };
await writeFile('paper/generated-results.tex', '% Generated by npm run figures. Do not hand-edit.\n' + Object.entries(macros).map(([k,v]) => `\\newcommand{\\${k}}{${v}}`).join('\n') + '\n');
await writeFile('paper/generated-table.tex', '\\newcommand{\\ResultRows}{%\n' + table + '\n}\n');
const plotting = spawnSync('python', ['scripts/plot.py', folder], { stdio: 'inherit' });
if (plotting.status !== 0) throw new Error('Figure generation failed. Install requirements.txt.');
console.log(JSON.stringify({ methods: methods.map((m:any) => ({ algorithm:m.algorithm,solved:m.solved,medianMs:m.medianMs })), comparisons, referenceQuality: { count:summary.referenceQuality.count, matches:summary.referenceQuality.matches, medianExcess:summary.referenceQuality.medianExcess } }, null, 2));
