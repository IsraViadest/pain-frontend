import { surveyLayoutOverrides } from "./surveyLayoutOverrides";

/** Survey word category ids (pain-server layer families). */
type SurveyWordCategory =
  | "emotional"
  | "environmental"
  | "socioeconomic"
  | "physical";

type SurveyWord = {
  word: string;
  category: SurveyWordCategory;
};

type SurveyBlobId = "blob1" | "blob2" | "blob3" | "blob4" | "blob5";

type SurveyBlobDef = {
  viewBox: string;
  /** Three compatible path variants for subtle CSS `d` morph keyframes. */
  paths: [string, string, string];
};

/** One word placed on the world map (Screen 2). */
export type SurveyWordPlacement = {
  word: string;
  lat: number;
  lng: number;
};

/** Shared session state owned by {@link SurveyModal}. */
export type SurveySessionState = {
  selectedWords: Set<string>;
  placements: SurveyWordPlacement[];
  temporality: string[];
  relations: string[];
  painText: string;
};

/** Screen 3 — how long the user has felt their pain (multi-select labels). */
export const SURVEY_TEMPORALITY_OPTIONS = [
  "days",
  "weeks",
  "months",
  "years",
  "my whole life",
  "many generations",
] as const;

type SurveyTemporalityOption = (typeof SURVEY_TEMPORALITY_OPTIONS)[number];

/** Fixed panel positions (% of field) — six options, no runtime layout needed. */
export const SURVEY_TEMPORALITY_LAYOUT: Record<
  SurveyTemporalityOption,
  { left: number; top: number }
> = {
  days: { left: 32, top: 28 },
  weeks: { left: 58, top: 35 },
  months: { left: 42, top: 48 },
  years: { left: 68, top: 42 },
  "my whole life": { left: 52, top: 62 },
  "many generations": { left: 28, top: 65 },
};

/** Screen 4 — who the user carries their pain with (multi-select labels). */
export const SURVEY_RELATIONS_OPTIONS = [
  "my mother",
  "my father",
  "my children",
  "my grandparents",
  "my family members",
  "my extended family",
  "my workplace",
  "my community",
  "my network",
  "my garden",
  "my microbes",
  "my plants",
  "my pets",
  "the trees",
  "the animals",
  "the ocean",
  "the sky",
  "the river",
  "the mountain",
  "the forest",
  "the nature",
  "my ancestors",
  "the stars",
  "the moon",
] as const;

/** MIME type for HTML5 drag-and-drop word payloads between tray, map, and pins. */
export const SURVEY_DRAG_WORD_MIME = "application/x-survey-word";

/** Modal + screen fade duration (ms) — matches survey.css transitions. */
export const SURVEY_FADE_MS = 300;

/** Placeholder API wait after submit — replace with Mike's POST round-trip. */
export const SURVEY_SUBMIT_DUMMY_DELAY_MS = 3000;

/** Placeholder response coordinates (Vienna) until pain-server returns placement. */
export const SURVEY_RESULT_DUMMY_LAT = 48.2;
export const SURVEY_RESULT_DUMMY_LNG = 16.37;

/** Camera distance from origin during post-submit fly-to (~outside RADIUS=1 globe). */
export const SURVEY_FLY_TO_CAMERA_RADIUS = 2.2;

/** Post-submit globe fly-to animation length (ms). */
export const SURVEY_FLY_TO_DURATION_MS = 2500;

// Empirically tuned via surveyDebug panel — tested on Screen 1 (46 blobs) and Screen 4 (24 blobs)
/** Minimum gap between bubble edges after runtime layout (px). */
export const SURVEY_BUBBLE_GAP_PX = 19;

/** Max overlap-resolution iterations before logging a warning. */
export const SURVEY_LAYOUT_MAX_ITERATIONS = 50;

/** Fractional inset from bubble-field edges when clamping bubble centers. */
export const SURVEY_FIELD_INSET_FRAC = 0.03;

/** Max hash jitter from cell center, as a fraction of cell width/height. */
export const SURVEY_INIT_CELL_OFFSET_FRAC = 0.2;

const SURVEY_WORD_CATEGORIES: Record<SurveyWordCategory, readonly string[]> =
  {
    emotional: [
      "grief",
      "solastalgia",
      "depression",
      "sadness",
      "anger",
      "apathy",
      "frustration",
      "confusion",
      "uncertainty",
      "panic",
      "fear",
      "mistrust",
    ],
    environmental: [
      "floods",
      "fires",
      "deforestation",
      "eruption",
      "toxicity",
      "heavy metals",
      "smog",
      "plastic pollution",
      "earthquake",
      "tsunami",
      "species extinction",
      "habitat loss",
    ],
    socioeconomic: [
      "corporate greed",
      "income inequality",
      "racism",
      "poverty",
      "discrimination",
      "capitalism",
      "patriarchy",
      "corruption",
      "consumerism",
      "surveillance",
    ],
    physical: [
      "asthma",
      "chronic pain",
      "suffering",
      "headache",
      "indigestion",
      "cancer",
      "muscle tension",
      "fatigue",
      "burnout",
      "arthritis",
      "aching",
      "numbing",
    ],
  };

/** Flat word list with category preserved for later screens and metrics. */
export const SURVEY_WORDS: SurveyWord[] = (
  Object.entries(SURVEY_WORD_CATEGORIES) as [
    SurveyWordCategory,
    readonly string[],
  ][]
).flatMap(([category, words]) => words.map((word) => ({ word, category })));

/** Selected words grouped for survey submission (Mike API-facing category keys). */
type SurveyWordsByCategory = {
  emotional: string[];
  environmental: string[];
  socioeconomical: string[];
  physical: string[];
};

/** Full survey payload logged on Screen 5 submit — API wiring comes later. */
type SurveySubmissionPayload = {
  words: SurveyWordsByCategory;
  placements: SurveyWordPlacement[];
  temporality: string[];
  relations: string[];
  painText: string;
};

const SURVEY_WORD_CATEGORY_BY_WORD = new Map(
  SURVEY_WORDS.map(({ word, category }) => [word, category] as const),
);

/**
 * Group selected Screen 1 words by pain category for submission.
 * Maps internal `socioeconomic` to API key `socioeconomical`.
 */
function groupWordsByCategory(
  selectedWords: Set<string>,
): SurveyWordsByCategory {
  const grouped: SurveyWordsByCategory = {
    emotional: [],
    environmental: [],
    socioeconomical: [],
    physical: [],
  };

  for (const word of selectedWords) {
    const category = SURVEY_WORD_CATEGORY_BY_WORD.get(word);
    if (!category) {
      console.warn(`[surveyData] Unknown survey word: ${word}`);
      continue;
    }
    if (category === "socioeconomic") {
      grouped.socioeconomical.push(word);
    } else {
      grouped[category].push(word);
    }
  }

  return grouped;
}

/** Build the JSON payload logged when the user submits the survey on Screen 5. */
export function buildSurveySubmissionPayload(
  state: SurveySessionState,
): SurveySubmissionPayload {
  return {
    words: groupWordsByCategory(state.selectedWords),
    placements: state.placements,
    temporality: state.temporality,
    relations: state.relations,
    painText: state.painText,
  };
}

const BLOB_BASE_PATHS: Record<
  SurveyBlobId,
  { viewBox: string; d: string }
> = {
  blob1: {
    viewBox: "0 0 234 172",
    d: "M212.133 161.296C185.006 180.599 151.865 168.045 121.631 167.328C87.5597 165.25 46.5554 181.556 17.8185 158.954C-4.97981 143.29 -6.86709 105.464 17.7807 85.5055C36.5277 67.2473 9.25025 36.6365 39.0441 23.3772C51.7769 16.8546 64.774 15.8347 77.4439 23.2765C124.475 55.2599 181.521 -29.9116 221.418 11.7172C245.248 40.9429 214.158 73.5307 229.961 103.953C239.473 124.54 231.647 147.697 212.133 161.296Z",
  },
  blob2: {
    viewBox: "0 0 214 152",
    d: "M48.0283 36.487C106.102 39.9971 84.8482 -34.0152 159.738 19.4865C171.604 29.9268 188.11 30.6069 200.506 40.0071C221.331 59.8178 218.012 104.329 190.829 117.13C160.297 127.08 129.096 132.1 100.914 148.771C64.3338 164.231 51.2974 119.88 24.4148 106.509C-19.0833 88.7687 -0.298437 28.0168 48.0383 36.487H48.0283Z",
  },
  blob3: {
    viewBox: "0 0 236 139",
    d: "M155.044 134.997C125.503 128.818 94.4871 124.294 64.4802 123.405C49.6528 122.512 35.3494 120.07 23.2516 111.965C-8.50076 92.3908 -7.22539 60.0339 23.9739 44.9015C48.1836 33.6602 48.428 4.38473 79.2623 0.417406C139.635 -5.41012 222.789 50.9162 235.014 97.4868C241.743 136.764 195.834 143.83 155.044 134.997C155.115 134.599 154.973 135.395 155.044 134.997Z",
  },
  blob4: {
    viewBox: "0 0 271 138",
    d: "M184.422 113.597C129.565 118.944 54.9793 162.381 15.523 118.076C-10.1292 90.8454 -8.06349 22.7585 52.9364 22.2919C171.374 41.9618 140.782 14.9541 235.533 0.00858699C266.926 -0.537874 281.161 24.7239 261.534 45.4195C239.794 71.9083 229.993 106.769 184.432 113.584L184.422 113.597Z",
  },
  blob5: {
    viewBox: "0 0 244 170",
    d: "M164.491 166.813C133.759 164.204 101.724 164.05 71.1447 168.498C55.9808 170.1 41.1654 169.56 27.9186 161.144C-6.64811 141.294 -9.18849 98.4098 20.7024 72.6222C43.9562 53.272 40.7341 14.6427 71.5778 3.6385C132.199 -15.3502 223.323 43.3099 241.259 102.398C252.749 152.903 206.963 170.814 164.491 166.813C164.517 166.275 164.466 167.351 164.491 166.813Z",
  },
};

/** Scale absolute path coordinates from viewBox center (for compatible `d` morph keyframes). */
function scalePathFromViewBoxCenter(
  d: string,
  viewBox: string,
  scale: number,
): string {
  const parts = viewBox.split(/\s+/).map(Number);
  const width = parts[2] ?? 0;
  const height = parts[3] ?? 0;
  const cx = width / 2;
  const cy = height / 2;
  let coordIndex = 0;
  return d.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (match) => {
    const value = Number(match);
    const isX = coordIndex % 2 === 0;
    coordIndex++;
    const center = isX ? cx : cy;
    const scaled = center + (value - center) * scale;
    return String(Math.round(scaled * 1000) / 1000);
  });
}

function buildBlobDef(id: SurveyBlobId): SurveyBlobDef {
  const base = BLOB_BASE_PATHS[id];
  const tight = scalePathFromViewBoxCenter(base.d, base.viewBox, 0.97);
  const loose = scalePathFromViewBoxCenter(base.d, base.viewBox, 1.03);
  return {
    viewBox: base.viewBox,
    paths: [tight, base.d, loose],
  };
}

/** Blob SVG geometry — paths from public/blobs/ with subtle scaled variants. */
export const SURVEY_BLOB_DEFS: Record<SurveyBlobId, SurveyBlobDef> = {
  blob1: buildBlobDef("blob1"),
  blob2: buildBlobDef("blob2"),
  blob3: buildBlobDef("blob3"),
  blob4: buildBlobDef("blob4"),
  blob5: buildBlobDef("blob5"),
};

/** Stable string hash — deterministic blob assignment per word. */
export function hashSurveyString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Same word always maps to the same blob shape. */
export function assignBlobId(word: string): SurveyBlobId {
  const index = hashSurveyString(word) % 5;
  return `blob${index + 1}` as SurveyBlobId;
}

// Per-word visual variation (applied before layout measure).
const SURVEY_BUBBLE_ROTATION_MIN = -8;
const SURVEY_BUBBLE_ROTATION_MAX = 8;
const SURVEY_MAX_BUBBLE_SCALE = 0.72;
// Base transform scale before length/hash jitter (keeps bubbles readable).
const SURVEY_WORD_SCALE_BASE = 0.82;
// Extra scale per character-length bucket (0–3 chars mod 4).
const SURVEY_WORD_SCALE_LENGTH_STEP = 0.05;
// Extra scale per hash bucket (0–6) for subtle per-word variation.
const SURVEY_WORD_SCALE_HASH_STEP = 0.01;

// Loose starting grid — one unique cell per word before runtime separation.
const SURVEY_INIT_GRID_COLS = 8;
const SURVEY_INIT_GRID_ROWS = 6;

const SURVEY_INIT_CELL_BY_WORD = new Map(
  [...SURVEY_WORDS]
    .sort((a, b) => {
      const ha = hashSurveyString(a.word);
      const hb = hashSurveyString(b.word);
      return ha === hb ? a.word.localeCompare(b.word) : ha - hb;
    })
    .map((entry, index) => [entry.word, index] as const),
);

function cellInitOffset(word: string, axis: "x" | "y"): number {
  const cellOffsetFrac =
    surveyLayoutOverrides.initCellOffsetFrac ?? SURVEY_INIT_CELL_OFFSET_FRAC;
  const h = hashSurveyString(`${word}|init${axis}`) % 10000;
  const r01 = h / 10000; // 0..1
  const centered = r01 - 0.5; // -0.5..0.5
  return centered * 2 * cellOffsetFrac;
}

/** Grid-seeded starting center (% of field) with hash jitter — separation pass refines from here. */
export function surveyInitialPosition(word: string): { left: number; top: number } {
  const cellIndex =
    SURVEY_INIT_CELL_BY_WORD.get(word) ??
    hashSurveyString(word) % (SURVEY_INIT_GRID_COLS * SURVEY_INIT_GRID_ROWS);
  const col = cellIndex % SURVEY_INIT_GRID_COLS;
  const row = Math.floor(cellIndex / SURVEY_INIT_GRID_COLS);

  const inset = surveyLayoutOverrides.fieldInsetFrac ?? SURVEY_FIELD_INSET_FRAC;
  const fieldW = 1 - 2 * inset;
  const fieldH = 1 - 2 * inset;
  const cellW = fieldW / SURVEY_INIT_GRID_COLS;
  const cellH = fieldH / SURVEY_INIT_GRID_ROWS;

  const baseLeft = inset + col * cellW + cellW / 2;
  const baseTop = inset + row * cellH + cellH / 2;
  const ox = cellInitOffset(word, "x") * cellW;
  const oy = cellInitOffset(word, "y") * cellH;

  return {
    left: (baseLeft + ox) * 100,
    top: (baseTop + oy) * 100,
  };
}

/** Deterministic per-word scale for organic size variation. */
export function surveyWordScale(word: string): number {
  const baseHash = hashSurveyString(word);
  const baseScale =
    SURVEY_WORD_SCALE_BASE +
    (word.length % 4) * SURVEY_WORD_SCALE_LENGTH_STEP +
    (baseHash % 7) * SURVEY_WORD_SCALE_HASH_STEP;
  return Math.min(baseScale, SURVEY_MAX_BUBBLE_SCALE);
}

/** Deterministic per-word rotation (deg). */
export function surveyWordRotation(word: string): number {
  const span = SURVEY_BUBBLE_ROTATION_MAX - SURVEY_BUBBLE_ROTATION_MIN;
  const step = hashSurveyString(`${word}|rot`) % (span + 1);
  return SURVEY_BUBBLE_ROTATION_MIN + step;
}

const SURVEY_BLOB_KEYFRAMES_ID = "survey-blob-keyframes";

function escapeCssPath(d: string): string {
  return d.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Inject per-blob `d` morph keyframes once (paths live in {@link SURVEY_BLOB_DEFS}). */
export function ensureSurveyBlobKeyframes(): void {
  if (document.getElementById(SURVEY_BLOB_KEYFRAMES_ID)) return;

  const rules = (
    Object.entries(SURVEY_BLOB_DEFS) as [SurveyBlobId, SurveyBlobDef][]
  )
    .map(([id, def]) => {
      const [tight, , loose] = def.paths;
      const tightPath = escapeCssPath(tight);
      const loosePath = escapeCssPath(loose);
      return `
@keyframes survey-blob-morph-${id} {
  0%, 100% { d: path("${tightPath}"); }
  50% { d: path("${loosePath}"); }
}
.survey-bubble__path--${id} {
  animation: survey-blob-morph-${id} 7s ease-in-out infinite;
}`;
    })
    .join("\n");

  const style = document.createElement("style");
  style.id = SURVEY_BLOB_KEYFRAMES_ID;
  style.textContent = rules;
  document.head.appendChild(style);
}
