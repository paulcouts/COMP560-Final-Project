"""Generate browser SVG charts from measured, instance-aggregated outputs."""
import json, pathlib, sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'results/main')
data = json.loads((folder / 'summary.json').read_text())
colors = ['#777777', '#555555', '#333333', '#111111', '#999999']
markers = ['o', 's', '^', 'D', 'x']
styles = ['-', '--', '-.', ':', '-']
labels = ['H0: Uninformed', 'H1: Cubie count', 'H2: Orientation', 'H3: Combined', 'Two-phase reference']
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 9, 'axes.spines.top': False,
                     'axes.spines.right': False, 'svg.fonttype': 'none'})

def coverage(ax):
    for m, c, label, marker, style in zip(data['methods'], colors, labels, markers, styles):
        ax.plot([r['length'] for r in m['byLength']], [r['fraction'] for r in m['byLength']],
                marker=marker, linestyle=style, ms=4, lw=1.7, color=c, label=label)
    ax.set(xlabel='Scramble length (HTM; not optimal depth)', ylabel='Fraction solved in every repetition', ylim=(-.04,1.07), xticks=data['lengths'])
    ax.grid(alpha=.15)

def nodes(ax):
    for m,c,label,marker,style in zip(data['methods'][:-1],colors,labels,markers,styles):
        points=[r for r in m['byLength'] if r['medianNodes'] is not None]
        ax.plot([r['length'] for r in points], [max(r['medianNodes'],1) for r in points], marker=marker,linestyle=style,ms=4,lw=1.7,color=c,label=label)
    ax.set(xlabel='Scramble length (HTM)',ylabel='Median expansions on solved instances',yscale='log',xticks=data['lengths'])
    ax.grid(alpha=.15)

for name, draw, title in [('coverage',coverage,'How far does each method get?'),('nodes',nodes,'Search work on completed solves')]:
    fig,ax=plt.subplots(figsize=(6.4,4.2));draw(ax);ax.set_title(title,loc='left',pad=17,fontweight='bold')
    ax.legend(fontsize=7,loc='best');fig.tight_layout()
    fig.savefig(f'public/results/{name}.svg',facecolor='white')
    plt.close(fig)

fig,ax=plt.subplots(figsize=(6.4,4.2))
values=[m['medianMs'] for m in data['paired']]
ax.bar(range(5),values,color=colors,width=.65)
ax.set_xticks(range(5),['H0','H1','H2','H3','Two-phase']);ax.set_yscale('log')
ax.set_ylabel('Median search time (ms; log scale)')
ax.set_title(f"Paired comparison: {data['commonSolvedCount']} common solved states",loc='left',pad=17,fontweight='bold')
ax.grid(axis='y',alpha=.15)
for i,v in enumerate(values):
    if v is not None: ax.text(i,v*1.13,f'{v:.3f}',ha='center',fontsize=8)
ax.margins(y=.22);fig.tight_layout();fig.savefig('public/results/paired.svg',facecolor='white');plt.close(fig)
print('Generated browser SVGs from actual measurements.')
