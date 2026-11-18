# Pixel Cube Lab — COMP 560

A working 3×3 Rubik's Cube solver and reproducible study of admissible heuristics. The pixel cube supports animated solution moves, backward stepping, a verification log, and a replay of actual IDA* search decisions. The surrounding interface is black and white.

**Question:** How much do compact pattern databases reduce the effort needed to find shortest solutions under a fixed computational budget?

**Team:** Bryen Alvarez (`bryen@unc.edu`), Justin Owusu (`jow@unc.edu`), Paul Couts (`alexcout1@unc.edu`), Mena Tobia (`matobia@unc.edu`). PIDs still need to be added to the paper before submission.

## Deliverables

- [Paper PDF](paper/paper.pdf), [LaTeX source](paper/paper.tex), [template/build notes](paper/README.md): unchanged official NeurIPS 2023 preprint format; four content pages plus references.
- [Presentation PDF](presentation/slides.pdf), [HTML slides](presentation/slides.html), [five-minute speaker notes](presentation/speaker-notes.md), [recorded demo](presentation/demo.webm).
- [Measured results](results/main/summary.json), [raw runs](results/main/raw.jsonl), [environment and hashes](results/main/manifest.json), [input corpus](data/main.json).
- [Submission checklist](SUBMISSION_CHECKLIST.md), [contributions](CONTRIBUTIONS.md), [third-party credits](THIRD_PARTY.md).

## Run the application

Requires Node.js **22.12+** and npm; tested with Node 24.13.0. No API keys, GPU compute, account, Python, or application server are required to use the solver. WebGL renders the cube; the six-face net remains available if WebGL is unavailable.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. Checked-in pattern databases, results, and paper make regeneration optional. If the port is occupied, use the address printed by Vite. Modern browsers require HTTP(S) for module workers; do not open the application with `file://`.

For a production build:

```sh
npm run build
npm run preview
```

Preview defaults to http://127.0.0.1:4173/. The output is a static `dist/` directory, including the paper and results. Vite uses relative asset paths for hosting beneath a repository path. No deployment has been performed.

### Demo controls

1. Generate the default six-turn scramble with seed 560, or enter notation such as `R U R' U'`. Notation is applied **from solved**, and invalid input leaves the current state untouched.
2. Select H3 and solve. A successful custom search displays **VERIFIED · SHORTEST HTM**. Search operates on the cube state, never by reversing stored scramble history.
3. Play, pause, step backward/forward, or click a numbered move. The explanation names the face and direction. Open the verification log to see each intermediate state pass cube invariants and the final goal test.
4. In **Search tree**, restart, step, play, or scrub through actual solver visits. Nodes show `g + h`, the threshold, and the decision to expand or prune. Only the first 240 visits are recorded; later solution branches can be outside this partial recording. Trace playback speed is independent of search time.
5. Drag the cube to rotate the camera. Keys `U R F D L B` turn faces, and Shift reverses a turn. Clockwise is viewed directly at that face. Camera rotation does not change the cube state.

The UI custom budget is 1–30 seconds, at most 2,000,000 expansions and depth 20. On a difficult state, an honest budget failure is expected. Select the separately labeled **two-phase reference** for practical deeper solving. Its solutions are verified but not guaranteed shortest; the library does not expose a search tree or node counts. Cancellation terminates the worker, and stale results cannot overwrite a later request.

## Algorithms and course connection

All 18 outer-face turns cost one move in the half-turn metric (HTM), including 180° turns. The same IDA* implementation, move order, and consecutive-same-face pruning are used for every custom variant.

| Method | Admissible lower bound |
| --- | --- |
| H0 | Zero: uninformed iterative deepening baseline |
| H1 | Maximum of `ceil(incorrect corners / 4)` and `ceil(incorrect edges / 4)` |
| H2 | Maximum of H1, corner-orientation distance, and edge-orientation distance |
| H3 | Maximum of H2 and corner-permutation distance |
| Reference | Credited `cubejs` two-phase solver, without an optimality claim |

Breadth-first preprocessing generates 2,187 corner-orientation, 2,048 edge-orientation, and 40,320 corner-permutation distances. Distance arrays occupy 44,555 bytes; with coordinate transition arrays the shipped binary tables total 1,648,535 bytes. SHA-256 checks protect loading. We use **max**, not a sum of overlapping distances, to preserve admissibility.

The project connects to state-space representation, uninformed/informed search, iterative deepening, admissible heuristics, and time/memory tradeoffs. The main empirical comparison isolates heuristic strength within our solver. The reference comparison also changes algorithm and implementation, so it does not isolate heuristic quality.

## Reproduce the paper's results

The checked-in study uses 120 unique seeded random-walk states: twenty each at scramble lengths 2, 4, 6, 8, 10, 12. It evaluates five methods with three repetitions (1,800 runs), sequentially with shuffled job orders, warm tables, a 100,000-expansion cap and a one-second custom search cap. These are experiment budgets, deliberately smaller than the interactive defaults.

Python 3.11+ is needed for plots and PDF validation (tested with 3.14). From the repository root:

```sh
python -m pip install -r requirements.txt
npm ci
npm test
npm run results:verify
```

`results:verify` audits existing data without rerunning search: it checks code/dependency/corpus/table hashes, completeness and repetition identities, then replays every saved solution in both cube engines. It intentionally fails after a solver change until new measurements are generated. This guards against a paper reporting results from different code.

To regenerate the study and all figures:

```sh
npm run pdb:build
npm run corpus:generate -- --config experiments/main.json
npm run benchmark -- --config experiments/main.json
npm run results:verify
npm run figures -- --input results/main
npm run paper:build
npm run slides:build
npm run slides:pdf
npm run build
```

Install Tectonic or `latexmk` for the paper, and run `npx playwright install chromium` for slide PDF export. The main benchmark takes several minutes on the development machine. These commands **replace the output named by the configuration**. To preserve an earlier run, copy the JSON configuration and change its `output` before benchmarking. A smaller [pilot configuration](experiments/pilot.json) is available; its historical results predate the final trace instrumentation and are not used in the paper's final table.

Random seeds reproduce states and job order, not exact wall-clock times. Timings vary by hardware and background load. An instance counts as solved only when **all repetitions** succeed. Runtime summaries first take each instance's median, then aggregate across instances. Coverage includes failures; conditional runtime comparisons involve different solved subsets. The paired plot and ratios use common solved states. Scramble length is not optimal depth, and short random walks are not uniform samples from the cube state space.

The manifest records environment, initialization costs, dependency lock hash, corpus hash, table hashes, and solver source hash. Trace recording is disabled for benchmarks. The browser Results view, paper table/macros, and plots are generated from the same saved measurements. After new measurements, review the paper prose and presentation notes as well as regenerating assets.

## Tests

```sh
npm run check
npx playwright install chromium
npm run test:browser
```

The ten headless tests cover all face moves, 200 longer seeded sequences against `cubejs`, physical invariants, parser atomicity, exhaustive coordinate rank/unrank and abstract distance consistency, admissibility on all 3,502 states through depth three, sampled exact optimality checks, resource limits, and reference verification. The requested [backend regression](tests/solver-correctness.test.ts) solves 36 unseen states from serialized input, validates every move against an independent engine, and checks the exact solved facelet string. It also reconstructs recorded tree events to verify real transitions and threshold decisions.

The four Chromium tests exercise the **production build**: worker/database loading, solved playback, reverse/replay, actual trace controls, paper PDF, invalid notation, cancellation, reference solving, keyboard input, all six faces, results, and mobile layout. Playwright starts a local preview server automatically. On Linux, `npx playwright install --with-deps chromium` installs browser system dependencies. GitHub Actions runs the same test/build/data audit/browser checks; remote CI has not been run yet.

## Presentation

The six-slide deck has a five-minute plan with a 75-second live demo. Use the PDF for reliable projection or the HTML with arrow/Page Up/Page Down navigation. Choose one presenter; every member should be ready to explain the heuristic and evaluation.

To refresh the recording and screenshots, start `npm run dev` in another terminal, then:

```sh
npm run demo:record
npm run slides:build
npm run slides:pdf
```

`DEMO_URL` can override the recording address. The WebM is an actual browser capture without narration, intended as a backup; add live narration using the speaker notes. Slide statistics come from the measured summary.

## Source map

- [src/cube/](src/cube/): cubie state, moves, validation, notation, facelet conversion, seeded scrambles.
- [src/search/](src/search/): coordinate tables, admissible heuristics, IDA*, bounded trace events.
- [src/reference/](src/reference/): credited two-phase adapter and verification.
- [src/workers/](src/workers/): browser worker, checked table loading, progress and cancellation protocol.
- [src/graphics/](src/graphics/): pixel-style Three.js cube and complete face net.
- [src/ui/](src/ui/): replayable actual search tree.
- [scripts/](scripts/): table/corpus generation, benchmarks, audits, figures, paper, slides, demo capture.
- [experiments/](experiments/), [data/](data/), [results/](results/): configurations, inputs, and measured outputs.

The [original design](PROJECT_DESIGN.md) records planning decisions; this README describes the implemented project. No external dataset or trained model is needed. See [THIRD_PARTY.md](THIRD_PARTY.md) for code and method attribution.
