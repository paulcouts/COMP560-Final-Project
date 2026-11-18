# Third-party credits

## Runtime code

- **cubejs 1.3.2**, Petri Lehtinen, Ludovic Fernandez, and contributors: [source](https://github.com/ldez/cubejs), MIT [license](licenses/cubejs-MIT.txt). Used as the explicitly labeled two-phase reference solver and independent engine in correctness tests. The IDA* implementation and its four heuristic variants are project code; they do not call the reference as a hidden fallback.
- **Three.js 0.180.0**, Three.js authors: [source](https://github.com/mrdoob/three.js), MIT [license](licenses/three-MIT.txt). Used for rendering and its OrbitControls. Cube geometry, pixel styling, state-to-sticker mapping, and the application interface are project code.

## Methods

- Richard E. Korf, *Finding Optimal Solutions to Rubik's Cube Using Pattern Databases*, AAAI 1997, pp. 700–705: source of the IDA*/pattern-database approach. [AAAI paper](https://cdn.aaai.org/AAAI/1997/AAAI97-109.pdf).
- Herbert Kociemba: [coordinate representation](https://kociemba.org/math/coordlevel.htm), [two-phase method](https://kociemba.org/math/imptwophase.htm). The cubie order, facelet mapping, and destination-indexed face-turn conventions follow this standard representation; their agreement with cubejs is tested. We do not claim invention of these algorithms or conventions.

## Data, assets, and tooling

The cube corpus is generated locally by deterministic seeded random walks. No external dataset, pretrained weights, remote inference service, downloaded fonts, or third-party artwork is used. Plots are generated from recorded measurements with Matplotlib. The pixel cube is rendered geometry, not a borrowed sprite.

Vite, TypeScript, tsx, Vitest, Playwright, npm dependencies, and Matplotlib are development/build tools. Exact JavaScript dependencies are pinned in [package-lock.json](package-lock.json); Python dependencies are in [requirements.txt](requirements.txt). Their distributions retain their own licenses.
