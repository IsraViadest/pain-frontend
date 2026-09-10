/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/** Run: node --import tsx scripts/verify-country-coverage.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCountryGeometries, findCountryInGeometries } from "../src/globe/countryGeometry";
import { buildCountryPainProfiles, emotionalSignal } from "../src/countryProfile/data";
import { CountrySelectionController } from "../src/countryProfile/selection";
import type { EmoData } from "../src/emo/emoData";
import type { PainPoint } from "../src/types/api";

const read = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const emotions: EmoData = read("public/emo/combined-v2/emo-data.json");
const geography = buildCountryGeometries(read("public/borders/ne_110m_admin_0_countries.geojson"));
const gdp = read("public/emo/gdp-per-capita-2024.json");
assert.equal(gdp.meta.year, 2024);
assert.equal(Object.keys(gdp.countries).length, 206);
assert.equal(gdp.countries.GRL, null, "Do not substitute Greenland's 2023 value into 2024");
assert.equal(gdp.countries.PRI, 39353.2242360643);
assert.equal(gdp.countries.NCL, 29213.1923192946);
assert.equal(gdp.countries.KOS, 7026.6988128325);
assert.equal(gdp.countries.SOL, null, "Somaliland is not another country's source alias");
assert.equal(gdp.countries.CYN, null);
const socioeconomic: PainPoint[] = Object.entries(gdp.countries).flatMap(([country, raw], id) => {
  if (raw === null) return [];
  const value = Number(raw);
  return [{ id, country, lat: null, lng: null, category: "GDP", uiLayer: "socioecopain",
    createdAt: gdp.meta.updated,
    intensity: 1 - (Math.log(value) - Math.log(gdp.meta.minimum)) /
      (Math.log(gdp.meta.maximum) - Math.log(gdp.meta.minimum)) }];
});
const profiles = buildCountryPainProfiles(emotions, {
  environmental: [{ id: 1, lat: 72, lng: -40, intensity: 0.6, category: "Temperature",
    uiLayer: "envpain", createdAt: "2024-01-01" }],
  physical: [{ id: 2, lat: 72, lng: -40, intensity: 0.8, category: "Physical",
    uiLayer: "physpain", createdAt: "2024-01-01" }], socioeconomic,
}, geography);
assert.equal(profiles.size, 206);
assert.equal(geography.length, 177);
for (const country of geography) assert.ok(profiles.has(country.key), country.key);
for (const iso3 of Object.keys(emotions.countries)) assert.ok(profiles.has(iso3), iso3);
assert.equal(profiles.get("GRL")?.countryName, "Greenland");
assert.equal(profiles.get("GRL")?.emotional.value, null);
assert.equal(profiles.get("GRL")?.socioeconomic.value, null);
assert.deepEqual(profiles.get("GRL")?.temperature, { value: 0.6, pointCount: 1 });
assert.deepEqual(profiles.get("GRL")?.physical, { value: 0.8, pointCount: 1 });
assert.equal(profiles.get("GRL")?.co2.value, null);
for (const iso3 of ["PRI", "NCL", "KOS"]) {
  assert.ok(profiles.get(iso3)!.socioeconomic.value! > 0, iso3);
  assert.equal(profiles.get(iso3)!.emotional.value, null, iso3);
}
assert.equal(findCountryInGeometries(geography, 72, -40), "GRL");
assert.equal(findCountryInGeometries(geography, 42.6, 20.9), "KOS");
assert.equal(findCountryInGeometries(geography, 0, -30), null, "Ocean remains unselectable");

// The runtime refresh calls this for every geographic profile after any exclusion change.
const filtered: EmoData = { ...emotions, countries: {}, missingCountries: { ...emotions.missingCountries } };
for (const [iso3, country] of Object.entries(emotions.countries)) {
  filtered.missingCountries![iso3] = { name: country.name, lang: country.lang,
    script: country.script, filteredOut: true };
}
for (const iso3 of profiles.keys()) assert.equal(emotionalSignal(filtered, iso3).value, null);
assert.equal(emotionalSignal(filtered, "IND").filteredOut, true);
assert.equal(emotionalSignal(filtered, "GRL").filteredOut, undefined);
assert.equal(Object.keys(emotions.countries).length, 192, "Geography adds no emotional observations");
const changes: string[] = [];
const selection = new CountrySelectionController(profiles, (event) => changes.push(event.action), () => {});
assert.ok(selection.toggle("GRL", true));
assert.equal(selection.selectedIso3, "GRL");
assert.ok(selection.toggle("PRI", true));
assert.ok(selection.toggle("PRI", true));
assert.equal(selection.selectedIso3, null);
assert.deepEqual(changes, ["open", "change", "close"]);
console.log(JSON.stringify({ passed: true, profiles: profiles.size, geographicAreas: geography.length,
  emotionalObservations: Object.keys(emotions.countries).length, gdpObservations: socioeconomic.length }));
