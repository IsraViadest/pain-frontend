"""Check all selectable glyphs and source scores; --browser also tests the live filter in Vite."""
import csv
import json
import subprocess
import sys
from collections import defaultdict
from pathlib import Path
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
lexicon = {row['iso3']: row for row in csv.DictReader(
    (root / 'data-src/lexicon-by-country.tsv').open(), delimiter='\t')}
scripts = json.loads((root / 'public/emo/filter-scripts.json').read_text())
assert scripts == {iso: row['script'] for iso, row in lexicon.items()}
control = json.loads((root / 'public/emo/emo-data.json').read_text())
categories = control['categories']
assert len(categories) == 14
needed = defaultdict(set)
for iso, row in lexicon.items():
    needed['Latn'].update(map(ord, row['country']))
    for category in categories:
        for suffix, script in [('_term', row['script']), ('_english', 'Latn')]:
            text = row[category['key'] + suffix].strip()
            if text != 'NO TERM FOUND':
                needed[script].update(map(ord, text))
for category in categories:
    needed['Latn'].update(map(ord, category['label']))
brand = TTFont(root / 'public/fonts/Apercu Pro Regular.otf').getBestCmap()
for script, points in needed.items():
    points = {point for point in points if not chr(point).isspace() and point not in brand}
    if points:
        font = TTFont(root / f'public/emo/filter-fonts/{script}.woff2')
        assert points <= font.getBestCmap().keys(), (script, points - font.getBestCmap().keys())
        assert 'GSUB' in font, script

cases = []
for dataset in ['', 'combined-v2/']:
    data = json.loads((root / f'public/emo/{dataset}emo-data.json').read_text())
    rows = {row['iso3']: row for row in csv.DictReader(
        (root / data['meta']['source']['percentages']).open())}
    for iso, country in data['countries'].items():
        assert country['scores'] == {key: float(rows[iso][key]) for key in country['scores']}
    exclusions = [[category['key']] for category in categories]
    exclusions += [[category['key'] for category in categories[::2]],
                   [category['key'] for category in categories[1::2]]]
    for excluded in exclusions:
        allowed = [category for category in categories if category['key'] not in excluded]
        winners = {}
        for iso in data['countries']:
            winner = min(allowed, key=lambda category: (
                -float(rows[iso][category['catKey']]), category['key']))
            winners[iso] = [winner['key'], float(rows[iso][winner['catKey']])]
        cases.append({'dataset': dataset, 'excluded': excluded, 'winners': winners})
print('All 195 script identities, 195 x 14 native terms, GSUB, source scores: PASS')

if '--browser' in sys.argv:
    expression = r'''(async () => {
      const { filterEmotions } = await import('/src/emo/categoryFilter.ts');
      const check = (value, message) => { if (!value) throw new Error(message); };
      const bases = {};
      for (const dataset of ['', 'combined-v2/']) {
        bases[dataset] = await (await fetch(`/emo/${dataset}emo-data.json`)).json();
      }
      const before = JSON.stringify(bases);
      const mutable = new Set(['06_anger']);
      const pending = filterEmotions(bases['combined-v2/'], mutable);
      mutable.clear();
      const snapshotted = await pending;
      check(Object.values(snapshotted.countries).every(country => country.cat !== '06_anger'),
        'Exclusions are captured before font loading');
      let countryChecks = 0;
      for (const { dataset, excluded, winners } of CASES) {
        const base = bases[dataset];
        const data = await filterEmotions(base, new Set(excluded));
        check(data.categories === base.categories, 'All category buttons remain available');
        for (const [iso, [cat, score]] of Object.entries(winners)) {
          const country = data.countries[iso];
          check(country.cat === cat && country.score === score, `Source winner ${dataset}${iso}`);
          check(country.scores === base.countries[iso].scores, 'Scores remain unchanged');
          check(country.term === base.countries[iso].terms[cat], 'Winner native term');
          check(country.script === (country.term ? SCRIPTS[iso] : 'Latn'), 'Native script');
          const english = base.countries[iso].cat === cat ? base.countries[iso].en :
            base.categories.find(category => category.key === cat).label;
          check(country.en === english, 'English gloss or explicit category fallback');
          countryChecks++;
        }
      }
      for (const base of Object.values(bases)) {
        const keys = base.categories.map(category => category.key);
        for (const category of base.categories) {
          const data = await filterEmotions(base, new Set(keys.filter(key => key !== category.key)));
          check(Object.keys(data.countries).length === Object.keys(base.countries).length, 'Single-category coverage');
          check(Object.values(data.countries).every(country => country.cat === category.key &&
            country.score === country.scores[category.catKey]), 'Each of 14 categories selectable alone');
        }
        const allExcluded = await filterEmotions(base, new Set(keys));
        check(Object.keys(allExcluded.countries).length === 0, 'All excluded has no labels');
        check(Object.keys(allExcluded.missingCountries).length === 195, 'Country identity survives all excluded');
        for (const iso of Object.keys(base.countries)) {
          check(allExcluded.missingCountries[iso].filteredOut === true, 'Excluded is distinct from missing');
        }
        for (const iso of Object.keys(base.missingCountries ?? {})) {
          check(!allExcluded.missingCountries[iso].filteredOut, 'Original missing stays missing');
        }
        check(await filterEmotions(base, new Set()) === base, 'Clearing exclusions returns original identity');
        check(!document.documentElement.hasAttribute('data-emo-filter-fonts'), 'Default fonts restored');
        let rejected = false;
        try { await filterEmotions(base, new Set(['not-a-category'])); } catch { rejected = true; }
        check(rejected, 'Unknown exclusions rejected');
      }
      const synthetic = structuredClone(bases['']);
      const origin = synthetic.countries.IND;
      synthetic.countries = { IND: origin };
      for (const category of synthetic.categories) origin.scores[category.catKey] = 0.5;
      synthetic.categories.reverse();
      origin.script = 'Latn';
      origin.cat = '14_shame';
      const tied = await filterEmotions(synthetic, new Set(['06_anger']));
      check(tied.countries.IND.cat === '01_pain', 'Ties use category key, not array order');
      check(tied.countries.IND.script === 'Deva', 'Fallback script repaired when native term returns');
      origin.terms['01_pain'] = '';
      const fallback = await filterEmotions(synthetic, new Set(['06_anger']));
      check(fallback.countries.IND.script === 'Latn' && fallback.countries.IND.en === 'Pain', 'Native gap uses English');
      check(JSON.stringify(bases) === before, 'Neither base dataset mutated');
      await filterEmotions(bases[''], new Set());
      return { passed: true, sourceWinnerCases: CASES.length, countryChecks,
        singleCategoryCases: 28, allExcludedCases: 2, syntheticCases: 2 };
    })()'''
    expression = expression.replace('CASES', json.dumps(cases), 1)
    expression = expression.replace('SCRIPTS', json.dumps(scripts), 1)
    expression = expression.replace('CASES.length', str(len(cases)))
    url = next((arg[6:] for arg in sys.argv if arg.startswith('--url=')), 'http://127.0.0.1:5173/')
    helper = root.parents[1] / 'artifacts/emo-views/eval.mjs'
    result = subprocess.run(['node', str(helper), url, '2000', '800', '600'],
                            input=expression, text=True, capture_output=True, check=True)
    output = json.loads(result.stdout)
    assert isinstance(output, dict) and output.get('passed'), output
    print(json.dumps(output))
