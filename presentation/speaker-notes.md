# Five-minute speaker notes

One presenter. These time boxes sum to exactly five minutes; rehearse aloud and shorten wording as needed. The demo recording is a backup, not an extra segment. Numbers on slide 4 are generated from the current measured summary; use those displayed values.

## 1 — Question (0:00–0:35)

“We built Pixel Cube Lab to investigate a classical AI question: how much can a better heuristic save an optimal search? Rubik's Cube gives us a visible state space, a precise goal test, and several useful abstractions. Our contribution is a tested cube engine, one IDA* solver with four levels of heuristic knowledge, and a controlled experiment. This interface lets us watch both the solution and the decisions behind the search.”

Introduce the four team members from the slide. State that the implementation targets understandable, budgeted search.

## 2 — State and comparison (0:35–1:15)

“The state tracks eight corners and twelve edges, including their positions and orientations. We allow eighteen face turns. Every turn costs one, including a half turn; this is the half-turn metric. Our question is how stronger lower bounds affect search effort and solve rate under identical limits. We compare the same search algorithm, move ordering, and pruning rule. Scramble length is a way to generate inputs, not a known optimal distance: moves can cancel or commute.”

Point to the common-budget question. Avoid implying that a twelve-turn scramble requires twelve solution moves.

## 3 — Algorithm (1:15–2:05)

“IDA* does depth-first search inside a threshold on depth plus estimated remaining cost. When the search cannot finish within that threshold, it raises the bound to the smallest value it exceeded. H0 uses zero, giving uninformed iterative deepening. H1 counts incorrect pieces; a turn can affect at most four corners and four edges. H2 adds exact distances in simplified orientation spaces. H3 adds corner permutation. We take the maximum of these bounds because adding overlapping estimates could overestimate. There are only 44,555 distance entries. A completed custom search is shortest in this metric; a budget failure makes no such claim.”

## 4 — Evidence (2:05–3:05)

“We generated 120 unique states, twenty at each of six scramble lengths, and ran three repetitions of all five methods. Custom runs get one second and 100,000 expansions. We require all repetitions to succeed before counting an instance as solved. The plot shows stronger bounds extending coverage. Read the H0, H1, and H3 counts shown here. On states shared by H1 and H3, read the paired expansion and runtime ratios. The key result is that fewer expanded nodes do not produce proportional speedups: computing coordinate ranks and reading the tables also costs time. Timing comparisons use common solved instances where possible, and failures stay in the coverage denominator.”

Do not compare conditional medians as if every method solved the same states. The reference's node counts are unavailable.

## 5 — Live demo (3:05–4:20)

Have the local app loaded at default settings before the talk. Use seed **560**, length **6**, H3. If the app fails, play [demo.webm](demo.webm) within this same time slot.

- **0–10 s:** Generate the scramble. “The solver receives only this state; it does not reverse the scramble history.”
- **10–20 s:** Solve. Point to the verified shortest-HTM badge and metrics.
- **20–40 s:** Scroll to Search tree. Restart and step a few visits. Explain `g`, `h`, threshold, and one pruned branch. “This is a recording of actual decisions, capped at the first 240 visits. The recording may omit the eventual solution branch.”
- **40–65 s:** Scroll back to the cube and solution controls. Play the moves, then step backward and forward once. Open the verification log. “Every move changes the cube, and the final state passes the goal test. Our headless test also checks all transitions in an independent cube engine.”
- **65–75 s:** Open Results and point to coverage. Transition directly to the last slide.

Do not wait on a deep custom search during this five-minute talk. The reference is available if asked during questions.

## 6 — Limitations and conclusion (4:20–5:00)

“Compact pattern databases improved coverage, while evaluation overhead limited easy-state speedups. Our evidence comes from short random walks on one machine; it does not establish performance on uniformly random cubes. The credited reference solves every test state, but does not guarantee shortest solutions. We verify its moves as well. The next experiment would maintain coordinates incrementally, then repeat the frozen corpus before broadening the inputs. The repository includes code, raw measurements, the paper, and reproduction commands.”

Finish by 5:00. Questions follow only if the instructor allows them.

## Questions everyone should be ready for

- Why is H1 admissible? A turn can repair at most four incorrect corners and four incorrect edges.
- Why maximum rather than sum? The same move can improve several abstractions, so their costs overlap.
- Why is a successful custom solve optimal? Admissible bounds and complete IDA* threshold iterations, with only same-face pruning that cannot remove a shortest sequence.
- Why can a longer scramble be easier? Scramble steps are not optimal depth; commuting and cancellations matter.
- Does an animation prove correctness? It is a demonstration; state replay, physical invariants, exact goal tests, and independent-engine regression provide stronger checks.
- Is the shown tree complete? No: it is the first 240 actual visits, with explicit labels and separate full-search totals.
- Why is two-phase longer on easy states? This library configuration trades shortest-path guarantees for practical reach; its behavior does not characterize every two-phase implementation.
- What is original? The project implementation, tests, UI, and empirical study; IDA*, pattern databases, cube conventions, and the credited reference are existing work.
