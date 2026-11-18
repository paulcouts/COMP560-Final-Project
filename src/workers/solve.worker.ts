import { deserialize, type SerializedCube } from '../cube/state';
import { decodeDatabase, type Coordinate, type Tables } from '../search/pdb';
import { solve, type Algorithm, type Limits } from '../search/solver';
import { initializeReference, solveReference } from '../reference/two-phase';
import type { TraceEvent } from '../search/trace';
let tables: Tables | undefined;
async function loadTables(assetBase: string): Promise<Tables> {
  if (tables) return tables;
  const base = new URL('pdb/', assetBase).href;
  const manifestResponse = await fetch(`${base}manifest.json`);
  if (!manifestResponse.ok) throw new Error('Database manifest unavailable. Run npm run pdb:build.');
  const manifest = await manifestResponse.json();
  const loaded = await Promise.all((['co', 'eo', 'cp'] as Coordinate[]).map(async kind => {
    const response = await fetch(`${base}${kind}.bin`); if (!response.ok) throw new Error(`Missing ${kind} database.`);
    const buffer = await response.arrayBuffer();
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(x => x.toString(16).padStart(2, '0')).join('');
    if (digest !== manifest.tables[kind].sha256) throw new Error(`Database checksum mismatch: ${kind}.`);
    return decodeDatabase(kind, new Uint8Array(buffer));
  }));
  tables = { co: loaded[0], eo: loaded[1], cp: loaded[2] }; return tables;
}
self.onmessage = async (event: MessageEvent<{ requestId: string; state: SerializedCube; algorithm: Algorithm; limits: Limits; assetBase: string }>) => {
  const { requestId, state, algorithm, limits, assetBase } = event.data;
  try {
    const start = performance.now();
    self.postMessage({ type: 'initializing', requestId });
    if (algorithm === 'two-phase') initializeReference();
    else if (algorithm === 'ida-orientation' || algorithm === 'ida-combined') await loadTables(assetBase);
    const initializationMs = performance.now() - start;
    self.postMessage({ type: 'ready', requestId, initializationMs });
    const cube = deserialize(state);
    let pending: TraceEvent[] = [];
    const flushTrace = () => { if (pending.length) { self.postMessage({ type: 'trace', requestId, events: pending }); pending = []; } };
    const result = algorithm === 'two-phase' ? solveReference(cube) : solve(cube, algorithm, limits, tables,
      progress => { flushTrace(); self.postMessage({ type: 'progress', requestId, progress }); },
      event => { pending.push(event); if (pending.length >= 24) flushTrace(); });
    flushTrace();
    result.stats.initializationMs = initializationMs;
    self.postMessage({ type: 'result', requestId, result });
  } catch (e) { self.postMessage({ type: 'error', requestId, error: e instanceof Error ? e.message : String(e) }); }
};
