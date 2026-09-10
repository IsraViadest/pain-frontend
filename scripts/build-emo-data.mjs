/**
 * Build the emotional-pain label dataset consumed by the emo label views.
 *
 * Run: npm run build:emo-data
 *
 * PROVENANCE, read before trusting any number in the output:
 *   data-src/country-emotion-percentages-dummy.csv is DUMMY DATA. Upstream
 *   (pcai-classifier docs/reference/country-emotion-dummy-data.md v1.3) describes it as
 *   "dummy averages of independent classification scores". The live pain-server `emopain`
 *   table is byte-identical to the matching dummy word CSV, so the globe already shows
 *   these values today. Real classifier output drops in by replacing the CSV and re-running
 *   this script plus build:emo-fonts. The "-dummy" suffix stays in the filename on purpose.
 *
 * DISPLAY RULE: each country shows the pain category with the highest score, where the 14
 * pain categories exclude `no_pain` and `out_of_scope`. `out_of_scope` means the classified
 * text was not about pain at all, not that the country's signal is weak, so the strongest
 * pain category is the correct reading rather than a blank.
 *
 * TIE-BREAK: the dummy generator saturates at 1.0000, so 39 of 195 countries have two to six
 * pain categories sharing the identical top score. Ties are therefore broken deterministically by
 * category number (01_pain first), which keeps rebuilds and screenshots reproducible. Any choice
 * is arbitrary when the scores are identical; this one is at least stable and stated. Real
 * classifier output is unlikely to tie, and the tie count is reported on every run so a silent
 * change is visible.
 *
 * Join key is ISO 3166-1 alpha-3, matching src/api/countryCentroids.ts.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LEXICON = join(ROOT, "data-src/lexicon-by-country.tsv");
const noAnger = process.argv.includes("--no-anger");
const combined = process.argv.includes("--combined-v2") || noAnger;
const dataset = noAnger ? "combined-v2-no-anger" : "combined-v2";
const sourceName = combined ? "country-emotion-combined-v2.csv" : "country-emotion-percentages-dummy.csv";
const PERCENTAGES = process.argv.find((arg) => arg.startsWith("--source="))?.slice(9) ??
  join(ROOT, "data-src", sourceName);
const OUT = join(ROOT, combined ? `public/emo/${dataset}/emo-data.json` : "public/emo/emo-data.json");

/** Classifier `cat_key` -> lexicon column prefix. The two vocabularies are 1:1. */
const CAT_KEY_TO_LEXICON = {
  general_physical_pain: "01_pain",
  emotional_pain_unspecified: "02_hurt",
  climate_fear_anxiety_panic: "03_eco_anxiety",
  uncertainty_instability: "04_uncertainty",
  grief_solastalgia: "05_grief",
  anger_moral_injury: "06_anger",
  loss_precarity: "07_hardship",
  displacement_exile: "08_displacement",
  trauma_overwhelm: "09_trauma",
  relationship_social_pain: "10_loneliness",
  depression_suicidal_ideation: "11_depression",
  general_fear_anxiety_panic: "12_fear",
  helplessness_powerlessness: "13_helplessness",
  shame_guilt_self_blame: "14_shame",
};

/** Excluded from the display rule. Present in the source table, never a winner. */
const NON_PAIN_COLUMNS = ["no_pain", "out_of_scope"];

/**
 * Colour families, used only by presets that opt into colour. The default view is white:
 * the families are not clean enough to carry meaning on their own.
 */
const FAMILY = {
  "01_pain": "acute", "02_hurt": "acute",
  "05_grief": "loss", "07_hardship": "loss", "08_displacement": "loss",
  "12_fear": "dread", "03_eco_anxiety": "dread", "04_uncertainty": "dread",
  "11_depression": "collapse", "09_trauma": "collapse", "13_helplessness": "collapse",
  "06_anger": "social", "10_loneliness": "social", "14_shame": "social",
};

function parseDelimited(text, sep) {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0);
  const head = lines[0].split(sep);
  return lines.slice(1).map((line) => {
    const cells = line.split(sep);
    const row = {};
    head.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
}

const lexRows = parseDelimited(readFileSync(LEXICON, "utf8"), "\t");
const pctRows = parseDelimited(readFileSync(PERCENTAGES, "utf8"), ",");
const lex = new Map(lexRows.map((r) => [r.iso3, r]));

const allCatKeys = Object.keys(CAT_KEY_TO_LEXICON);
const catKeys = allCatKeys.filter((key) => !noAnger || key !== "anger_moral_injury");
const lexiconCats = Object.values(CAT_KEY_TO_LEXICON);

/** English category labels come from the lexicon's own English-language row (USA). */
const englishRow = lex.get("USA");
if (!englishRow) throw new Error("[build-emo-data] lexicon has no USA row to read English labels from");

const categories = catKeys.map((catKey) => {
  const key = CAT_KEY_TO_LEXICON[catKey];
  return { key, catKey, label: englishRow[`${key}_term`], family: FAMILY[key] };
});

const countries = {};
const missingCountries = {};
const warnings = [];
let fallbackCount = 0;
let tiedCount = 0;

for (const row of pctRows) {
  const iso3 = row.iso3;
  const lr = lex.get(iso3);
  if (!lr) { warnings.push(`no lexicon row for ${iso3}`); continue; }
  if (combined) {
    if (countries[iso3] || missingCountries[iso3]) throw new Error(`Duplicate country: ${iso3}`);
    const empty = allCatKeys.filter((key) => row[key]?.trim() === "").length;
    if (empty === allCatKeys.length) {
      missingCountries[iso3] = { name: lr.country, lang: lr.lang_code, script: lr.script };
      continue;
    }
    for (const key of [...allCatKeys, ...NON_PAIN_COLUMNS]) {
      const value = Number(row[key]);
      if (!row[key]?.trim() || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`Invalid ${key} for ${iso3}`);
      }
    }
  }

  // `catKeys` is in category-number order, and the comparison is strictly greater-than, so the
  // lowest-numbered category wins a tie. See the TIE-BREAK note in the file header.
  let winner = null;
  let best = -Infinity;
  let tiedWith = 0;
  for (const catKey of catKeys) {
    const v = Number.parseFloat(row[catKey]);
    if (!Number.isFinite(v)) { warnings.push(`${iso3}: non-numeric ${catKey}`); continue; }
    if (v > best) { best = v; winner = catKey; tiedWith = 0; }
    else if (v === best) { tiedWith += 1; }
  }
  if (winner == null) {
    warnings.push(`${iso3}: no winning category`);
    missingCountries[iso3] = { name: lr.country, lang: lr.lang_code, script: lr.script };
    continue;
  }
  if (tiedWith > 0) tiedCount += 1;

  const cat = CAT_KEY_TO_LEXICON[winner];
  const rawTerm = (lr[`${cat}_term`] ?? "").trim();
  const english = (lr[`${cat}_english`] ?? "").trim();
  const hasTerm = rawTerm !== "" && rawTerm !== "NO TERM FOUND";
  if (!hasTerm) fallbackCount += 1;

  // All 15 native terms, so a rule or data change always has the right word to hand.
  const terms = {};
  for (const c of lexiconCats) {
    const t = (lr[`${c}_term`] ?? "").trim();
    terms[c] = t === "NO TERM FOUND" ? "" : t;
  }

  const scores = {};
  for (const c of [...allCatKeys, ...NON_PAIN_COLUMNS]) scores[c] = Number.parseFloat(row[c]);

  countries[iso3] = {
    name: lr.country,
    cat,
    score: best,
    // `term` is what a native-language view renders. Empty means fall back to `en`.
    term: hasTerm ? rawTerm : "",
    en: english === "NO TERM FOUND" ? englishRow[`${cat}_term`] : english,
    lang: lr.lang_code,
    langEn: lr.language_english,
    script: hasTerm ? lr.script : "Latn",
    terms,
    scores,
  };
}

const out = {
  meta: {
    generated: new Date().toISOString(),
    source: {
      lexicon: "data-src/lexicon-by-country.tsv",
      percentages: `data-src/${sourceName}`,
      percentagesAreDummy: !combined,
    },
    rule: noAnger
      ? "argmax over the 13 remaining pain categories; anger_moral_injury, no_pain and out_of_scope excluded; source scores unchanged"
      : "argmax over the 14 pain categories; no_pain and out_of_scope excluded",
    countryCount: Object.keys(countries).length,
    categoryCount: categories.length,
    englishFallbackCount: fallbackCount,
    tiedWinnerCount: tiedCount,
  },
  categories,
  countries,
  ...(combined ? { missingCountries } : {}),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));

const bytes = Buffer.byteLength(JSON.stringify(out));
console.log(`[build-emo-data] ${out.meta.countryCount} countries, ${categories.length} categories`);
console.log(`[build-emo-data] English fallbacks: ${fallbackCount}`);
console.log(`[build-emo-data] winners decided by a tie: ${tiedCount} (broken by category number)`);
console.log(`[build-emo-data] wrote ${OUT} (${(bytes / 1024).toFixed(1)} KB)`);
if (warnings.length) {
  console.warn(`[build-emo-data] ${warnings.length} warning(s):`);
  for (const w of warnings.slice(0, 20)) console.warn(`  - ${w}`);
}
