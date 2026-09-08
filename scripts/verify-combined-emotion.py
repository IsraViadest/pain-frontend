"""Check combined-v2 winners, missingness and font coverage. Run with fontTools installed."""
import csv
import json
from collections import defaultdict
from pathlib import Path
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
data = json.loads((root / 'public/emo/combined-v2/emo-data.json').read_text())
rows = list(csv.DictReader((root / 'data-src/country-emotion-combined-v2.csv').open()))
lexicon = {row['iso3']: row for row in csv.DictReader(
    (root / 'data-src/lexicon-by-country.tsv').open(), delimiter='\t')}
keys = {category['catKey']: category['key'] for category in data['categories']}
assert len(rows) == len({row['iso3'] for row in rows}) == 195
missing = {row['iso3'] for row in rows if all(row[key] == '' for key in keys)}
assert missing == set(data['missingCountries']) == {'COM', 'FSM', 'GNB'}
assert len(data['countries']) == 192
for row in rows:
    if row['iso3'] in missing:
        continue
    winner = min(keys, key=lambda key: (-float(row[key]), keys[key]))
    country = data['countries'][row['iso3']]
    assert country['cat'] == keys[winner]
    assert country['score'] == float(row[winner])
    assert country['term'] == lexicon[row['iso3']][keys[winner] + '_term']

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
        font = TTFont(root / f'public/emo/combined-v2/fonts/{script}.woff2')
        assert points <= font.getBestCmap().keys(), (script, points - font.getBestCmap().keys())
        assert 'GSUB' in font, script
assert not data['meta']['source']['percentagesAreDummy']
print('192 independent winners, 3 explicit missing countries, all subset codepoints and GSUB: PASS')
