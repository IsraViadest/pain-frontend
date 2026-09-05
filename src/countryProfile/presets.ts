/**
 * Country-profile opening round v1.
 *
 * The one-change rule is suspended for this opening round because the card has no incumbent design.
 * Every candidate uses the same data, type, colour, placement, and proportional-area contract.
 * Only the structural composition changes.
 *
 * SETTLED
 * - English country name, thin divider, native emotional term plus English.
 * - Environmental, physical, and socioeconomic signals use distinct production blob silhouettes.
 * - No visible numbers; missingness and source counts remain accessible.
 * - Desktop bottom centre; mobile above bottom chrome; body remains pointer-transparent.
 *
 * VARIES
 * - v1-control_literal-row: direct equal-column reading of the brief.
 * - v1-a_quiet-row: wider emotional anchor and a lighter, gently stepped row.
 * - v1-b_constellation: signals orbit a centred emotional word.
 * - v1-c_typographic-anchor: emotional type owns the left; three glyphs form a compact right rail.
 *
 * SELECTED BY CODEX
 * - v1-a_quiet-row. It gives the emotional term the strongest hierarchy, keeps all three glyphs
 *   legible in both themes, and collapses cleanly to the shared mobile row.
 *
 * TRAPS
 * - The constellation's absolute positions collide with globe labels as the camera changes.
 * - A bottom offset of 104 px left a 2 px box overlap with the desktop bottom-left controls.
 *
 * ROUND v2
 * SETTLED: v1-a_quiet-row structure and the 110 px desktop chrome clearance.
 * VARIES: total cubic indicator transition time at 0, 160, 240, or 360 ms.
 * SELECTED BY CODEX: v2-b_fade-240. It gives twelve frames to each half at 100 Hz or faster and
 * remains visibly quick after the globe's synchronous rebuild.
 * TRAP: starting the CSS fade before either synchronous globe rebuild consumes the transition
 * while the main thread is blocked. `main.ts` starts it after `loadPoints()` resolves.
 *
 * Run: http://127.0.0.1:5173/?cp=1&cpPreset=<id>
 */

type CountryProfileLayout =
  | "literal-row"
  | "quiet-row"
  | "constellation"
  | "typographic-anchor";

export interface CountryProfilePreset {
  id: string;
  label: string;
  description: string;
  layout: CountryProfileLayout;
  /** Total indicator fade-out plus fade-in time. Omitted means the v1 instant switch. */
  transitionMs?: number;
}

const V1_PRESETS: readonly CountryProfilePreset[] = [
  {
    id: "v1-control_literal-row",
    label: "v1 control: literal row",
    description: "Four equal positions, directly following the written brief.",
    layout: "literal-row",
  },
  {
    id: "v1-a_quiet-row",
    label: "v1 A: quiet row",
    description: "A wider emotional phrase followed by three lightly stepped glyphs.",
    layout: "quiet-row",
  },
  {
    id: "v1-b_constellation",
    label: "v1 B: constellation",
    description: "The emotional phrase is central and the three signals orbit it.",
    layout: "constellation",
  },
  {
    id: "v1-c_typographic-anchor",
    label: "v1 C: typographic anchor",
    description: "Large emotional type at left with a compact three-glyph rail.",
    layout: "typographic-anchor",
  },
];

const QUIET_ROW = V1_PRESETS.find((preset) => preset.id === "v1-a_quiet-row")!;
const COUNTRY_PROFILE_PRESETS: readonly CountryProfilePreset[] = [
  ...V1_PRESETS,
  {
    id: "v2-control_instant",
    label: "v2 control: instant",
    description: "The selected quiet row with the v1 instant layer switch.",
    layout: QUIET_ROW.layout,
    transitionMs: 0,
  },
  {
    id: "v2-a_fade-160",
    label: "v2 A: fade 160 ms",
    description: "An 80 ms fade out and 80 ms fade in.",
    layout: QUIET_ROW.layout,
    transitionMs: 160,
  },
  {
    id: "v2-b_fade-240",
    label: "v2 B: fade 240 ms",
    description: "A 120 ms fade out and 120 ms fade in.",
    layout: QUIET_ROW.layout,
    transitionMs: 240,
  },
  {
    id: "v2-c_fade-360",
    label: "v2 C: fade 360 ms",
    description: "A 180 ms fade out and 180 ms fade in.",
    layout: QUIET_ROW.layout,
    transitionMs: 360,
  },
];

const DEFAULT_COUNTRY_PROFILE_PRESET_ID = "v2-b_fade-240";

/** Resolve `cpPreset`, falling back to the opening-round control. */
export function resolveCountryProfilePreset(): CountryProfilePreset {
  const requested = new URLSearchParams(window.location.search).get("cpPreset");
  const preset = COUNTRY_PROFILE_PRESETS.find((candidate) => candidate.id === requested);
  if (requested && !preset) {
    console.warn(`[countryProfile] Unknown cpPreset: ${requested}`);
  }
  return (
    preset ??
    COUNTRY_PROFILE_PRESETS.find(
      (candidate) => candidate.id === DEFAULT_COUNTRY_PROFILE_PRESET_ID,
    )!
  );
}
