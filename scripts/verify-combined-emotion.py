# File attribution
# created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
"""Check combined-v2 winners, missingness and font coverage. Run with fontTools installed."""
import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
no_anger = '--no-anger' in sys.argv
dataset = 'combined-v2-no-anger' if no_anger else 'combined-v2'
data = json.loads((root / f'public/emo/{dataset}/emo-data.json').read_text())
rows = list(csv.DictReader((root / 'data-src/country-emotion-combined-v2.csv').open()))
lexicon = {row['iso3']: row for row in csv.DictReader(
    (root / 'data-src/lexicon-by-country.tsv').open(), delimiter='\t')}
keys = {category['catKey']: category['key'] for category in data['categories']}
all_keys = [key for key in rows[0] if key not in {'iso3', 'country', 'no_pain', 'out_of_scope'}]
assert len(all_keys) == 14, all_keys
assert set(keys) == set(all_keys) - ({'anger_moral_injury'} if no_anger else set())
assert data['meta']['categoryCount'] == len(keys) == (13 if no_anger else 14)
assert len(rows) == len({row['iso3'] for row in rows}) == 195
missing = {row['iso3'] for row in rows if all(row[key] == '' for key in keys)}
assert missing == set(data['missingCountries']) == {'COM', 'FSM', 'GNB'}
assert len(data['countries']) == 192
counts = Counter()
for row in rows:
    if row['iso3'] in missing:
        continue
    winner = min(keys, key=lambda key: (-float(row[key]), keys[key]))
    country = data['countries'][row['iso3']]
    assert country['cat'] == keys[winner]
    assert country['score'] == float(row[winner])
    native = lexicon[row['iso3']][keys[winner] + '_term'].strip()
    assert country['term'] == (native if native != 'NO TERM FOUND' else '')
    if not country['term']:
        assert country['script'] == 'Latn'
    assert country['scores'] == {key: float(row[key]) for key in [*all_keys, 'no_pain', 'out_of_scope']}
    assert len(country['terms']) == 14
    counts[keys[winner]] += 1
assert counts == Counter(country['cat'] for country in data['countries'].values())
if no_anger:
    assert counts['06_anger'] == 0
    assert 'anger_moral_injury' in data['meta']['rule']
else:
    assert counts['06_anger'] == 152

needed = defaultdict(set)
for country in data['countries'].values():
    needed[country['script']].update(map(ord, country['term']))
    needed['Latn'].update(map(ord, country['name'] + country['en']))
for category in data['categories']:
    needed['Latn'].update(map(ord, category['label']))
for country in data['missingCountries'].values():
    needed['Latn'].update(map(ord, country['name']))
brand = TTFont(root / 'public/fonts/Apercu Pro Regular.otf').getBestCmap()
for script, points in needed.items():
    points = {point for point in points if not chr(point).isspace() and point not in brand}
    if points:
        font = TTFont(root / f'public/emo/{dataset}/fonts/{script}.woff2')
        assert points <= font.getBestCmap().keys(), (script, points - font.getBestCmap().keys())
        assert 'GSUB' in font, script
assert not data['meta']['source']['percentagesAreDummy']
print('192 independent winners, 3 explicit missing countries, all subset codepoints and GSUB: PASS')
print(f'{dataset} winner counts: {dict(sorted(counts.items()))}')
