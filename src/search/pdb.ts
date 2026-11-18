import { MOVES, solved, type CubeState } from '../cube/state';
export type Coordinate = 'co' | 'eo' | 'cp';
export const SIZES = { co: 2187, eo: 2048, cp: 40320 };
export interface Database { kind: Coordinate; distances: Uint8Array; transitions: Uint16Array }
export interface Tables { co: Database; eo: Database; cp: Database }
const factorial = [1,1,2,6,24,120,720,5040,40320];
export function rank(s: CubeState, kind: Coordinate): number {
  let result = 0;
  if (kind === 'cp') {
    for (let i = 0; i < 7; i++) {
      let smaller = 0; for (let j = i + 1; j < 8; j++) if (s.cp[j] < s.cp[i]) smaller++;
      result += smaller * factorial[7 - i];
    }
  } else {
    const base = kind === 'co' ? 3 : 2;
    for (let i = 0; i < s[kind].length - 1; i++) result = result * base + s[kind][i];
  }
  return result;
}
export function unrank(index: number, kind: Coordinate): CubeState {
  if (!Number.isInteger(index) || index < 0 || index >= SIZES[kind]) throw new Error('Coordinate out of range.');
  const s = solved();
  if (kind === 'cp') {
    const available = [0,1,2,3,4,5,6,7];
    for (let i = 0; i < 8; i++) { const d = Math.floor(index / factorial[7 - i]); index %= factorial[7 - i]; s.cp[i] = available.splice(d, 1)[0]; }
  } else {
    const base = kind === 'co' ? 3 : 2; let sum = 0;
    for (let i = s[kind].length - 2; i >= 0; i--) { s[kind][i] = index % base; sum += s[kind][i]; index = Math.floor(index / base); }
    s[kind][s[kind].length - 1] = (base - sum % base) % base;
  }
  // Abstract states need not have matching full-cube parity.
  return s;
}
export function buildDatabase(kind: Coordinate): Database {
  const size = SIZES[kind], transitions = new Uint16Array(size * 18), out = solved();
  for (let n = 0; n < size; n++) {
    const s = unrank(n, kind);
    for (let m = 0; m < 18; m++) {
      const t = MOVES[m];
      if (kind === 'cp') for (let i = 0; i < 8; i++) out.cp[i] = s.cp[t.cp[i]];
      if (kind === 'co') for (let i = 0; i < 8; i++) out.co[i] = (s.co[t.cp[i]] + t.co[i]) % 3;
      if (kind === 'eo') for (let i = 0; i < 12; i++) out.eo[i] = s.eo[t.ep[i]] ^ t.eo[i];
      transitions[n * 18 + m] = rank(out, kind);
    }
  }
  const distances = new Uint8Array(size).fill(255), queue = new Uint16Array(size);
  distances[0] = 0; let read = 0, write = 1;
  while (read < write) {
    const n = queue[read++];
    for (let m = 0; m < 18; m++) {
      const next = transitions[n * 18 + m];
      if (distances[next] === 255) { distances[next] = distances[n] + 1; queue[write++] = next; }
    }
  }
  if (write !== size) throw new Error(`Incomplete ${kind} database: ${write}/${size}.`);
  return { kind, distances, transitions };
}
export function buildTables(): Tables { return { co: buildDatabase('co'), eo: buildDatabase('eo'), cp: buildDatabase('cp') }; }
// Explicit little-endian encoding, portable across machines.
export function encodeDatabase(db: Database): Uint8Array {
  const bytes = new Uint8Array(db.distances.length + db.transitions.length * 2); bytes.set(db.distances);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < db.transitions.length; i++) view.setUint16(db.distances.length + i * 2, db.transitions[i], true);
  return bytes;
}
export function decodeDatabase(kind: Coordinate, bytes: Uint8Array): Database {
  const size = SIZES[kind]; if (bytes.length !== size * 37) throw new Error(`Invalid ${kind} database size.`);
  const transitions = new Uint16Array(size * 18), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < transitions.length; i++) transitions[i] = view.getUint16(size + i * 2, true);
  return { kind, distances: bytes.slice(0, size), transitions };
}
