import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import type { Country } from "world-countries";
import type { PainPoint } from "../src/types/api";
import {
  buildCountryResolver,
  countryByCca2,
  countryByCca3,
} from "./countryResolver";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const REPO =
  "https://github.com/7Magic7Mike7/pain/tree/main/data";

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function readCsv(file: string): Record<string, string>[] {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) {
    console.warn(`[pain data] missing ${p} — run npm run fetch:data`);
    return [];
  }
  const buf = fs.readFileSync(p, "utf8");
  return parse(buf, { columns: true, skip_empty_lines: true, relax_column_count: true }) as Record<
    string,
    string
  >[];
}

function toPoint(
  id: string,
  country: Country,
  uiLayer: string,
  intensity: number,
  category: string,
  text: string | undefined,
  metadata?: PainPoint["metadata"],
): PainPoint {
  const [lat, lng] = country.latlng;
  return {
    id,
    lat,
    lng,
    intensity: clamp01(intensity),
    category,
    uiLayer,
    text,
    metadata,
    createdAt: "1970-01-01T00:00:00.000Z",
  };
}

function normByMax(values: number[]): number[] {
  const m = Math.max(1e-9, ...values.map((v) => Math.abs(v)));
  return values.map((v) => Math.abs(v) / m);
}

/** Environmental: latest Red List Index per ISO3; intensity ~ inverse (lower index ⇒ higher stress in prototype). */
function loadEnvironmental(cca3Map: Map<string, Country>): PainPoint[] {
  const rows = readCsv("env_earth.csv");
  if (!rows.length) return [];
  const latest = new Map<string, { year: number; rli: number }>();
  for (const r of rows) {
    const code = r.Code?.trim();
    if (!code || code === "OWID_WRL") continue;
    const y = Number(r.Year);
    const rli = Number(r["Red List Index"]);
    if (!Number.isFinite(y) || !Number.isFinite(rli)) continue;
    const cur = latest.get(code);
    if (!cur || y > cur.year) latest.set(code, { year: y, rli });
  }
  const intensities: number[] = [];
  const tmp: { country: Country; inv: number; year: number }[] = [];
  for (const [code, { year, rli }] of latest) {
    const c = cca3Map.get(code);
    if (!c) continue;
    const inv = 1 - clamp01(rli);
    intensities.push(inv);
    tmp.push({ country: c, inv, year });
  }
  const n = normByMax(intensities);
  return tmp.map((t, i) =>
    toPoint(
      `env-${t.country.cca3}`,
      t.country,
      "environmental",
      n[i] ?? t.inv,
      "red-list-index",
      `Red List stress (1−RLI), year ${t.year} · ${REPO}/env_earth.csv`,
      {
        country: t.country.name.common,
        layerLabel: "Environmental",
        metricLabel: "Red List stress (1−RLI)",
        rawValue: t.inv,
        year: t.year,
        sourceUrl: `${REPO}/env_earth.csv`,
      },
    ),
  );
}

/** Socioeconomic: Gini (World Bank column when present). */
function loadSocioeconomic(cca2Map: Map<string, Country>): PainPoint[] {
  const rows = readCsv("gini-coefficient-by-country-2025.csv");
  if (!rows.length) return [];
  const key = "GiniCoefficient_GiniCoefficientViaWorldBank_gini_2024update";
  const raw: { country: Country; gini: number }[] = [];
  for (const r of rows) {
    const code = r.flagCode?.replaceAll('"', "").trim();
    const g = Number(r[key]);
    if (!code || !Number.isFinite(g)) continue;
    const c = cca2Map.get(code);
    if (!c) continue;
    raw.push({ country: c, gini: g });
  }
  const n = normByMax(raw.map((x) => x.gini));
  return raw.map((t, i) =>
    toPoint(
      `socio-${t.country.cca2}`,
      t.country,
      "socioeconomic",
      n[i] ?? clamp01(t.gini / 70),
      "gini",
      `Gini ${t.gini.toFixed(1)} · ${REPO}/gini-coefficient-by-country-2025.csv`,
      {
        country: t.country.name.common,
        layerLabel: "Socioeconomic",
        metricLabel: "Gini",
        rawValue: t.gini,
        year: 2024,
        sourceUrl: `${REPO}/gini-coefficient-by-country-2025.csv`,
      },
    ),
  );
}

/** Physical: aggregate DALY columns from painful disease vs environment file. */
function loadPhysical(resolve: (loc: string) => Country | undefined): PainPoint[] {
  const rows = readCsv("painful_disease_prevalence_vs_environment.csv");
  if (!rows.length) return [];
  const dalyCols = [
    "Rheumatoid arthritis_val_DALYs (Disability-Adjusted Life Years)",
    "Osteoarthritis_val_DALYs (Disability-Adjusted Life Years)",
    "Low back pain_val_DALYs (Disability-Adjusted Life Years)",
    "Neck pain_val_DALYs (Disability-Adjusted Life Years)",
    "Migraine_val_DALYs (Disability-Adjusted Life Years)",
  ];
  const raw: { country: Country; sum: number }[] = [];
  for (const r of rows) {
    const loc = r.location?.trim();
    if (!loc) continue;
    const c = resolve(loc);
    if (!c) continue;
    let sum = 0;
    for (const col of dalyCols) {
      const v = Number(r[col]);
      if (Number.isFinite(v)) sum += v;
    }
    if (!(sum > 0)) continue;
    raw.push({ country: c, sum });
  }
  const n = normByMax(raw.map((x) => x.sum));
  return raw.map((t, i) =>
    toPoint(
      `phys-${t.country.cca2}`,
      t.country,
      "physical",
      n[i] ?? clamp01(t.sum),
      "daly-pain",
      `DALY aggregate (musculoskeletal + migraine) · ${REPO}/painful_disease_prevalence_vs_environment.csv`,
      {
        country: t.country.name.common,
        layerLabel: "Physical",
        metricLabel: "DALY aggregate",
        rawValue: t.sum,
        sourceUrl: `${REPO}/painful_disease_prevalence_vs_environment.csv`,
      },
    ),
  );
}

/** Emotional (proxy): max reported conflict death rate by location (IHME). */
function loadEmotional(resolve: (loc: string) => Country | undefined): PainPoint[] {
  const socialRows = readCsv("emotional.csv");
  if (socialRows.length) {
    const byCountry = new Map<string, { country: Country; score: number; text: string }>();
    for (const r of socialRows) {
      const loc = r.country?.trim();
      const txt = r.country_tweet?.trim();
      const score = Number(r.pain_score);
      if (!loc || !txt || !Number.isFinite(score)) continue;
      const c = resolve(loc);
      if (!c) continue;
      const key = c.cca3;
      const prev = byCountry.get(key);
      if (!prev || score > prev.score) {
        byCountry.set(key, { country: c, score, text: txt });
      }
    }
    const raw = [...byCountry.values()];
    const n = normByMax(raw.map((x) => x.score));
    if (raw.length) {
      return raw.map((t, i) =>
        toPoint(
          `emo-social-${t.country.cca3}`,
          t.country,
          "emotional",
          n[i] ?? clamp01(t.score),
          "sentiment",
          t.text,
          {
            country: t.country.name.common,
            layerLabel: "Emotional",
            metricLabel: "Social pain score",
            rawValue: t.score,
            sourceUrl: `${REPO}/emotional.csv`,
          },
        ),
      );
    }
  }

  const rows = readCsv("conflict-deaths-by-country.csv");
  if (!rows.length) return [];
  const maxRate = new Map<string, number>();
  for (const r of rows) {
    if (r.metric?.trim() !== "Rate") continue;
    const loc = r.location?.trim();
    if (!loc) continue;
    const v = Number(r.val);
    if (!Number.isFinite(v)) continue;
    maxRate.set(loc, Math.max(maxRate.get(loc) ?? 0, v));
  }
  const raw: { country: Country; rate: number }[] = [];
  for (const [loc, rate] of maxRate) {
    const c = resolve(loc);
    if (!c) continue;
    raw.push({ country: c, rate });
  }
  const n = normByMax(raw.map((x) => x.rate));
  return raw.map((t, i) =>
    toPoint(
      `emo-${t.country.cca2}`,
      t.country,
      "emotional",
      n[i] ?? clamp01(t.rate / 100),
      "conflict",
      `Peak conflict death rate (IHME) · ${REPO}/conflict-deaths-by-country.csv`,
      {
        country: t.country.name.common,
        layerLabel: "Emotional",
        metricLabel: "Peak conflict death rate",
        rawValue: t.rate,
        sourceUrl: `${REPO}/conflict-deaths-by-country.csv`,
      },
    ),
  );
}

export function loadPainRepoPoints(): PainPoint[] {
  const resolve = buildCountryResolver();
  const cca2 = countryByCca2();
  const cca3 = countryByCca3();
  return [
    ...loadEnvironmental(cca3),
    ...loadSocioeconomic(cca2),
    ...loadPhysical(resolve),
    ...loadEmotional(resolve),
  ];
}
