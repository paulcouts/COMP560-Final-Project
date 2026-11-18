import { format } from '../cube/state';
import { TRACE_LIMIT, type TraceEvent } from '../search/trace';

/** Displays a bounded recording of the real traversal, including threshold-pruned nodes. */
export class SearchTree {
  private events: TraceEvent[] = [];
  private index = -1;
  private timer?: ReturnType<typeof setInterval>;
  private complete = false;
  constructor(private host: HTMLElement) {
    host.innerHTML = `<div class="tree-heading"><div><h2>Search tree</h2><p>Real IDA* visits. Each node is a cube state; each edge is a face turn.</p></div><span class="pill" id="trace-mode">NO SEARCH YET</span></div>
      <div class="tree-toolbar"><button id="trace-start" disabled aria-label="Restart search trace">↺ Restart</button><button id="trace-play" disabled aria-label="Play search trace">▶ Replay search</button><button id="trace-next" disabled aria-label="Next search event">Step →</button><label>Event <input type="range" id="trace-range" min="0" max="0" value="0" disabled></label><span id="trace-count">0 / 0</span></div>
      <p id="trace-detail" class="trace-detail" role="status">Run a custom solver to see the branches it explores and rejects.</p>
      <div class="tree-scroll" tabindex="0" aria-label="Recorded search tree; scroll horizontally to inspect branches"><svg id="tree-svg" role="img" aria-label="Search tree"></svg></div>
      <div class="tree-legend"><span>○ expanded</span><span>⊗ pruned: g + h exceeds bound</span><span>● goal</span><span>Dashed outline = next branch not yet visited</span></div>
      <p class="trace-note" id="trace-note">At most ${TRACE_LIMIT} actual visits are recorded. The full search totals remain above.</p>`;
    this.el<HTMLButtonElement>('trace-start').onclick = () => { this.pause(); this.index = 0; this.render(); };
    this.el<HTMLButtonElement>('trace-next').onclick = () => { this.pause(); this.index = Math.min(this.index + 1, this.events.length - 1); this.render(); };
    this.el<HTMLButtonElement>('trace-play').onclick = () => {
      if (this.timer) { this.pause(); this.render(); return; }
      if (this.index >= this.events.length - 1) this.index = -1;
      this.timer = setInterval(() => {
        this.index++; this.render();
        if (this.index >= this.events.length - 1) { this.pause(); this.render(); }
      }, 180);
      this.render();
    };
    this.el<HTMLInputElement>('trace-range').oninput = () => { this.pause(); this.index = Number(this.el<HTMLInputElement>('trace-range').value); this.render(); };
  }
  private el<T extends HTMLElement = HTMLElement>(id: string) { return this.host.querySelector<T>(`#${id}`)!; }
  private pause() { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
  reset(reference = false) {
    this.pause(); this.events = []; this.index = -1; this.complete = false; this.render();
    this.el('trace-mode').textContent = reference ? 'REFERENCE SOLVER' : 'WAITING';
    this.el('trace-detail').textContent = reference ? 'The reference library does not expose its decision tree. Select an IDA* method to inspect actual search events.' : 'Run a custom solver to see the branches it explores and rejects.';
  }
  append(events: TraceEvent[]) {
    this.events.push(...events); this.index = this.events.length - 1; this.render();
  }
  finish() { this.complete = true; this.render(); }
  private render() {
    const n = this.events.length, current = this.events[this.index];
    const slider = this.el<HTMLInputElement>('trace-range'); slider.disabled = !n; slider.max = String(Math.max(0,n-1)); slider.value = String(Math.max(this.index,0));
    this.el<HTMLButtonElement>('trace-start').disabled = !n;
    this.el<HTMLButtonElement>('trace-play').disabled = !n || !this.complete;
    this.el<HTMLButtonElement>('trace-next').disabled = !n || this.index >= n-1 || !this.complete;
    this.el('trace-play').textContent = this.timer ? 'Ⅱ Pause trace' : '▶ Replay search';
    this.el('trace-count').textContent = `${Math.max(0,this.index+1)} / ${n}`;
    this.el('trace-mode').textContent = n ? this.complete ? 'RECORDED ACTUAL SEARCH' : 'LIVE SEARCH' : 'NO SEARCH YET';
    this.el('trace-note').textContent = n >= TRACE_LIMIT ? `Recording capped at the first ${TRACE_LIMIT} visits; this is a partial tree, not the entire search. Later solution branches may be outside the recording.` : `${n} recorded visits. Replay shows what the solver actually did; playback speed is separate from search time.`;
    const svg = this.el<SVGElement & HTMLElement>('tree-svg');
    if (!current) { svg.innerHTML = ''; svg.setAttribute('height','90'); return; }
    const action = current.action === 'pruned' ? `PRUNE: ${current.f} > ${current.threshold}` : current.action === 'goal' ? 'GOAL: all cubies solved' : current.action === 'limit' ? 'RESOURCE LIMIT' : `EXPAND: ${current.f} ≤ ${current.threshold}`;
    this.el('trace-detail').textContent = `${current.move === null ? 'Start state' : 'Move ' + format([current.move])} · depth g=${current.depth} · lower bound h=${current.h} · f=${current.f} · threshold=${current.threshold} → ${action}`;
    // A threshold is a separate DFS tree. Future captured nodes are shown as dashed outlines.
    const root = [...this.events.slice(0,this.index+1)].reverse().find(e => e.parentId === null)!;
    const end = this.events.findIndex(e => e.id > root.id && e.parentId === null);
    const tree = this.events.filter(e => e.id >= root.id && (end < 0 || e.id < this.events[end].id));
    const children = new Map<number,TraceEvent[]>();
    for (const e of tree) if (e.parentId !== null) children.set(e.parentId, [...(children.get(e.parentId) ?? []),e]);
    const coords = new Map<number,{x:number;y:number}>(); let leaf = 0;
    const place = (e:TraceEvent): number => {
      const kids = children.get(e.id) ?? [];
      const xs = kids.map(place); const x = xs.length ? (xs[0] + xs[xs.length-1]) / 2 : 45 + leaf++ * 66;
      coords.set(e.id,{x,y:40+e.depth*85}); return x;
    }; place(root);
    const width = Math.max(500, leaf*66+30), height = Math.max(...tree.map(e=>e.depth))*85+95;
    svg.setAttribute('width',String(width)); svg.setAttribute('height',String(height)); svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    let paths = '', nodes = '';
    for (const e of tree) {
      const p = coords.get(e.id)!; const seen = e.id <= current.id;
      if (e.parentId !== null && coords.has(e.parentId)) { const parent=coords.get(e.parentId)!; paths += `<path d="M${parent.x},${parent.y+19} V${p.y-38} H${p.x} V${p.y-19}" class="tree-edge ${seen?'visited':''}"/>`; }
      nodes += `<g transform="translate(${p.x},${p.y})" class="tree-node ${seen?e.action:'future'} ${e.id===current.id?'active':''}"><title>${e.move===null?'Start':format([e.move])}: g=${e.depth}, h=${e.h}, f=${e.f}, ${e.action}</title><circle r="19"/><text text-anchor="middle" y="4">${e.move===null?'S':format([e.move])}</text>${seen?`<text class="node-score" text-anchor="middle" y="34">${e.action==='pruned'?'× ':''}f=${e.f}</text>`:''}</g>`;
    }
    svg.innerHTML = paths + nodes;
    const scroll = this.host.querySelector('.tree-scroll')!, p=coords.get(current.id);
    if (p) { if (p.x < scroll.scrollLeft+30 || p.x > scroll.scrollLeft+scroll.clientWidth-30) scroll.scrollLeft=Math.max(0,p.x-scroll.clientWidth/2); if (p.y < scroll.scrollTop+30 || p.y > scroll.scrollTop+scroll.clientHeight-45) scroll.scrollTop=Math.max(0,p.y-scroll.clientHeight/2); }
  }
}
