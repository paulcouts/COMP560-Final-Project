/** Actual depth-first search events. IDs link to visited parents, not visual guesses. */
export interface TraceEvent {
  id: number;
  parentId: number | null;
  move: number | null;
  depth: number;
  h: number;
  f: number;
  threshold: number;
  action: 'expanded' | 'pruned' | 'goal' | 'limit';
}
export const TRACE_LIMIT = 240;
