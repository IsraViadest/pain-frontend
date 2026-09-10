/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
import type { EmoData } from "./emoData";

let scripts: Promise<Record<string, string>> | undefined;

/** Rerank the unfiltered source; exclusion changes eligibility, never the stored scores. */
export async function filterEmotions(base: EmoData, excluded: ReadonlySet<string>): Promise<EmoData> {
  excluded = new Set(excluded); // Capture rapid control changes before font loading yields.
  for (const key of excluded) {
    if (!base.categories.some((category) => category.key === key)) {
      throw new Error(`[emoFilter] Unknown category: ${key}`);
    }
  }
  if (!excluded.size) {
    delete document.documentElement.dataset.emoFilterFonts;
    return base;
  }
  scripts ??= Promise.all([
    import("./fonts.filter.generated.css"),
    fetch(`${import.meta.env.BASE_URL}emo/filter-scripts.json`).then(async (response) => {
      if (!response.ok) throw new Error(`[emoFilter] Font script map responded ${response.status}`);
      return await response.json() as Record<string, string>;
    }),
  ]).then(([, map]) => map);
  const nativeScripts = await scripts;
  document.documentElement.dataset.emoFilterFonts = "";
  const candidates = base.categories.filter((category) => !excluded.has(category.key))
    .sort((a, b) => a.key.localeCompare(b.key));
  const countries: EmoData["countries"] = {};
  const missingCountries = { ...base.missingCountries };
  let englishFallbackCount = 0;
  let tiedWinnerCount = 0;
  for (const [iso, country] of Object.entries(base.countries)) {
    if (!candidates.length) {
      missingCountries[iso] = {
        name: country.name, lang: country.lang,
        script: nativeScripts[iso], filteredOut: true,
      };
      continue;
    }
    let winner = candidates[0];
    let ties = 0;
    for (const category of candidates.slice(1)) {
      const score = country.scores[category.catKey];
      if (score > country.scores[winner.catKey]) { winner = category; ties = 0; }
      else if (score === country.scores[winner.catKey]) ties++;
    }
    const term = country.terms[winner.key];
    if (term && !nativeScripts[iso]) throw new Error(`[emoFilter] No native script for ${iso}`);
    if (!term) englishFallbackCount++;
    if (ties) tiedWinnerCount++;
    countries[iso] = {
      ...country, cat: winner.key, score: country.scores[winner.catKey], term,
      en: winner.key === country.cat ? country.en : winner.label,
      script: term ? nativeScripts[iso] : "Latn",
    };
  }
  return {
    ...base, countries, missingCountries,
    meta: {
      ...base.meta, countryCount: Object.keys(countries).length,
      englishFallbackCount, tiedWinnerCount,
      rule: `argmax over ${candidates.length} enabled pain categories; excluded ${[...excluded].sort().join(", ")}; source scores unchanged`,
    },
  };
}
