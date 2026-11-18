/** Backend/headless regression: solve only serialized state, never use scramble history. */
import { beforeAll, describe, expect, it } from 'vitest';
import Cube from 'cubejs';
import { apply, deserialize, format, isSolved, move, serialize, solved, toFacelets, validate } from '../src/cube/state';
import { scramble } from '../src/cube/random';
import { buildTables, type Tables } from '../src/search/pdb';
import { heuristic, solve } from '../src/search/solver';
import { TRACE_LIMIT, type TraceEvent } from '../src/search/trace';
let tables: Tables;
beforeAll(() => { tables = buildTables(); });
describe('backend: returned moves really solve the submitted cube', () => {
  it('solves 36 unseen seeded states and verifies every transition with an independent engine', () => {
    for (let i=0; i<36; i++) {
      const input = deserialize(serialize(apply(solved(),scramble(2+i%6,9000+i))));
      const before = toFacelets(input);
      const result = solve(input,'ida-combined',{timeMs:5000,nodeLimit:2000000,maxDepth:10},tables);
      expect(result.status,`seed ${9000+i}`).toBe('solved'); expect(result.verified).toBe(true);
      expect(toFacelets(input)).toBe(before); // solver must not mutate its input
      let replay = deserialize(serialize(input)); const independent = Cube.fromString(before);
      for (const m of result.moves!) {
        replay = move(replay,m); independent.move(format([m])); validate(replay);
        expect(toFacelets(replay)).toBe(independent.asString());
      }
      expect(isSolved(replay)).toBe(true); expect(independent.isSolved()).toBe(true);
      expect(toFacelets(replay)).toBe('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
    }
  },30000);
  it('search-tree events represent actual moves and pruning decisions', () => {
    const start = apply(solved(),'R U F'), events: TraceEvent[]=[];
    const result=solve(start,'ida-combined',{timeMs:5000,nodeLimit:100000,maxDepth:10},tables,undefined,e=>events.push(e));
    expect(result.verified).toBe(true); expect(events.length).toBeGreaterThan(1); expect(events.length).toBeLessThanOrEqual(TRACE_LIMIT);
    const states = new Map<number,ReturnType<typeof solved>>();
    for (const e of events) {
      const s=e.parentId===null?start:move(states.get(e.parentId)!,e.move!); states.set(e.id,s);
      expect(e.h).toBe(heuristic(s,'ida-combined',tables)); expect(e.f).toBe(e.depth+e.h);
      if(e.action==='pruned') expect(e.f).toBeGreaterThan(e.threshold);
      if(e.action==='expanded') { expect(e.f).toBeLessThanOrEqual(e.threshold); expect(isSolved(s)).toBe(false); }
      if(e.action==='goal') expect(isSolved(s)).toBe(true);
    }
    expect(events.some(e=>e.action==='pruned')).toBe(true);
  });
});
