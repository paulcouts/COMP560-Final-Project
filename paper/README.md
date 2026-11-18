# Project paper

[paper.pdf](paper.pdf) is the compiled report. [paper.tex](paper.tex) is its source; [authors.tex](authors.tex) contains the team-supplied author block. **The assignment also requires PIDs; these have not yet been supplied.**

## Template

The supplied `tex one.txt` is the official NeurIPS 2023 style, and `tex 2.txt` is its example manuscript. The supplied `COMP560 tex.pdf` is a compiled example of those formatting instructions. This project uses that same style in `preprint` mode so the authors appear. The vendored [neurips_2023.sty](neurips_2023.sty) is unchanged; no margins, font sizes, or line spacing are overridden.

Official sources: [NeurIPS 2023 style instructions](https://neurips.cc/Conferences/2023/PaperInformation/StyleFiles), [style file](https://media.neurips.cc/Conferences/NeurIPS2023/Styles/neurips_2023.sty). Style SHA-256: `eb93f61e73bcf40b1d355da8c464951b513e8f531026f162ac80d51fce921abd`.

The course's **four content pages, references excluded** overrides the generic conference page limit in the example. References begin on a separate page to make the limit easy to check.

## Build from the repository root

Install [Tectonic](https://tectonic-typesetting.github.io/) or a TeX distribution containing `latexmk`, then:

```sh
python -m pip install -r requirements.txt
npm run paper:build
```

The script checks pagination and copies the PDF to the application's paper link. Tectonic may download TeX packages on its first run. A private local `.tools/tectonic.exe` is also supported, but is not required or included in the repository.

The table, numerical macros, and vector figures are generated from measured data by `npm run figures`. Do not hand-edit generated results. To update the study, follow the reproduction sequence in the [top-level README](../README.md), then rebuild this paper. Check the surrounding prose whenever measurements change.
