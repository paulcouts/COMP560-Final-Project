import './style.css';
import './monochrome.css';
import { apply, clone, FACES, format, inverse, isSolved, move, parse, serialize, solved, toFacelets, validate, type CubeState } from './cube/state';
import { scramble } from './cube/random';
import { CubeView, renderNet } from './graphics/cube-view';
import { DEFAULT_LIMITS, LABELS, type Algorithm, type SolveResult } from './search/solver';
import { SearchTree } from './ui/search-tree';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header class="topbar"><a class="brand" href="#playground" aria-label="Pixel Cube Lab home">CUBE SOLVER</a><nav aria-label="Main navigation"><button class="nav active" data-tab="playground">Solver</button><button class="nav" data-tab="about">How it works</button></nav></header>
<main>
<section id="playground" class="page active">
  <div class="intro simple-intro"><div><h1>Rubik’s Cube Solver</h1><p class="intro-copy">Scramble the cube, run a search, and follow every solution move. IDA* uses lower bounds to prune branches; every returned solution is replayed and checked before it is shown.</p></div></div>
  <div class="lab-grid">
    <section class="cube-panel" aria-label="Cube playground"><div class="panel-top"><span><span class="small-square"></span> CUBE / 01</span><span id="cube-state-label" class="pill">SOLVED</span></div>
      <div id="cube-host"></div><div id="webgl-error" hidden>The 3D view is unavailable. The face net below still shows the full cube state.</div>
      <div class="view-tools"><span>↔ DRAG TO EXPLORE</span><button id="reset-view" title="Reset camera">↺ Reset view</button></div>
      <div class="manual"><span class="tiny-label">MAKE A MOVE</span><div class="face-buttons">${FACES.map(f => `<button data-face="${f}" title="Turn ${f} face">${f}</button>`).join('')}</div><select id="turn-type" aria-label="Turn direction"><option value="0">Clockwise ↻</option><option value="2">Inverse ↺</option><option value="1">Half turn · 180°</option></select></div>
      <details class="net-details"><summary>Inspect all six faces <span>+</span></summary><div class="net-wrap"><div id="face-net" class="face-net"></div><label class="label-toggle"><input id="sticker-labels" type="checkbox" checked> Face labels</label></div></details>
    </section>
    <aside class="control-panel"><div class="section-heading"><h2>Scramble</h2></div>
      <div class="input-pair"><label>Scramble length<input id="scramble-length" type="number" min="0" max="100" value="6"></label><label>Random seed<input id="scramble-seed" type="number" min="0" max="4294967295" value="560"></label></div>
      <div class="button-row"><button id="scramble" class="secondary">⌘ Generate scramble</button><button id="reset" class="icon-button" title="Reset to solved" aria-label="Reset to solved">↺</button></div>
      <label class="notation-label" for="notation">OR ENTER YOUR OWN MOVES</label><div class="notation-row"><input id="notation" spellcheck="false" placeholder="R U R' U'" aria-label="Scramble notation"><button id="apply-notation" title="Apply from solved" aria-label="Apply scramble from solved">↵</button></div><p class="hint">Applied from solved. Scramble length ≠ solution depth.</p>
      <div class="divider"></div><div class="section-heading"><h2>Solve</h2></div>
      <label>Search method<select id="algorithm">${Object.entries(LABELS).map(([k,v]) => `<option value="${k}" ${k === 'ida-combined' ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <p id="algorithm-description" class="method-description"></p><label class="budget-label">Search budget <span id="budget-value">10 seconds</span><input id="budget" type="range" min="1" max="30" value="10"></label>
      <div class="button-row"><button id="solve" class="primary">Solve the cube <span>→</span></button><button id="cancel" class="danger" hidden>Cancel</button></div>
      <p id="status" class="status" role="status" aria-live="polite">Ready when you are. Try a six-move scramble.</p><button id="try-reference" class="text-button" hidden>Try the two-phase reference →</button>
    </aside>
  </div>
  <section class="solution-panel" aria-label="Solution playback"><div class="solution-head"><div><h2>Solution moves</h2><p class="section-explanation">Watch each face turn, step backward, or click a move to replay up to it.</p></div><span id="solution-badge" class="pill">WAITING FOR A SOLUTION</span></div>
    <div id="solution-moves" class="solution-moves"><span class="empty-text">Your verified solution will appear here.</span></div>
    <div class="playback"><div class="playback-buttons"><button id="replay" aria-label="Return to solution start">↺</button><button id="previous" aria-label="Previous solution move">←</button><button id="play" aria-label="Play solution">▶ Play</button><button id="next" aria-label="Next solution move">→</button></div><span id="step-label">0 / 0 moves</span><label>Speed <select id="speed" aria-label="Playback speed"><option value="600">0.5×</option><option value="300" selected>1×</option><option value="150">2×</option></select></label></div>
    <p id="move-explanation" class="move-explanation" aria-live="polite">Solve a cube to inspect its move sequence.</p><div id="move-audit" class="move-audit"></div>
  </section>
  <section class="metrics" aria-label="Search metrics"><div><span>SEARCH TIME</span><strong id="metric-time">—</strong><small>excludes initialization & playback</small></div><div><span>NODES EXPANDED</span><strong id="metric-nodes">—</strong><small>work done by the search</small></div><div><span>SOLUTION LENGTH</span><strong id="metric-length">—</strong><small>half-turn metric · HTM</small></div><div><span>SEARCH THRESHOLD</span><strong id="metric-threshold">—</strong><small>current depth + lower bound</small></div></section>
  <section id="search-tree" class="search-tree" aria-label="Actual search tree"></section>
</section>
<section id="about" class="page"><div class="intro"><div><h1>How it works</h1></div></div><div class="notes-grid"><article><h2>IDA* search</h2><p>The solver explores possible face turns using a bound on depth + estimated remaining moves. It rejects branches above that bound and raises the bound when needed. The search tree shows actual expanded and pruned states.</p></article><article><h2>Pattern databases</h2><p>Lookup tables store exact distances for simplified cubes: corner orientation, edge orientation, and corner permutation. Their maximum is a lower bound for the full cube.</p><p>H0 uses no estimate. H1 counts incorrect cubies. H2 adds orientation tables. H3 adds corner permutation. All use the same moves and pruning.</p></article><article><h2>Verification and limits</h2><p>Each returned move is replayed on the submitted cube state before success is displayed. During playback, the move log checks valid piece orientations, permutation parity, and whether the cube is solved.</p><p>A twelve-turn scramble can have a shorter solution. Completed custom searches are optimal in HTM. The reference solver’s verified solutions are not guaranteed shortest. A timeout does not mean unsolvable.</p></article><article><h2>Controls</h2><p>Drag to inspect the cube. U, R, F, D, L, B turn faces; Shift reverses a turn. Clockwise is viewed directly from that face. The labeled net shows all six faces.</p><p><a href="https://github.com/ldez/cubejs" target="_blank" rel="noreferrer">cubejs · MIT ↗</a> · <a href="https://kociemba.org/math/imptwophase.htm" target="_blank" rel="noreferrer">Two-phase algorithm ↗</a></p></article></div></section>
</main><footer><span>Rubik’s Cube Solver</span></footer>`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let state = solved(), view: CubeView | undefined, busy = false, turning = false, playing = false;
let worker: Worker | undefined, requestId = '', watchdog: ReturnType<typeof setTimeout> | undefined;
let solution: number[] | null = null, snapshot = solved(), position = 0;
const tree = new SearchTree($('search-tree'));
const descriptions: Record<Algorithm,string> = {
  'ida-zero': 'Iterative deepening with no heuristic. A deliberately simple search baseline.',
  'ida-simple': 'A lower bound from incorrectly positioned or oriented cubies. No lookup tables.',
  'ida-orientation': 'Adds exact corner-twist and edge-flip distances to the simple bound.',
  'ida-combined': 'Combines orientation and corner-permutation databases. Optimal when completed.',
  'two-phase': 'Credited cubejs reference. Practical for deeper scrambles; not guaranteed shortest.'
};
try { view = new CubeView($('cube-host')); } catch { $('webgl-error').hidden = false; document.querySelector('details')!.open = true; }
function setStatus(text: string, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function update() {
  if (!turning) view?.setState(state); renderNet($('face-net'), state, $<HTMLInputElement>('sticker-labels').checked);
  $('cube-state-label').textContent = isSolved(state) ? 'SOLVED' : 'SCRAMBLED';
  document.querySelectorAll<HTMLButtonElement>('[data-face], #scramble, #reset, #apply-notation, #solve').forEach(b => b.disabled = busy || turning || playing);
  for (const id of ['algorithm','scramble-length','scramble-seed','turn-type','budget']) ($<HTMLInputElement>(id)).disabled = busy || turning || playing;
  $('cancel').hidden = !busy;
  $<HTMLButtonElement>('previous').disabled = !solution || position === 0 || turning || busy || playing;
  $<HTMLButtonElement>('next').disabled = !solution || position >= solution.length || turning || busy || playing;
  $<HTMLButtonElement>('replay').disabled = !solution || turning || busy;
  $<HTMLButtonElement>('play').disabled = !solution || solution.length === 0 || busy || (turning && !playing);
  $('play').textContent = playing ? 'Ⅱ Pause' : '▶ Play';
  $('step-label').textContent = `${position} / ${solution?.length ?? 0} moves`;
  $('solution-moves').innerHTML = solution === null ? '<span class="empty-text">Your verified solution will appear here.</span>' : solution.length === 0 ? '<span class="empty-text">Already solved. No moves needed.</span>' : solution.map((m,i) => `<button data-solution-step="${i+1}" class="move-chip ${i < position ? 'done' : ''} ${i === position ? 'current' : ''}" ${i === position ? 'aria-current="step"' : ''} ${turning || playing || busy ? 'disabled' : ''} title="Replay through move ${i+1}: ${format([m])}"><small>${i+1}</small>${format([m])}</button>`).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-solution-step]').forEach(b => b.onclick = async () => {
    const target = Number(b.dataset.solutionStep); if (busy || turning || playing || !solution) return;
    playing = true; update(); while (playing && position !== target) await step(position < target ? 1 : -1); playing = false; update();
  });
  updateMoveAudit();
}
function moveDescription(m: number) {
  const face = ['upper','right','front','lower','left','back'][Math.floor(m/3)];
  return `${format([m])}: turn the ${face} face ${m%3===1?'180°':m%3===2?'90° counterclockwise':'90° clockwise'}`;
}
function updateMoveAudit() {
  if (solution === null) { $('move-explanation').textContent = 'Solve a cube to inspect its move sequence.'; $('move-audit').innerHTML = ''; return; }
  $('move-explanation').textContent = position === solution.length ? `All ${solution.length} moves applied. ${isSolved(state) ? 'Verified: every cubie is in its solved position and orientation.' : 'Verification failed.'}` : `Next move ${position+1}/${solution.length} — ${moveDescription(solution[position])}.`;
  let s = clone(snapshot);
  const rows = [`<tr><td>0</td><td>Submitted state</td><td>Valid</td><td>${isSolved(s)?'Solved':'Unsolved'}</td></tr>`];
  for(let i=0;i<position;i++) { s=move(s,solution[i]); validate(s); rows.push(`<tr><td>${i+1}</td><td>${format([solution[i]])}</td><td>Valid</td><td>${isSolved(s)?'Solved ✓':'Unsolved'}</td></tr>`); }
  const wasOpen = $('move-audit').querySelector('details')?.open;
  $('move-audit').innerHTML = `<details ${wasOpen?'open':''}><summary>Move-by-move verification log · ${position} completed</summary><table><thead><tr><th>Step</th><th>Move</th><th>Cube invariants</th><th>Goal test</th></tr></thead><tbody>${rows.join('')}</tbody></table><p class="hint">Each row is replayed from the submitted snapshot. The current view ${toFacelets(s)===toFacelets(state)?'matches':'does not match'} that replay.</p></details>`;
}
function clearSolution() {
  playing = false; solution = null; position = 0; tree.reset(); $('solution-badge').textContent = 'WAITING FOR A SOLUTION'; $('try-reference').hidden = true;
  for (const id of ['metric-time','metric-nodes','metric-length','metric-threshold']) $(id).textContent = '—';
}
function setCube(next: CubeState, message: string) { clearSolution(); state = next; setStatus(message); update(); }
async function animate(m: number) {
  const before = clone(state), after = move(state, m); turning = true; update();
  await view?.turn(m, before, after, Number($<HTMLSelectElement>('speed').value));
  state = after; turning = false;
}
async function manual(m: number) { if (busy || turning || playing) return; clearSolution(); await animate(m); setStatus('Your move. Ready to search from this state.'); update(); }
document.querySelectorAll<HTMLButtonElement>('[data-face]').forEach(b => b.onclick = () => void manual(FACES.indexOf(b.dataset.face as typeof FACES[number]) * 3 + Number($<HTMLSelectElement>('turn-type').value)));
document.addEventListener('keydown', e => {
  if ((e.target as HTMLElement).matches('input,select,textarea,button') || e.ctrlKey || e.metaKey || e.altKey || !$('playground').classList.contains('active')) return;
  const index = FACES.indexOf(e.key.toUpperCase() as typeof FACES[number]); if (index >= 0) { e.preventDefault(); void manual(index * 3 + (e.shiftKey ? 2 : 0)); }
});
$('scramble').onclick = () => {
  try {
    const seed = Number($<HTMLInputElement>('scramble-seed').value), length = Number($<HTMLInputElement>('scramble-length').value);
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) throw new Error('Seed must be an integer from 0 to 4294967295.');
    const moves = scramble(length, seed); $<HTMLInputElement>('notation').value = format(moves);
    setCube(apply(solved(), moves), `Seed ${seed} · ${length} scramble turns. Ready to search.`);
  } catch (e) { setStatus((e as Error).message, true); }
};
$('reset').onclick = () => { $<HTMLInputElement>('notation').value = ''; setCube(solved(), 'Back to solved. A fresh start.'); };
$('apply-notation').onclick = () => { try { const moves = parse($<HTMLInputElement>('notation').value); setCube(apply(solved(), moves), `Applied ${moves.length} turns from solved.`); } catch (e) { setStatus((e as Error).message, true); } };
$('notation').onkeydown = e => { if (e.key === 'Enter' && !busy && !turning && !playing) $('apply-notation').click(); };
$('algorithm').onchange = () => { $('algorithm-description').textContent = descriptions[$<HTMLSelectElement>('algorithm').value as Algorithm]; };
$('algorithm').dispatchEvent(new Event('change'));
$('budget').oninput = () => { $('budget-value').textContent = `${$<HTMLInputElement>('budget').value} seconds`; };
$('reset-view').onclick = () => view?.resetView();
$('sticker-labels').onchange = () => renderNet($('face-net'), state, $<HTMLInputElement>('sticker-labels').checked);
function stopSearch(message: string) {
  clearTimeout(watchdog); worker?.terminate(); worker = undefined; requestId = ''; busy = false; tree.finish(); setStatus(message); update();
}
function acceptResult(result: SolveResult, start: CubeState) {
  clearTimeout(watchdog); busy = false; tree.finish();
  $('metric-time').textContent = `${result.stats.searchMs < 10 ? result.stats.searchMs.toFixed(2) : result.stats.searchMs.toFixed(0)} ms`;
  $('metric-nodes').textContent = result.stats.expanded === null ? 'N/A' : result.stats.expanded.toLocaleString();
  $('metric-threshold').textContent = result.stats.lastThreshold?.toString() ?? 'N/A';
  if (result.status === 'solved') {
    if (!result.moves || !isSolved(apply(start, result.moves))) { setStatus('Verification failed. This solution will not be played.', true); update(); return; }
    snapshot = clone(start); solution = result.moves; position = 0;
    $('metric-length').textContent = `${solution.length} moves`;
    $('solution-badge').textContent = result.optimality === 'proven' ? 'VERIFIED · SHORTEST HTM' : 'VERIFIED · REFERENCE';
    setStatus(`Verified ${solution.length}-move solution. Initialization: ${Math.round(result.stats.initializationMs)} ms. Press Play.`);
  } else {
    const reason = result.status === 'node-limit' ? 'node budget' : result.status === 'depth-limit' ? 'depth limit' : 'time budget';
    setStatus(`No solution found within the ${reason}. Try a shorter scramble or the reference solver.`);
    $('try-reference').hidden = false;
  }
  update();
}
$('solve').onclick = () => {
  if (busy || turning || playing) return;
  clearSolution(); busy = true; const start = clone(state), algorithm = $<HTMLSelectElement>('algorithm').value as Algorithm;
  tree.reset(algorithm === 'two-phase');
  requestId = crypto.randomUUID(); const id = requestId, limits = { ...DEFAULT_LIMITS, timeMs: Number($<HTMLInputElement>('budget').value) * 1000 };
  setStatus('Preparing the solver…'); update();
  worker ??= new Worker(new URL('./workers/solve.worker.ts', import.meta.url), { type: 'module' });
  watchdog = setTimeout(() => stopSearch('Initialization timed out. Please try again.'), 60_000);
  worker.onmessage = ({ data }) => {
    if (data.requestId !== requestId || id !== requestId) return;
    if (data.type === 'ready') {
      clearTimeout(watchdog); setStatus('Searching from the current cube state…');
      watchdog = setTimeout(() => { stopSearch('No solution found within the time budget. Try the reference solver.'); $('try-reference').hidden = false; }, limits.timeMs + 200);
    } else if (data.type === 'trace') { tree.append(data.events);
    } else if (data.type === 'progress') {
      $('metric-nodes').textContent = data.progress.expanded.toLocaleString(); $('metric-threshold').textContent = String(data.progress.threshold);
      $('metric-time').textContent = `${Math.round(data.progress.elapsedMs)} ms`;
    } else if (data.type === 'result') { requestId = ''; acceptResult(data.result, start); }
    else if (data.type === 'error') stopSearch(`Solver error: ${data.error}`);
  };
  worker.onerror = e => { stopSearch(`Worker error: ${e.message}`); };
  worker.postMessage({ requestId, state: serialize(start), algorithm, limits, assetBase: new URL(import.meta.env.BASE_URL, document.baseURI).href });
};
$('cancel').onclick = () => stopSearch('Search cancelled. The cube is unchanged.');
$('try-reference').onclick = () => { $<HTMLSelectElement>('algorithm').value = 'two-phase'; $('algorithm').dispatchEvent(new Event('change')); $('solve').click(); };
async function step(direction: number) {
  if (!solution || turning || busy || (direction > 0 && position >= solution.length) || (direction < 0 && position <= 0)) return;
  const m = direction > 0 ? solution[position] : inverse(solution[position-1]); await animate(m); position += direction; update();
}
$('next').onclick = () => void step(1); $('previous').onclick = () => void step(-1);
$('replay').onclick = () => { if (turning || busy || !solution) return; playing = false; state = clone(snapshot); position = 0; update(); };
$('play').onclick = async () => {
  if (playing) { playing = false; update(); return; }
  if (!solution || turning || busy) return;
  if (position === solution.length) { state = clone(snapshot); position = 0; }
  playing = true; update();
  while (playing && solution && position < solution.length) await step(1);
  playing = false; update();
};
document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => b.onclick = () => {
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === b.dataset.tab));
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach(n => n.classList.toggle('active', n === b));
  location.hash = b.dataset.tab!;
});
if (location.hash) document.querySelector<HTMLButtonElement>(`[data-tab="${['playground','about'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'playground'}"]`)?.click();
update();
