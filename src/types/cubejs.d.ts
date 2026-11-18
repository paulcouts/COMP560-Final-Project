declare module 'cubejs' {
  export default class Cube {
    constructor(state?: unknown);
    static fromString(facelets: string): Cube;
    static initSolver(): void;
    move(moves: string): Cube;
    asString(): string;
    isSolved(): boolean;
    solve(maxDepth?: number): string;
    toJSON(): { cp: number[]; co: number[]; ep: number[]; eo: number[] };
  }
}
