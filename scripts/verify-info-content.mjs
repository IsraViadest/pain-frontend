// Run: node --import tsx scripts/verify-info-content.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { INFO_MODAL_ABOUT, INFO_MODAL_DATA_SOURCES } from '../src/ui/infoModal.ts';

const gdpData = JSON.parse(readFileSync(new URL('../public/emo/gdp-per-capita-2024.json', import.meta.url), 'utf8'));
const sourceUrls = [
  'https://huggingface.co/datasets/stanford-oval/ccnews',
  'https://www.consumerfinance.gov/data-research/consumer-complaints/',
  'https://www.cs.cmu.edu/~ark/GeoText/',
  'https://huggingface.co/datasets/yachay/text_coordinates_seasons',
  'https://www.kaggle.com/datasets/wjia26/twittersentimentbycountry',
  'https://zenodo.org/records/14804269',
  'https://huggingface.co/BAAI/bge-m3',
  'https://climatetrace.org/data',
  'https://berkeleyearth.org/data/',
  'https://www.healthdata.org/research-analysis/gbd',
  'https://data.worldpop.org/GIS/Population_Density/Global_2000_2020_1km_UNadj',
  gdpData.meta.source,
  'https://datacatalog.worldbank.org/search/dataset/0038130/gdp-ranking',
];
const links = [...INFO_MODAL_DATA_SOURCES.body.matchAll(/<a href="([^"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&'));
assert.deepEqual(links, sourceUrls, 'All upstream source and model credits must remain linked');
assert.match(INFO_MODAL_DATA_SOURCES.body, /GDP per capita for 2024/);
assert.match(INFO_MODAL_DATA_SOURCES.body, /inverted logarithmic scale gives lower GDP per person a brighter yellow signal/);
assert.match(INFO_MODAL_DATA_SOURCES.body, /artistic proxy for socioeconomic pain/);
for (const content of [INFO_MODAL_ABOUT, INFO_MODAL_DATA_SOURCES]) {
  for (const [anchor] of content.body.matchAll(/<a\s[^>]+>/g)) {
    assert.match(anchor, /target="_blank"/);
    assert.match(anchor, /rel="[^"]*\bnoopener\b/);
  }
  assert.doesNotMatch(content.body, /pain-(480|720|1080)|autoplay/);
}
const credits = 'The P.A.I.N. project is driven by artist Mary Maggic (Project Lead). The Technical Team consists of Michael Artner (Technical Lead and Back-End Developer), Isra Viadest (Front-End Developer) and Christian Stelmach (Lead on AI Model, Emotional Pain). The Art & Design Team consists of Dominika Kolenda (Data Research, P.A.I.N. Video, Workshop Design), Dora Siafla (Sound), and Hollis Hui (Renderings and Materials Research). From the Ludwig Boltzmann Institute, Open Innovation in Science Center, Mathieu Mahve-Beydokhti (OIS Expert) is appointed as the Lead Facilitator. From the Ludwig Boltzmann Institute for Network Medicine, the team includes Ines Gerard-Ursin (Lead on Data Harmonization, Physical Pain), Iker Núñez-Carpintero (Multiplex Systems Expert) and Norbert Unfug and Sebastian Pirch (Data Visualization).';
assert.ok(INFO_MODAL_ABOUT.body.replaceAll('&amp;', '&').includes(credits), 'Keep the approved credits paragraph exactly');

// Exercise the mounted banner and expiry without starting a browser or loading media.
const source = readFileSync(new URL('../src/ui/festival-media.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source.replace(/^import .*;$/gm, ''), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
function bannerAt(now) {
  const node = () => ({
    children: [],
    append(...children) { for (const child of children) { this.children.push(child); child.parent = this; } },
    addEventListener() {},
    remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); },
  });
  const timers = [];
  const scope = {
    exports: {}, URLSearchParams, location: { search: '' },
    Date: { now: () => now, parse: Date.parse },
    document: { createElement: node, getElementById: node },
    window: { setTimeout: (fn, delay) => timers.push({ fn, delay }) },
  };
  vm.runInNewContext(compiled, scope);
  const host = node();
  assert.equal(scope.exports.mountFestivalMedia(host), null, 'Separate video stays hidden');
  const row = host.children[0];
  for (const link of row.children) {
    assert.equal(link.target, '_blank');
    assert.match(link.rel, /\bnoopener\b/);
  }
  return { row, timers, setTime: value => { now = value; } };
}
const cutoff = Date.parse('2026-09-11T16:00:00+02:00');
const before = bannerAt(cutoff - 1);
assert.equal(before.row.children.length, 2);
assert.equal(before.row.children[0].children[1].textContent, 'visit us at the ars electronica festival ↗');
assert.equal(before.row.children[1].textContent, 'join our workshop · friday, 11 september ↗');
assert.match(before.row.children[1].href, /pain-interconnected-with-nature-3a738ddb450c81698729c804e3fc5c05/);
assert.equal(before.timers[0].delay, 1);
before.setTime(cutoff);
before.timers[0].fn();
assert.equal(before.row.children.length, 1, 'An already-open banner must expire');
for (const at of [cutoff, cutoff + 1]) {
  const expired = bannerAt(at);
  assert.equal(expired.row.children.length, 1);
  assert.equal(expired.timers.length, 0);
}
const early = bannerAt(cutoff - 45 * 24 * 60 * 60 * 1000);
assert.equal(early.timers[0].delay, 2_147_483_647, 'Long delays must not overflow setTimeout');
early.timers[0].fn();
assert.equal(early.row.children.length, 2);
assert.equal(early.timers.length, 2);
console.log('Source attribution, approved credits, new-tab links and workshop expiry: PASS');
