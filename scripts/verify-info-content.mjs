/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
// Run: node --import tsx scripts/verify-info-content.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// Upstream layer title images are local and lazy, with the source paragraphs preserved.
for (const name of ['emo', 'env', 'phys', 'socioeco']) {
  assert(INFO_MODAL_DATA_SOURCES.body.includes(`/headers/${name}_header.png`));
  assert(readFileSync(new URL(`../public/headers/${name}_header.png`, import.meta.url)).length > 0);
}
assert.match(INFO_MODAL_ABOUT.body, /flex-wrap: nowrap/);
console.log('Source links, credits and local title images PASS');
