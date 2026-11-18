# Five-minute presentation

Use [slides.pdf](slides.pdf) for projection, or open [slides.html](slides.html) locally and navigate with arrow/Page Up/Page Down keys. Six slides are designed for **five minutes total**, including the live demo. See [speaker-notes.md](speaker-notes.md) for timings and prompts.

Authors: Bryen Alvarez, Justin Owusu, Paul Couts, Mena Tobia. Choose one presenter and rehearse together. The presentation is due November 19, 2026.

[demo.webm](demo.webm) is an actual browser recording, without narration, covering scramble, solve, real search-tree replay, animated moves, verification, reverse stepping, and measured results. Keep it available as a backup during the live demo. Screenshots in [assets/](assets/) come from the same running application.

## Regenerate

Install dependencies and Chromium (`npm ci`, `npx playwright install chromium`). Start `npm run dev` in another terminal. From the repository root:

```sh
npm run demo:record
npm run slides:build
npm run slides:pdf
```

Slide statistics are read from the final measured summary; the capture needs the app running. The PDF export needs no server. Rehearse the recording and links on the presentation computer before class.
