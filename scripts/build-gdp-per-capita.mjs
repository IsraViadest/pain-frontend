import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const roster = JSON.parse(readFileSync(new URL("public/emo/emo-data.json", root))).countries;
const url = "https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.CD?date=2024&format=json&per_page=20000";
const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
if (!response.ok) throw new Error(`World Bank: ${response.status}`);
const [meta, rows] = await response.json();
if (meta.pages !== 1 || !Array.isArray(rows)) throw new Error("Incomplete World Bank response");
const countries = Object.fromEntries(Object.keys(roster).sort().map((iso) => [iso, null]));
for (const row of rows) {
  if (!(row.countryiso3code in countries)) continue;
  if (row.date !== "2024") throw new Error("Mixed reference years");
  if (row.value !== null && (!Number.isFinite(row.value) || row.value <= 0)) {
    throw new Error(`Invalid GDP per capita: ${row.countryiso3code}`);
  }
  countries[row.countryiso3code] = row.value;
}
const values = Object.values(countries).filter((value) => value !== null);
if (values.length < 180) throw new Error("Unexpected loss of country coverage");
const output = { meta: { source: url, indicator: "NY.GDP.PCAP.CD", year: 2024,
  unit: "current US dollars per person", license: "CC BY 4.0", updated: meta.lastupdated,
  mapping: "1 - (log(value) - log(min)) / (log(max) - log(min)); lower GDP gives stronger yellow",
  minimum: Math.min(...values), maximum: Math.max(...values) }, countries };
writeFileSync(new URL("public/emo/gdp-per-capita-2024.json", root), JSON.stringify(output) + "\n");
console.log(`GDP per capita: ${values.length} observed, ${195 - values.length} missing, 2024 only`);
