import Cube from 'cubejs';
import { apply, isSolved, parse, toFacelets, validate, type CubeState } from '../cube/state';
import type { SolveResult } from '../search/solver';
let ready = false;
export function initializeReference(): number {
  if (ready) return 0;
  const start = performance.now(); Cube.initSolver(); ready = true; return performance.now() - start;
}
/** Run in a disposable worker: the library's synchronous search has no cancellation API. */
export function solveReference(state: CubeState): SolveResult {
  validate(state);
  const initializationMs = initializeReference(), start = performance.now();
  const moves = isSolved(state) ? [] : parse(Cube.fromString(toFacelets(state)).solve(22));
  const verified = isSolved(apply(state, moves));
  if (!verified) throw new Error('Reference solver returned an invalid solution.');
  return { status: 'solved', moves, verified, optimality: 'not-proven',
    stats: { initializationMs, searchMs: performance.now() - start, expanded: null, generated: null, iterations: null, lastThreshold: null } };
}
