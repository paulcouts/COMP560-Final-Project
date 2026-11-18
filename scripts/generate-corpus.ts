import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { apply, format, key, serialize, solved } from '../src/cube/state';
import { scramble } from '../src/cube/random';
const args = process.argv.slice(2);
const configPath = args.includes('--config') ? args[args.indexOf('--config') + 1] : 'experiments/main.json';
const config = JSON.parse(await readFile(configPath, 'utf8'));
const seed = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : config.seed;
if (!Number.isSafeInteger(seed)) throw new Error('Seed must be an integer.');
const seen = new Set<string>(), instances = [];
let nextSeed = seed;
for (const length of config.lengths as number[]) {
  let accepted = 0;
  while (accepted < config.instancesPerLength) {
    const instanceSeed = nextSeed++, moves = scramble(length, instanceSeed), state = apply(solved(), moves), stateKey = key(state);
    if (seen.has(stateKey)) continue; seen.add(stateKey);
    instances.push({ id: `L${length}-${String(++accepted).padStart(2, '0')}`, seed: instanceSeed, scrambleLength: length, scramble: format(moves), state: serialize(state) });
  }
}
const corpus = { schema: 1, seed, metric: 'HTM', sampling: 'Seeded random walk; no consecutive same-face turns; deduplicated states; not uniform.', instances };
await mkdir('data', { recursive: true });
const text = JSON.stringify(corpus, null, 2) + '\n'; await writeFile(config.corpus, text);
console.log(`${instances.length} instances -> ${config.corpus}; sha256 ${createHash('sha256').update(text).digest('hex')}`);
