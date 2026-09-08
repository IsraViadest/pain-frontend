/**
 * Loader and types for the generated emotional-pain label dataset.
 *
 * The file is produced by `npm run build:emo-data` from the vendored lexicon and the
 * country-emotion percentages. See scripts/build-emo-data.mjs for the display rule and for the
 * provenance caveat: the percentages are dummy data upstream.
 */

/** One of the 14 pain categories. `key` matches the lexicon column prefix, e.g. "11_depression". */
interface EmoCategory {
  key: string;
  /** Classifier column name, e.g. "depression_suicidal_ideation". */
  catKey: string;
  /** English label, e.g. "Depression". This is what an English-language view renders. */
  label: string;
  /** Coarse grouping used only by presets that opt into colour. */
  family: string;
}

/** One country's winning category and the word for it in that country's primary language. */
interface EmoCountry {
  name: string;
  /** Winning category key, into `EmoData.categories`. */
  cat: string;
  /** The winning category's score. Drives label intensity. */
  score: number;
  /** Native-language term. Empty when the lexicon declares a gap; fall back to the English label. */
  term: string;
  /** English gloss of the native term (not the category label). Used in the tooltip. */
  en: string;
  lang: string;
  langEn: string;
  /** ISO 15924 script code of `term`, or "Latn" when falling back to English. */
  script: string;
  /** All 15 native terms, so a rule or data change always has the right word to hand. */
  terms: Record<string, string>;
  /** All 16 category scores, including the excluded no_pain and out_of_scope. */
  scores: Record<string, number>;
}

export interface EmoData {
  meta: {
    generated: string;
    source: { lexicon: string; percentages: string; percentagesAreDummy: boolean };
    rule: string;
    countryCount: number;
    categoryCount: number;
    englishFallbackCount: number;
    tiedWinnerCount: number;
  };
  categories: EmoCategory[];
  countries: Record<string, EmoCountry>;
  /** Country identity remains available when the selected source has no emotional observations. */
  missingCountries?: Record<string, { name: string; lang: string; script: string }>;
}

type EmoDataset = "original" | "combined-v2";
const cached = new Map<EmoDataset, EmoData>();

/** Fetch and cache the generated dataset. Safe to call repeatedly. */
export async function loadEmoData(dataset: EmoDataset = "original"): Promise<EmoData> {
  if (dataset === "combined-v2") await import("./fonts.combined-v2.generated.css");
  document.documentElement.dataset.emoDataset = dataset;
  const existing = cached.get(dataset);
  if (existing) return existing;
  const url = `${import.meta.env.BASE_URL}emo/${dataset === "combined-v2" ? "combined-v2/" : ""}emo-data.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[emoData] ${url} responded ${res.status}`);
  }
  const data = (await res.json()) as EmoData;
  cached.set(dataset, data);
  return data;
}
