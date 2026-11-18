/** Cubie convention: Kociemba URFDLB. See THIRD_PARTY.md. */
export interface CubeState { cp: Uint8Array; co: Uint8Array; ep: Uint8Array; eo: Uint8Array }
export interface SerializedCube { cp: number[]; co: number[]; ep: number[]; eo: number[] }
export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export const MOVE_NAMES = FACES.flatMap(f => [f, `${f}2`, `${f}'`]);
export function solved(): CubeState {
  return { cp: Uint8Array.from({ length: 8 }, (_, i) => i), co: new Uint8Array(8),
    ep: Uint8Array.from({ length: 12 }, (_, i) => i), eo: new Uint8Array(12) };
}
export function clone(s: CubeState): CubeState {
  return { cp: s.cp.slice(), co: s.co.slice(), ep: s.ep.slice(), eo: s.eo.slice() };
}
export function serialize(s: CubeState): SerializedCube {
  return { cp: [...s.cp], co: [...s.co], ep: [...s.ep], eo: [...s.eo] };
}
export function deserialize(s: SerializedCube): CubeState {
  if (!s || !['cp', 'co', 'ep', 'eo'].every(k => Array.isArray(s[k as keyof SerializedCube]) &&
      s[k as keyof SerializedCube].every(n => Number.isInteger(n) && n >= 0 && n <= 255))) {
    throw new Error('Invalid cube serialization.');
  }
  const state = { cp: Uint8Array.from(s.cp), co: Uint8Array.from(s.co), ep: Uint8Array.from(s.ep), eo: Uint8Array.from(s.eo) };
  validate(state); return state;
}
export function isSolved(s: CubeState): boolean {
  for (let i = 0; i < 8; i++) if (s.cp[i] !== i || s.co[i]) return false;
  for (let i = 0; i < 12; i++) if (s.ep[i] !== i || s.eo[i]) return false;
  return true;
}
function parity(p: Uint8Array): number {
  let n = 0; for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) n ^= Number(p[i] > p[j]);
  return n;
}
export function validate(s: CubeState): void {
  for (const [p, size] of [[s.cp, 8], [s.ep, 12]] as const) {
    if (p.length !== size || new Set(p).size !== size || p.some(v => v >= size)) throw new Error('Invalid cubie permutation.');
  }
  if (s.co.length !== 8 || s.co.some(x => x > 2) || s.co.reduce((a, b) => a + b, 0) % 3) throw new Error('Invalid corner twist.');
  if (s.eo.length !== 12 || s.eo.some(x => x > 1) || s.eo.reduce((a, b) => a + b, 0) % 2) throw new Error('Invalid edge flip.');
  if (parity(s.cp) !== parity(s.ep)) throw new Error('Corner and edge parity disagree.');
}
export function key(s: CubeState): string { return [...s.cp, ...s.co, ...s.ep, ...s.eo].join(','); }

// Destination-indexed permutations: entry i identifies the source for location i.
const CP = [[3,0,1,2,4,5,6,7],[4,1,2,0,7,5,6,3],[1,5,2,3,0,4,6,7],
  [0,1,2,3,5,6,7,4],[0,2,6,3,4,1,5,7],[0,1,3,7,4,5,2,6]];
const CO = [[0,0,0,0,0,0,0,0],[2,0,0,1,1,0,0,2],[1,2,0,0,2,1,0,0],
  [0,0,0,0,0,0,0,0],[0,1,2,0,0,2,1,0],[0,0,1,2,0,0,2,1]];
const EP = [[3,0,1,2,4,5,6,7,8,9,10,11],[8,1,2,3,11,5,6,7,4,9,10,0],
  [0,9,2,3,4,8,6,7,1,5,10,11],[0,1,2,3,5,6,7,4,8,9,10,11],
  [0,1,10,3,4,5,9,7,8,2,6,11],[0,1,2,11,4,5,6,10,8,9,3,7]];
const EO = [[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,0,0,0,1,0,0,1,1,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,1,0,0,0,1,0,0,1,1]];
function quarter(s: CubeState, f: number): CubeState {
  return { cp: Uint8Array.from(CP[f], i => s.cp[i]),
    co: Uint8Array.from(CP[f], (i, j) => (s.co[i] + CO[f][j]) % 3),
    ep: Uint8Array.from(EP[f], i => s.ep[i]),
    eo: Uint8Array.from(EP[f], (i, j) => s.eo[i] ^ EO[f][j]) };
}
export const MOVES: CubeState[] = FACES.flatMap((_, f) => {
  const a = quarter(solved(), f), b = quarter(a, f), c = quarter(b, f); return [a, b, c];
});
/** out must be a different object/buffer from s. */
export function moveInto(s: CubeState, m: number, out: CubeState): CubeState {
  const t = MOVES[m];
  for (let i = 0; i < 8; i++) { out.cp[i] = s.cp[t.cp[i]]; out.co[i] = (s.co[t.cp[i]] + t.co[i]) % 3; }
  for (let i = 0; i < 12; i++) { out.ep[i] = s.ep[t.ep[i]]; out.eo[i] = s.eo[t.ep[i]] ^ t.eo[i]; }
  return out;
}
export function move(s: CubeState, m: number): CubeState {
  if (!Number.isInteger(m) || m < 0 || m >= 18) throw new Error('Invalid move.');
  return moveInto(s, m, solved());
}
export function parse(text: string): number[] {
  if (!text.trim()) return [];
  return text.trim().split(/\s+/).map(t => {
    const index = MOVE_NAMES.indexOf(t.replace('’', "'"));
    if (index < 0) throw new Error(`Unknown move “${t}”. Use U R F D L B with an optional 2 or prime.`);
    return index;
  });
}
export function format(moves: number[]): string { return moves.map(m => MOVE_NAMES[m]).join(' '); }
export function inverse(m: number): number { return Math.floor(m / 3) * 3 + 2 - m % 3; }
export function apply(s: CubeState, moves: number[] | string): CubeState {
  return (typeof moves === 'string' ? parse(moves) : moves).reduce(move, clone(s));
}
// Facelet numbering: URFDLB, each viewed from outside, row-major.
const CORNER_FACELETS = [[8,9,20],[6,18,38],[0,36,47],[2,45,11],[29,26,15],[27,44,24],[33,53,42],[35,17,51]];
const EDGE_FACELETS = [[5,10],[7,19],[3,37],[1,46],[32,16],[28,25],[30,43],[34,52],[23,12],[21,41],[50,39],[48,14]];
const CORNER_COLORS = ['URF','UFL','ULB','UBR','DFR','DLF','DBL','DRB'];
const EDGE_COLORS = ['UR','UF','UL','UB','DR','DF','DL','DB','FR','FL','BL','BR'];
export function toFacelets(s: CubeState): string {
  const out = FACES.flatMap(f => Array<string>(9).fill(f));
  for (let p = 0; p < 8; p++) for (let n = 0; n < 3; n++) out[CORNER_FACELETS[p][(n + s.co[p]) % 3]] = CORNER_COLORS[s.cp[p]][n];
  for (let p = 0; p < 12; p++) for (let n = 0; n < 2; n++) out[EDGE_FACELETS[p][(n + s.eo[p]) % 2]] = EDGE_COLORS[s.ep[p]][n];
  return out.join('');
}
export function fromFacelets(text: string): CubeState {
  if (text.length !== 54 || FACES.some((f, i) => [...text].filter(x => x === f).length !== 9 || text[i * 9 + 4] !== f)) throw new Error('Expected 54 URFDLB facelets with fixed centers and nine of each color.');
  const s = solved();
  for (let p = 0; p < 8; p++) {
    const stickers = CORNER_FACELETS[p].map(i => text[i]);
    const o = stickers.findIndex(x => x === 'U' || x === 'D');
    const c = CORNER_COLORS.findIndex(colors => [...colors].every((x, n) => x === stickers[(n + o) % 3]));
    if (o < 0 || c < 0) throw new Error('Unrecognized corner.'); s.cp[p] = c; s.co[p] = o;
  }
  for (let p = 0; p < 12; p++) {
    const stickers = EDGE_FACELETS[p].map(i => text[i]).join('');
    let e = EDGE_COLORS.indexOf(stickers), o = 0;
    if (e < 0) { e = EDGE_COLORS.indexOf([...stickers].reverse().join('')); o = 1; }
    if (e < 0) throw new Error('Unrecognized edge.'); s.ep[p] = e; s.eo[p] = o;
  }
  validate(s); return s;
}
