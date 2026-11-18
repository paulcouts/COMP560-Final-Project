import { beforeAll, describe, expect, it } from 'vitest';
import { apply, isSolved, key, move, solved, type CubeState } from '../src/cube/state';
import { buildTables, decodeDatabase, encodeDatabase, rank, SIZES, unrank, type Coordinate, type Tables } from '../src/search/pdb';
import { heuristic, solve, type CustomAlgorithm } from '../src/search/solver';
import { solveReference } from '../src/reference/two-phase';
let tables: Tables;
const variants: CustomAlgorithm[] = ['ida-zero', 'ida-simple', 'ida-orientation', 'ida-combined'];
beforeAll(() => { tables = buildTables(); }, 30_000);
describe('pattern databases', () => {
  it('exhaustively checks coordinate ranks, coverage, consistency, and binary encoding', () => {
    for (const kind of ['co','eo','cp'] as Coordinate[]) {
      const db = tables[kind];
      expect(decodeDatabase(kind, encodeDatabase(db))).toEqual(db);
      for (let i = 0; i < SIZES[kind]; i++) {
        if (rank(unrank(i, kind), kind) !== i) throw new Error(`Rank failure: ${kind}/${i}`);
        if (db.distances[i] === 255) throw new Error('Incomplete table');
        for (let m = 0; m < 18; m++) if (db.distances[i] > db.distances[db.transitions[i * 18 + m]] + 1) throw new Error('Inconsistent table');
      }
    }
  }, 30_000);
  it('coordinate transitions agree with full moves', () => {
    let s = solved();
    for (let i = 0; i < 150; i++) {
      s = move(s, i * 7 % 18);
      for (const kind of ['co','eo','cp'] as Coordinate[]) for (let m = 0; m < 18; m++) {
        expect(tables[kind].transitions[rank(s, kind) * 18 + m]).toBe(rank(move(s, m), kind));
      }
    }
  });
});
describe('search against exact breadth-first distances', () => {
  it('checks admissibility on every depth ≤3 state and optimal solutions on a systematic sample', () => {
    const queue: { state: CubeState; depth: number }[] = [{ state: solved(), depth: 0 }], seen = new Set([key(solved())]);
    for (let i = 0; i < queue.length; i++) {
      const { state, depth } = queue[i];
      for (const alg of variants) {
        if (heuristic(state, alg, tables) > depth) throw new Error(`Inadmissible ${alg}`);
        if (i < 25 || i % 97 === 0) {
          const result = solve(state, alg, { timeMs: 5000, nodeLimit: 1000000, maxDepth: 3 }, tables);
          expect(result.status).toBe('solved'); expect(result.moves?.length).toBe(depth); expect(isSolved(apply(state, result.moves!))).toBe(true);
        }
      }
      if (depth < 3) for (let m = 0; m < 18; m++) { const next = move(state, m), k = key(next); if (!seen.has(k)) { seen.add(k); queue.push({ state: next, depth: depth + 1 }); } }
    }
    expect(queue.length).toBe(3502);
  }, 30_000);
  it('returns honest resource limits and zero-move solutions', () => {
    const s = apply(solved(), 'R U F L');
    expect(solve(s, 'ida-zero', { timeMs: 5000, nodeLimit: 1, maxDepth: 20 }).status).toBe('node-limit');
    expect(solve(s, 'ida-zero', { timeMs: Number.MIN_VALUE, nodeLimit: 100, maxDepth: 20 }).status).toBe('timeout');
    expect(solve(s, 'ida-combined', { timeMs: 5000, nodeLimit: 1000, maxDepth: 0 }, tables).status).toBe('depth-limit');
    expect(solve(solved(), 'ida-zero').moves).toEqual([]);
  });
  it('independently verifies reference solutions on three deeper scrambles', () => {
    for (const seq of ['R U F2 L D B R2 U F D2 L B2', 'R2 U2 F2 D2 B2 L2', 'R U R\' U\' F B L D R F U2 B2']) {
      const s = apply(solved(), seq), r = solveReference(s); expect(r.verified).toBe(true); expect(r.optimality).toBe('not-proven'); expect(isSolved(apply(s, r.moves!))).toBe(true);
    }
  }, 60_000);
});
