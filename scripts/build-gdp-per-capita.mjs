import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const roster = JSON.parse(readFileSync(new URL("public/emo/emo-data.json", root))).countries;
const geography = JSON.parse(readFileSync(new URL("public/borders/ne_110m_admin_0_countries.geojson", root)));
const geographicKeys = geography.features.map(({ properties }) =>
  properties.ISO_A3 && properties.ISO_A3 !== "-99" ? properties.ISO_A3 : properties.ADM0_A3);
const url = "https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.CD?date=2024&format=json&per_page=20000";
const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
if (!response.ok) throw new Error(`World Bank: ${response.status}`);
const [meta, rows] = await response.json();
if (meta.pages !== 1 || !Array.isArray(rows)) throw new Error("Incomplete World Bank response");
const countries = Object.fromEntries([...new Set([...Object.keys(roster), ...geographicKeys])]
  .sort().map((iso) => [iso, null]));
for (const row of rows) {
  // Natural Earth labels Kosovo KOS; World Bank uses XKX. No administering-country imputation.
  const iso3 = row.countryiso3code === "XKX" ? "KOS" : row.countryiso3code;
  if (!(iso3 in countries)) continue;
  if (row.date !== "2024") throw new Error("Mixed reference years");
  if (row.value !== null && (!Number.isFinite(row.value) || row.value <= 0)) {
    throw new Error(`Invalid GDP per capita: ${row.countryiso3code}`);
  }
  countries[iso3] = row.value;
}
const values = Object.values(countries).filter((value) => value !== null);
if (values.length < 180) throw new Error("Unexpected loss of country coverage");
const output = { meta: { source: url, indicator: "NY.GDP.PCAP.CD", year: 2024,
  unit: "current US dollars per person", license: "CC BY 4.0", updated: meta.lastupdated,
  mapping: "1 - (log(value) - log(min)) / (log(max) - log(min)); lower GDP gives stronger yellow",
  minimum: Math.min(...values), maximum: Math.max(...values) }, countries };
writeFileSync(new URL("public/emo/gdp-per-capita-2024.json", root), JSON.stringify(output) + "\n");
console.log(`GDP per capita: ${values.length} observed, ${Object.keys(countries).length - values.length} missing, 2024 only`);
