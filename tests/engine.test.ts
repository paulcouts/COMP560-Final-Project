import { describe, it, expect } from 'vitest';
import Cube from 'cubejs';
import { apply, clone, deserialize, format, fromFacelets, inverse, isSolved, key, move, parse, serialize, solved, toFacelets, validate } from '../src/cube/state';
import { scramble } from '../src/cube/random';
describe('cube algebra and independent model', () => {
  it('all move inverses, fourth powers, and independent facelet fixtures agree', () => {
    for (let m = 0; m < 18; m++) {
      expect(isSolved(apply(solved(), [m, inverse(m)]))).toBe(true);
      expect(isSolved(apply(solved(), [m,m,m,m]))).toBe(true);
      expect(toFacelets(move(solved(), m))).toBe(new Cube().move(format([m])).asString());
    }
  });
  it('matches the independent engine for 200 seeded sequences and round-trips', () => {
    for (let seed = 0; seed < 200; seed++) {
      const moves = scramble(30, seed), s = apply(solved(), moves);
      expect(() => validate(s)).not.toThrow();
      expect(toFacelets(s)).toBe(new Cube().move(format(moves)).asString());
      expect(key(fromFacelets(toFacelets(s)))).toBe(key(s));
      expect(key(deserialize(serialize(s)))).toBe(key(s));
      expect(isSolved(apply(s, [...moves].reverse().map(inverse)))).toBe(true);
    }
  });
  it('rejects impossible cubies, malformed serialization, and notation atomically', () => {
    const s = solved(); s.co[0] = 1; expect(() => validate(s)).toThrow();
    const flip = solved(); flip.eo[0] = 1; expect(() => validate(flip)).toThrow();
    const p = solved(); [p.ep[0],p.ep[1]] = [p.ep[1],p.ep[0]]; expect(() => validate(p)).toThrow();
    const bad = serialize(solved()); bad.co[0] = 256; expect(() => deserialize(bad)).toThrow();
    expect(() => parse('R U X')).toThrow(); expect(parse('')).toEqual([]);
    const original = solved(); expect(() => apply(original, 'R invalid')).toThrow(); expect(isSolved(original)).toBe(true);
    expect(key(clone(original))).toBe(key(original));
    expect(() => fromFacelets('U'.repeat(54))).toThrow();
  });
});
