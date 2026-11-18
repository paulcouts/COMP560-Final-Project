"""Compile the official-style paper with an installed Tectonic or latexmk."""
import pathlib, shutil, subprocess, sys
root = pathlib.Path(__file__).resolve().parent.parent
local = root / '.tools' / ('tectonic.exe' if sys.platform == 'win32' else 'tectonic')
tectonic = shutil.which('tectonic') or (str(local) if local.exists() else None)
if tectonic:
    subprocess.run([tectonic, '--keep-logs', 'paper.tex'], cwd=root/'paper', check=True)
elif shutil.which('latexmk'):
    subprocess.run(['latexmk','-pdf','-interaction=nonstopmode','-halt-on-error','paper.tex'], cwd=root/'paper', check=True)
else:
    raise SystemExit('Install Tectonic or a TeX distribution with latexmk, then rerun. See paper/README.md.')
from pypdf import PdfReader
pages = PdfReader(root/'paper'/'paper.pdf').pages
reference_start = next((i+1 for i,p in enumerate(pages) if (p.extract_text() or '').lstrip().startswith('References')), None)
if reference_start is None:
    raise SystemExit('Could not identify the references-only page; inspect PDF pagination.')
content_pages = reference_start - 1
print(f'Compiled {content_pages} content pages + {len(pages)-content_pages} reference page(s).')
if content_pages > 4:
    raise SystemExit('Paper exceeds the four-page content limit. Edit prose; do not alter conference styling.')
(root/'public'/'paper').mkdir(parents=True, exist_ok=True)
shutil.copyfile(root/'paper'/'paper.pdf', root/'public'/'paper'/'paper.pdf')
print('Copied the compiled paper to the app download link.')
