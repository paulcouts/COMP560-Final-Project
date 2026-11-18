import { parentPort } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { apply, deserialize, solved } from '../src/cube/state';
import { decodeDatabase, type Coordinate, type Tables } from '../src/search/pdb';
import { solve } from '../src/search/solver';
import { initializeReference, solveReference } from '../src/reference/two-phase';
export async function runWorker(): Promise<void> {
  const begin = performance.now();
  const manifest = JSON.parse(await readFile('public/pdb/manifest.json', 'utf8'));
  const loaded = await Promise.all((['co','eo','cp'] as Coordinate[]).map(async kind => {
    const bytes = await readFile(`public/pdb/${kind}.bin`);
    if (createHash('sha256').update(bytes).digest('hex') !== manifest.tables[kind].sha256) throw new Error('PDB checksum mismatch.');
    return decodeDatabase(kind, bytes);
  }));
  const tables: Tables = { co: loaded[0], eo: loaded[1], cp: loaded[2] };
  const databaseLoadMs = performance.now() - begin, referenceInitializationMs = initializeReference();
  for (const seq of ['R U F', 'L D B', 'R2 U F2 L']) {
    for (const alg of ['ida-zero','ida-simple','ida-orientation','ida-combined'] as const) solve(apply(solved(), seq), alg, { timeMs: 1000, nodeLimit: 10000, maxDepth: 8 }, tables);
    solveReference(apply(solved(), seq));
  }
  parentPort!.postMessage({ type: 'initialized', databaseLoadMs, referenceInitializationMs });
  parentPort!.on('message', ({ state, algorithm, limits }) => {
    parentPort!.postMessage({ type: 'started' });
    try {
      const cube = deserialize(state);
      const result = algorithm === 'two-phase' ? solveReference(cube) : solve(cube, algorithm, limits, tables);
      parentPort!.postMessage({ type: 'result', result });
    } catch (e) { parentPort!.postMessage({ type: 'failed', error: String(e) }); }
  });
}
