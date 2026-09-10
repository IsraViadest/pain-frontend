/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/**
 * Build subsetted Noto webfonts covering exactly the glyphs the emo label views can display.
 *
 * Run: npm run build:emo-fonts   (requires python3 with fonttools + brotli; see PREREQS)
 *
 * The outputs (public/emo/fonts/*.woff2 and src/emo/fonts.generated.css) are COMMITTED, so a
 * normal `npm run build` and the pain-server Docker build never need python or the network.
 * Re-run this only after build:emo-data changes what is displayed.
 *
 * WHY THIS EXISTS: the four brand faces are Latin-only except Apercu Pro, which adds Greek and
 * Cyrillic. The lexicon needs 20 scripts. Without these subsets the labels fall back to whatever
 * the viewer's OS happens to have, which is fine on macOS and shows tofu on many Windows and
 * Linux machines.
 *
 * Dataset subsets cover their displayed words. --all-terms builds the shared lazy subset for
 * every one of the 195 x 14 selectable native terms and all dataset glosses. Both original and
 * locale-lowercase glyphs are retained, so exclusion reranking and lowercase artwork are covered.
 * Re-run after data or lexicon changes. Add --verify to check committed font cmaps without writes.
 *
 * Codepoints already covered by Apercu Pro are excluded, so Latin, Greek and Cyrillic keep the
 * project's own typography and Noto only fills real gaps.
 *
 * Subsets are built with --layout-features='*' because Arabic contextual joining and Indic
 * conjuncts live in GSUB; dropping features would silently break shaping. --no-hinting is used
 * (macOS ignores TrueType hinting entirely and it costs bytes).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const allTerms = process.argv.includes("--all-terms");
const verifyOnly = process.argv.includes("--verify");
const noAnger = process.argv.includes("--no-anger");
const combined = process.argv.includes("--combined-v2") || noAnger;
if (allTerms && combined) throw new Error("--all-terms builds the shared lexicon subset; do not combine with dataset flags");
const dataset = noAnger ? "combined-v2-no-anger" : "combined-v2";
const ASSET = combined ? `emo/${dataset}` : "emo";
const FONT_ASSET = allTerms ? "emo/filter-fonts" : `${ASSET}/fonts`;
const DATA = join(ROOT, "public", ASSET, "emo-data.json");
const BRAND = join(ROOT, "public/fonts/Apercu Pro Regular.otf");
const OUT_FONTS = join(ROOT, "public", FONT_ASSET);
const OUT_CSS = join(ROOT, allTerms ? "src/emo/fonts.filter.generated.css" :
  combined ? `src/emo/fonts.${dataset}.generated.css` : "src/emo/fonts.generated.css");
const FAMILY_PREFIX = allTerms ? "NotoEmoFilter" : noAnger ? "NotoEmoV2NoAnger" : combined ? "NotoEmoV2" : "NotoEmo";
const SCOPE = allTerms ? "html[data-emo-dataset][data-emo-filter-fonts] " : combined ? `html[data-emo-dataset="${dataset}"] ` : "";
const CACHE = join(ROOT, "node_modules/.cache/emo-fonts");

/** Script code -> google/fonts `ofl/<dir>` holding a Noto face for it. */
const SCRIPT_SOURCE = {
  Arab: "notosansarabic", Hebr: "notosanshebrew", Deva: "notosansdevanagari",
  Beng: "notosansbengali", Thai: "notosansthai", Laoo: "notosanslao",
  Khmr: "notosanskhmer", Mymr: "notosansmyanmar", Sinh: "notosanssinhala",
  Tibt: "notoseriftibetan", Thaa: "notosansthaana", Ethi: "notosansethiopic",
  Geor: "notosansgeorgian", Armn: "notosansarmenian", Kore: "notosanskr",
  Jpan: "notosansjp", Hans: "notosanssc", Cyrl: "notosans", Latn: "notosans",
  Grek: "notosans",
};

function py(code) {
  return execFileSync(process.env.PYTHON ?? "python3", ["-c", code], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

// ---- 1. every string the views can render, grouped by script -------------------------------
const data = JSON.parse(readFileSync(DATA, "utf8"));
const byScript = new Map();
const addTo = (script, text, locale = "en") => {
  if (!byScript.has(script)) byScript.set(script, new Set());
  const set = byScript.get(script);
  for (const ch of text + text.toLocaleLowerCase(locale)) {
    if (!/\s/.test(ch)) set.add(ch.codePointAt(0));
  }
};
const datasets = allTerms ? [data, ...["combined-v2", "combined-v2-no-anger"].map((name) =>
  JSON.parse(readFileSync(join(ROOT, "public/emo", name, "emo-data.json"), "utf8")))] : [data];
for (const source of datasets) {
  for (const c of Object.values(source.countries)) {
    addTo(c.script, c.term, c.lang); // Native words use their declared language for casing.
    addTo("Latn", c.en);
    addTo("Latn", c.name);
  }
  for (const c of Object.values(source.missingCountries ?? {})) addTo("Latn", c.name);
  for (const c of source.categories) addTo("Latn", c.label);
}
addTo("Latn", "body pain");
const filterScripts = {};
if (allTerms) {
  const [header, ...lines] = readFileSync(join(ROOT, "data-src/lexicon-by-country.tsv"), "utf8")
    .trimEnd().split(/\r?\n/);
  const columns = header.split("\t");
  for (const line of lines) {
    const cells = line.split("\t");
    const row = Object.fromEntries(columns.map((key, i) => [key, cells[i] ?? ""]));
    if (!data.countries[row.iso3] || filterScripts[row.iso3] || !SCRIPT_SOURCE[row.script]) {
      throw new Error(`Invalid lexicon identity or script: ${row.iso3}`);
    }
    filterScripts[row.iso3] = row.script;
    for (const { key } of data.categories) {
      const term = row[`${key}_term`].trim();
      const english = row[`${key}_english`].trim();
      if (term && term !== "NO TERM FOUND") addTo(row.script, term, row.lang_code);
      if (english && english !== "NO TERM FOUND") addTo("Latn", english);
    }
  }
  if (Object.keys(filterScripts).length !== data.meta.countryCount) throw new Error("Incomplete filter script map");
}

// ---- 2. drop anything Apercu Pro already covers ---------------------------------------------
const brandCodepoints = new Set(JSON.parse(py(
  `import json;from fontTools.ttLib import TTFont;` +
  `f=TTFont(${JSON.stringify(BRAND)},fontNumber=0,lazy=True);` +
  `print(json.dumps(sorted(f.getBestCmap().keys())))`
)));
const needed = new Map();
for (const [script, set] of byScript) {
  const miss = [...set].filter((c) => !brandCodepoints.has(c)).sort((a, b) => a - b);
  if (miss.length) needed.set(script, miss);
}

function verifyCoverage() {
  const required = JSON.stringify(Object.fromEntries(needed));
  py(`import json\nfrom pathlib import Path\nfrom fontTools.ttLib import TTFont
required = json.loads(${JSON.stringify(required)})
for script, points in required.items():
    path = Path(${JSON.stringify(OUT_FONTS)}) / (script + '.woff2')
    font = TTFont(path)
    cmap = font.getBestCmap()
    missing = set(points) - cmap.keys()
    assert not missing, (str(path), 'missing glyphs', [hex(p) for p in sorted(missing)])
    assert 'GSUB' in font, (str(path), 'missing shaping rules')
    cached = Path(${JSON.stringify(CACHE)}) / (script + '.400.ttf')
    if cached.exists():
        assert len(cmap) < len(TTFont(cached).getBestCmap()), (str(path), 'not a subset')
`);
  console.log(`[build-emo-fonts] cmap coverage and shaping: PASS (${allTerms ? "all 195 x 14 terms and all datasets" : ASSET}; original + lowercase)`);
}

if (verifyOnly) {
  verifyCoverage();
  process.exit(0);
}

// ---- 3. fetch a Noto source per script (cached outside git) ---------------------------------
mkdirSync(CACHE, { recursive: true });
async function sourceFor(dir) {
  const listing = await (await fetch(`https://api.github.com/repos/google/fonts/contents/ofl/${dir}`,
    { headers: { "User-Agent": "build-emo-fonts", Accept: "application/vnd.github+json" } })).json();
  if (!Array.isArray(listing)) throw new Error(`cannot list ofl/${dir}: ${JSON.stringify(listing).slice(0, 160)}`);
  // Upright only: google/fonts lists NotoSans-Italic[...] before NotoSans[...] alphabetically,
  // and picking it silently renders every Latin fallback glyph in italic.
  const fonts = listing.filter((f) => /\.(ttf|otf)$/i.test(f.name) && !/italic/i.test(f.name));
  const variable = fonts.filter((f) => f.name.includes("[") && f.name.includes("wght"));
  const regular = fonts.filter((f) => f.name.includes("Regular"));
  const pick = (variable[0] ?? regular[0] ?? fonts[0]);
  if (!pick) throw new Error(`no font file in ofl/${dir}`);
  const dest = join(CACHE, pick.name);
  if (!existsSync(dest)) {
    process.stdout.write(`  downloading ${pick.name} … `);
    const buf = Buffer.from(await (await fetch(pick.download_url)).arrayBuffer());
    writeFileSync(dest, buf);
    process.stdout.write(`${(buf.length / 1024 / 1024).toFixed(1)} MB\n`);
  }
  return dest;
}

// ---- 4. instance to wght=400, subset, emit woff2 ---------------------------------------------
mkdirSync(OUT_FONTS, { recursive: true });
const faces = [];
let total = 0;
for (const [script, codepoints] of [...needed].sort((a, b) => b[1].length - a[1].length)) {
  const dir = SCRIPT_SOURCE[script];
  if (!dir) throw new Error(`no Noto source mapped for script "${script}"`);
  const pinned = join(CACHE, `${script}.400.ttf`);
  if (!existsSync(pinned)) {
    const src = await sourceFor(dir);
    py(
      `from fontTools.ttLib import TTFont;from fontTools.varLib import instancer;` +
      `f=TTFont(${JSON.stringify(src)});` +
      `ax={a.axisTag for a in f['fvar'].axes} if 'fvar' in f else set();` +
      `loc={k:v for k,v in (('wght',400),('wdth',100)) if k in ax};` +
      `f=instancer.instantiateVariableFont(f,loc,inplace=True,updateFontNames=False) if loc else f;` +
      `f.save(${JSON.stringify(pinned)})`
    );
  }
  const out = join(OUT_FONTS, `${script}.woff2`);
  execFileSync("pyftsubset", [
    pinned,
    `--unicodes=${codepoints.map((c) => `U+${c.toString(16).toUpperCase().padStart(4, "0")}`).join(",")}`,
    "--layout-features=*", "--no-hinting", "--flavor=woff2", `--output-file=${out}`,
  ]);
  const bytes = statSync(out).size;
  total += bytes;
  faces.push({ script, codepoints: codepoints.length, bytes });
  console.log(`  ${script.padEnd(5)} ${String(codepoints.length).padStart(4)} cps  ${String(bytes).padStart(7)} B`);
}
verifyCoverage();

// ---- 5. emit the CSS ------------------------------------------------------------------------
const css = [
  `/* GENERATED by scripts/build-emo-fonts.mjs. Do not edit; re-run \`${allTerms ? "node scripts/build-emo-fonts.mjs --all-terms" : "npm run build:emo"}\`. */`,
  "/* Brand face first in every stack: Apercu Pro keeps Latin, Greek and Cyrillic, and Noto",
  "   supplies only the characters it lacks. font-display:block avoids a flash of tofu. */",
  "",
  ...faces.map(({ script }) =>
    `@font-face {\n  font-family: "${FAMILY_PREFIX}-${script}";\n  src: url("/${FONT_ASSET}/${script}.woff2") format("woff2");\n  font-weight: 400;\n  font-style: normal;\n  font-display: block;\n}`),
  "",
  ...faces.map(({ script }) =>
    `${SCOPE}.emo-sc-${script} {\n  font-family: "Apercu Pro", "${FAMILY_PREFIX}-${script}", system-ui, sans-serif;\n}`),
  "",
  "/* Scripts fully covered by the brand face need no Noto subset. */",
  ...[...byScript.keys()].filter((s) => !needed.has(s)).map((s) =>
    `${SCOPE}.emo-sc-${s} {\n  font-family: "Apercu Pro", system-ui, sans-serif;\n}`),
  "",
].join("\n");
mkdirSync(dirname(OUT_CSS), { recursive: true });
writeFileSync(OUT_CSS, css);
if (allTerms) writeFileSync(join(ROOT, "public/emo/filter-scripts.json"), JSON.stringify(filterScripts));

console.log(`[build-emo-fonts] ${faces.length} subsets, ${faces.reduce((n, f) => n + f.codepoints, 0)} codepoints, ${(total / 1024).toFixed(1)} KB total`);
console.log(`[build-emo-fonts] wrote ${OUT_CSS}`);
