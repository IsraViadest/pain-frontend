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
 * ROUND v3
 * SETTLED: v2-b profile and transition.
 * VARIES: physical-layer stipple size, using the existing single point draw.
 * - v3-control_current-points: current 2.52 CSS px centre dots at every camera distance.
 * - v3-a_larger-points: fixed 18 percent increase.
 * - v3-b_close-boost: current far size, rising to 18 percent larger at minimum zoom.
 * SELECTED BY CODEX: v3-a_larger-points. The control already stays fixed with zoom. The selected
 * size improves the normal camera as well as the close view; the close-only boost does not.
 *
 * ROUND v4
 * SETTLED: v3-a physical points and the selected profile structure.
 * VARIES: texture inside the temperature fill. The CO2 ring and every data scale stay fixed.
 * - v4-control_simple-environment: plain temperature fill.
 * - v4-a_environment-grain: sparse irregular flecks.
 * - v4-b_environment-cells: a fine hexagonal cell trace.
 * SELECTED BY CODEX: v4-b_environment-cells. It remains readable at 393 px, separates the
 * environmental glyph from the solid physical fill, and leaves the CO2 ring unobstructed.
 *
 * ROUND v5
 * SETTLED: v4-b profile glyph and v3-a physical points.
 * VARIES: texture-space alpha treatment on the existing Temperature and CO2 shells.
 * - v5-control_smooth-field: incumbent smooth fields.
 * - v5-a_grain-field: deterministic four-texel grain.
 * - v5-b_hex-field: restrained twelve-texel cell trace.
 * REJECTED BY CODEX: both textures fail at the far camera. Grain becomes square banding and the
 * hex trace reads as a separate shell. Retain them as the upper contrast bound for round v6.
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
  physicalPointScale?: number;
  physicalPointNearBoost?: number;
  environmentalGlyph?: "simple" | "grain" | "cells";
  environmentalFieldPattern?: "smooth" | "grain" | "hex";
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
  {
    id: "v3-control_current-points",
    label: "v3 control: current points",
    description: "The selected profile with the current fixed stipple size.",
    layout: QUIET_ROW.layout,
    transitionMs: 240,
  },
  {
    id: "v3-a_larger-points",
    label: "v3 A: larger points",
    description: "All physical stipple dots are 18 percent larger.",
    layout: QUIET_ROW.layout,
    transitionMs: 240,
    physicalPointScale: 1.18,
  },
  {
    id: "v3-b_close-boost",
    label: "v3 B: close boost",
    description: "Current far size, rising 18 percent toward minimum camera distance.",
    layout: QUIET_ROW.layout,
    transitionMs: 240,
    physicalPointNearBoost: 0.18,
  },
  {
    id: "v4-control_simple-environment",
    label: "v4 control: simple environment",
    description: "The selected base with a plain temperature fill.",
    layout: QUIET_ROW.layout,
    transitionMs: 240,
    physicalPointScale: 1.18,
    environmentalGlyph: "simple",
  },
  {
    id: "v4-a_environment-grain",
    label: "v4 A: environmental grain",
    description: "Sparse flecks texture the temperature fill without adding a value.",
    layout: QUIET_ROW.layout,
    transitionMs: 240,
    physicalPointScale: 1.18,
    environmentalGlyph: "grain",
  },
  {
    id: "v4-b_environment-cells",
    label: "v4 B: environmental cells",
    description: "A fine hexagonal trace textures the temperature fill.",
    layout: QUIET_ROW.layout,
    transitionMs: 240,
    physicalPointScale: 1.18,
    environmentalGlyph: "cells",
  },
  {
    id: "v5-control_smooth-field",
    label: "v5 control: smooth field",
    description: "The selected base with the incumbent smooth environmental shells.",
    layout: QUIET_ROW.layout,
    transitionMs: 240,
    physicalPointScale: 1.18,
    environmentalGlyph: "cells",
    environmentalFieldPattern: "smooth",
  },
  {
    id: "v5-a_grain-field",
    label: "v5 A: grain field",
    description: "Deterministic fine grain modulates both existing environmental shells.",
    layout: QUIET_ROW.layout,
    transitionMs: 240,
    physicalPointScale: 1.18,
    environmentalGlyph: "cells",
    environmentalFieldPattern: "grain",
  },
  {
    id: "v5-b_hex-field",
    label: "v5 B: hex field",
    description: "A restrained cell trace modulates both existing environmental shells.",
    layout: QUIET_ROW.layout,
    transitionMs: 240,
    physicalPointScale: 1.18,
    environmentalGlyph: "cells",
    environmentalFieldPattern: "hex",
  },
];

const DEFAULT_COUNTRY_PROFILE_PRESET_ID = "v4-b_environment-cells";

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
