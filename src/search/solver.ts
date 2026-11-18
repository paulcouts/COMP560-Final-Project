import { apply, clone, isSolved, moveInto, solved, validate, type CubeState } from '../cube/state';
import { rank, type Tables } from './pdb';
import { TRACE_LIMIT, type TraceEvent } from './trace';
export type CustomAlgorithm = 'ida-zero' | 'ida-simple' | 'ida-orientation' | 'ida-combined';
export type Algorithm = CustomAlgorithm | 'two-phase';
export const LABELS: Record<Algorithm, string> = { 'ida-zero': 'H0 · Uninformed', 'ida-simple': 'H1 · Misplaced cubies', 'ida-orientation': 'H2 · Orientation PDBs', 'ida-combined': 'H3 · Combined PDBs', 'two-phase': 'Two-phase · Reference' };
export interface Limits { timeMs: number; nodeLimit: number; maxDepth: number }
export interface Progress { expanded: number; generated: number; threshold: number; elapsedMs: number }
export interface SolveResult {
  status: 'solved' | 'timeout' | 'node-limit' | 'depth-limit' | 'error';
  moves: number[] | null; verified: boolean;
  optimality: 'proven' | 'not-proven' | 'not-applicable';
  stats: { initializationMs: number; searchMs: number; expanded: number | null; generated: number | null; iterations: number | null; lastThreshold: number | null };
  error?: string;
}
export const DEFAULT_LIMITS: Limits = { timeMs: 10_000, nodeLimit: 2_000_000, maxDepth: 20 };
export function simpleHeuristic(s: CubeState): number {
  let c = 0, e = 0;
  for (let i = 0; i < 8; i++) if (s.cp[i] !== i || s.co[i]) c++;
  for (let i = 0; i < 12; i++) if (s.ep[i] !== i || s.eo[i]) e++;
  return Math.max(Math.ceil(c / 4), Math.ceil(e / 4));
}
export function heuristic(s: CubeState, algorithm: CustomAlgorithm, tables?: Tables): number {
  if (algorithm === 'ida-zero') return 0;
  let h = simpleHeuristic(s);
  if (algorithm === 'ida-simple') return h;
  if (!tables) throw new Error('Pattern databases required.');
  h = Math.max(h, tables.co.distances[rank(s, 'co')], tables.eo.distances[rank(s, 'eo')]);
  return algorithm === 'ida-combined' ? Math.max(h, tables.cp.distances[rank(s, 'cp')]) : h;
}
export function solve(start: CubeState, algorithm: CustomAlgorithm, limits: Limits = DEFAULT_LIMITS, tables?: Tables, onProgress?: (p: Progress) => void, onTrace?: (event: TraceEvent) => void): SolveResult {
  validate(start);
  if (!(limits.timeMs > 0) || !Number.isSafeInteger(limits.nodeLimit) || limits.nodeLimit < 1 || !Number.isInteger(limits.maxDepth) || limits.maxDepth < 0 || limits.maxDepth > 30) throw new Error('Invalid search limits.');
  const begun = performance.now(), stack = Array.from({ length: limits.maxDepth + 1 }, () => solved()); stack[0] = clone(start);
  let expanded = 0, generated = 0, iterations = 0, threshold = heuristic(start, algorithm, tables);
  let stop: SolveResult['status'] | undefined, answer: number[] | null = null, lastProgress = begun;
  const path: number[] = []; let traceId = 0;
  function dfs(depth: number, previousFace: number, parentId: number | null, viaMove: number | null): number {
    const s = stack[depth];
    if ((generated & 1023) === 0) {
      const now = performance.now();
      if (now - begun >= limits.timeMs) { stop = 'timeout'; return Infinity; }
      if (now - lastProgress >= 100) { lastProgress = now; onProgress?.({ expanded, generated, threshold, elapsedMs: now - begun }); }
    }
    const h = heuristic(s, algorithm, tables), f = depth + h;
    const id = onTrace ? traceId++ : -1;
    const emit = (action: TraceEvent['action']) => {
      if (onTrace && id < TRACE_LIMIT) onTrace({ id, parentId, move: viaMove, depth, h, f, threshold, action });
    };
    if (f > threshold) { emit('pruned'); return f; }
    if (isSolved(s)) {
      if (performance.now() - begun >= limits.timeMs) { stop = 'timeout'; return Infinity; }
      emit('goal'); answer = path.slice(); return -1;
    }
    if (depth === limits.maxDepth) { emit('limit'); return Infinity; }
    if (expanded >= limits.nodeLimit) { emit('limit'); stop = 'node-limit'; return Infinity; }
    emit('expanded');
    expanded++; let minimum = Infinity;
    for (let m = 0; m < 18; m++) {
      const face = Math.floor(m / 3);
      if (face === previousFace) continue;
      generated++; moveInto(s, m, stack[depth + 1]); path.push(m);
      const next = dfs(depth + 1, face, id, m); path.pop();
      if (next === -1 || stop) return next;
      minimum = Math.min(minimum, next);
    }
    return minimum;
  }
  while (threshold <= limits.maxDepth && !stop) {
    iterations++;
    const next = dfs(0, -1, null, null);
    if (answer !== null) break;
    if (!Number.isFinite(next)) break;
    threshold = next;
  }
  const verified = answer !== null && isSolved(apply(start, answer));
  return { status: verified ? 'solved' : stop ?? 'depth-limit', moves: verified ? answer : null, verified,
    optimality: verified ? 'proven' : 'not-applicable',
    stats: { initializationMs: 0, searchMs: performance.now() - begun, expanded, generated, iterations, lastThreshold: threshold } };
}
