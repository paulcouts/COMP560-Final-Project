import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { buildDatabase, encodeDatabase, type Coordinate } from '../src/search/pdb';
await mkdir('public/pdb', { recursive: true });
const tables: Record<string, unknown> = {};
for (const kind of ['co', 'eo', 'cp'] as Coordinate[]) {
  const start = performance.now(), db = buildDatabase(kind), bytes = encodeDatabase(db);
  tables[kind] = { entries: db.distances.length, distanceBytes: db.distances.byteLength, transitionBytes: db.transitions.byteLength,
    maximumDistance: Math.max(...db.distances), buildMs: performance.now() - start, sha256: createHash('sha256').update(bytes).digest('hex') };
  await writeFile(`public/pdb/${kind}.bin`, bytes); console.log(`${kind}: ${db.distances.length} states, ${bytes.length} bytes`);
}
await writeFile('public/pdb/manifest.json', JSON.stringify({ schema: 1, convention: 'Kociemba URFDLB; destination indexed', metric: 'HTM',
  generatedAt: new Date().toISOString(), sourceCommit: execSync('git rev-parse HEAD').toString().trim(), tables }, null, 2) + '\n');
