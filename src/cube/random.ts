/** Mulberry32: deterministic seeded PRNG, not a uniform cube-state sampler. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function scramble(length: number, seed: number): number[] {
  if (!Number.isInteger(length) || length < 0 || length > 100) throw new Error('Scramble length must be 0–100.');
  const random = rng(seed), result: number[] = [];
  while (result.length < length) {
    const m = Math.floor(random() * 18);
    if (result.length && Math.floor(result.at(-1)! / 3) === Math.floor(m / 3)) continue;
    result.push(m);
  }
  return result;
}
