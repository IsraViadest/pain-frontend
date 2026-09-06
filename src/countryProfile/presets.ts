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
 * ROUND v6
 * SETTLED: the smooth control and both rejected v5 upper bounds.
 * VARIES: texture frequency and contrast.
 * - v6-control_smooth-field: incumbent smooth fields.
 * - v6-a_fine-grain-field: two-texel grain with one third of v5's contrast.
 * - v6-b_fine-hex-field: four-texel cells with one third of v5's contrast.
 * SELECTED BY CODEX: v6-control_smooth-field. The fine candidates are only discernible in a
 * side-by-side close crop; enough contrast to read at rest reproduces the v5 defects.
 *
 * FINAL ADOPTION v7
 * - v7-a_base consolidates the selected profile, transition, physical points, profile glyph,
 *   and smooth environmental globe without changing their values.
 *
 * STRUCTURAL RE-OPEN v8: compare the current row with three compact four-slot sizes.
 * SELECTED: medium, 460 px desktop / 296 px phone. Small gives less room to the glyphs; large
 * adds width without improving the hierarchy. All real native terms fit at 320 and 393 px.
 * Rounds v9-v11 isolate inset, plate opacity, then the secondary type treatment.
 * SELECTED: inset 0.88, plate 0.36, native 0.72 with tiny desktop English. The higher inset
 * reduces the outline breathing room; a darker plate adds weight. Keep translation context.
 *
 * ROUND v12: original shoulder, tapered shoulder, refined geometry, and their combination.
 * SELECTED: soft surface. Border subdivision and denser shared geometry improve close contours;
 * taper closes the hard support edge. Isolated blurred peaks change by 1-2 byte levels.
 * Frame cadence stays 8.3 ms median / 9.0 ms p95 in the paired desktop trace; this is not GPU time.
 *
 * ROUNDS v19-v24
 * - v19 measures regular spacing between painted edges against one lowercase n.
 * - v20 centers English beneath the right-aligned native emotional term.
 * - v21 adds the broad profile edge glow.
 * - v22 preserves the camera radius during country-cycle travel.
 * - v23 hides the destination during travel and reveals the profile with network construction.
 * - v24 compares 10, 14, and 18 second dwell pacing. Selected: balanced at 14 seconds.
 *
 * Run: http://127.0.0.1:5173/?cp=1&cpPreset=<id>
 */

type CountryProfileLayout =
  | "literal-row"
  | "quiet-row"
  | "constellation"
  | "typographic-anchor"
  | "compact";

export interface CountryProfilePreset {
  id: string;
  label: string;
  description: string;
  layout: CountryProfileLayout;
  /** The operator's expressive-globe refinement; omitted preserves the v1-v7 treatment. */
  refinement?: boolean;
  compactSize?: "small" | "medium" | "large";
  glyphInset?: number;
  plateOpacity?: number;
  emotionalCaption?: "quiet" | "none";
  nativeOpacity?: number;
  roundedScarShoulder?: boolean;
  scarDepthStyle?: "none" | "hillshade" | "contour-land" | "contour-all" | "hybrid";
  surfaceDetail?: 1 | 2;
  countryContourDegrees?: number;
  selectionPeerStrength?: number;
  /** Total indicator fade-out plus fade-in time. Omitted means the v1 instant switch. */
  transitionMs?: number;
  physicalPointScale?: number;
  physicalDetail?: "fixed" | "regrow" | "split1" | "split2" | "uniform";
  stippleAllLayers?: boolean;
  stipplePointCount?: 82_000 | 164_000;
  atmosphereMode?: "control" | "flat" | "mantle" | "cloudlets" | "volume" |
    "volume-strong" | "volume-separated" | "volume-strong-separated";
  atmosphereSamples?: 16 | 32 | 48;
  atmosphereFraction?: number;
  environmentalContextOpacity?: number;
  socioeconomicStyle?: "color" | "hatch" | "woven";
  socioeconomicContextOpacity?: number;
  socioeconomicPatternContrast?: number;
  socioeconomicMissingStyle?: "diagonal" | "cross";
  quality?: boolean;
  chromeOcclusion?: boolean;
  physicalPointNearBoost?: number;
  environmentalGlyph?: "simple" | "grain" | "cells";
  environmentalFieldPattern?:
    | "smooth"
    | "grain"
    | "hex"
    | "fine-grain"
    | "fine-hex";
  profileSpacing?: "slots" | "painted-n";
  centerEnglishTerm?: boolean;
  profileGlow?: "none" | "wide";
  profileReveal?: "none" | "soft";
  profileOrder?: "country-first" | "indicators-first";
  profileHardOutline?: boolean;
  sharePainLabel?: string;
  sharePainLooseLines?: boolean;
  generatedLegendOrientation?: "responsive" | "vertical";
  emotionalLegendHalo?: boolean;
  cycle?: {
    preserveZoom?: boolean;
    revealWithNetwork?: boolean;
    previewDuringFlight?: boolean;
    prepareMs?: number;
    flightMs?: number;
    dwellMs?: number;
    motionScale?: number;
  };
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
const COMPACT_BASE: Omit<CountryProfilePreset, "id" | "label" | "description"> = {
  layout: "compact",
  refinement: true,
  compactSize: "medium",
  glyphInset: 0.88,
  plateOpacity: 0.36,
  transitionMs: 240,
  physicalPointScale: 1.18,
  environmentalFieldPattern: "smooth",
};
/** Frozen Phase 16 composition for the next comparison; later rounds add their own values. */
const V17_BASE: Omit<CountryProfilePreset, "id" | "label" | "description"> = {
  ...COMPACT_BASE, surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.5,
  physicalPointScale: 1, physicalDetail: "split1", atmosphereMode: "volume", atmosphereSamples: 16,
  environmentalContextOpacity: 0.25,
};
const V19_BASE: Omit<CountryProfilePreset, "id" | "label" | "description"> = {
  ...V17_BASE, socioeconomicStyle: "hatch", socioeconomicContextOpacity: 0.25,
  socioeconomicPatternContrast: 0.1, quality: true, chromeOcclusion: true,
};
const V19_TIGHT = { ...V19_BASE, profileSpacing: "painted-n" } as const;
const V20_CENTERED = { ...V19_TIGHT, centerEnglishTerm: true } as const;
const V21_GLOW = { ...V20_CENTERED, profileGlow: "wide" } as const;
const V22_ROTATION = { ...V21_GLOW, cycle: { preserveZoom: true } } as const;
const V23_REVEAL = {
  ...V21_GLOW,
  profileReveal: "soft",
  cycle: { preserveZoom: true, previewDuringFlight: false, revealWithNetwork: true },
} as const;

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
    description: "Physical land stipple dots are 18 percent larger.",
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
  {
    id: "v6-control_smooth-field",
    label: "v6 control: smooth field",
    description: "The selected base with the incumbent smooth environmental shells.",
    layout: QUIET_ROW.layout,
    transitionMs: 240,
    physicalPointScale: 1.18,
    environmentalGlyph: "cells",
    environmentalFieldPattern: "smooth",
  },
  {
    id: "v6-a_fine-grain-field",
    label: "v6 A: fine grain field",
    description: "Fine low-contrast grain modulates both environmental shells.",
    layout: QUIET_ROW.layout,
    transitionMs: 240,
    physicalPointScale: 1.18,
    environmentalGlyph: "cells",
    environmentalFieldPattern: "fine-grain",
  },
  {
    id: "v6-b_fine-hex-field",
    label: "v6 B: fine hex field",
    description: "Fine low-contrast cells modulate both environmental shells.",
    layout: QUIET_ROW.layout,
    transitionMs: 240,
    physicalPointScale: 1.18,
    environmentalGlyph: "cells",
    environmentalFieldPattern: "fine-hex",
  },
  {
    id: "v7-a_base",
    label: "v7 A: adopted base",
    description: "The consolidated selected country pain profile treatment.",
    layout: QUIET_ROW.layout,
    transitionMs: 240,
    physicalPointScale: 1.18,
    environmentalGlyph: "cells",
    environmentalFieldPattern: "smooth",
  },
  {
    id: "v8-control_current-profile",
    label: "v8 control: current profile",
    description: "The v7 profile beneath the refined cycle and survey controls.",
    layout: QUIET_ROW.layout,
    refinement: true,
    transitionMs: 240,
    physicalPointScale: 1.18,
    environmentalGlyph: "cells",
    environmentalFieldPattern: "smooth",
  },
  ...(["small", "medium", "large"] as const).map((compactSize, index) => ({
    ...COMPACT_BASE,
    id: `v8-${"abc"[index]}_compact-${compactSize}`,
    label: `v8 ${"ABC"[index]}: compact ${compactSize}`,
    description: "Four equal slots, restrained type, and compact patterned indicators.",
    compactSize,
  })),
  ...([0.88, 0.84, 0.92] as const).map((glyphInset, index) => ({
    ...COMPACT_BASE,
    id: `v9-${["control", "a", "b"][index]}_inset-${Math.round(glyphInset * 100)}`,
    label: `v9: inset ${glyphInset}`,
    description: "Maximum fill scale; proportional area stays unchanged.",
    glyphInset,
  })),
  ...([0.36, 0.24, 0.48] as const).map((plateOpacity, index) => ({
    ...COMPACT_BASE,
    id: `v10-${["control", "a", "b"][index]}_plate-${Math.round(plateOpacity * 100)}`,
    label: `v10: plate ${plateOpacity}`,
    description: "Only the translucent profile background changes.",
    plateOpacity,
  })),
  {
    ...COMPACT_BASE, id: "v11-control_quiet-translation", label: "v11: quiet translation",
    description: "Muted native type and a tiny secondary translation on desktop.",
  },
  {
    ...COMPACT_BASE, id: "v11-a_native-only", label: "v11: native only",
    description: "Remove the desktop translation; phone treatment stays native-only.",
    emotionalCaption: "none",
  },
  {
    ...COMPACT_BASE, id: "v11-b_softer-native", label: "v11: softer native",
    description: "Native opacity is 0.60 instead of 0.72; translation is unchanged.",
    nativeOpacity: 0.60,
  },
  {
    ...COMPACT_BASE, id: "v11-c_compact-base", label: "v11: adopted compact base",
    description: "Medium compact profile, inset fills, and quiet desktop translation.",
  },
  {
    ...COMPACT_BASE, id: "v12-control_scar-original", label: "v12: original scar shoulders",
    description: "Compact base with corrected sampling and the original scar shoulder.",
  },
  {
    ...COMPACT_BASE, id: "v12-a_scar-rounded", label: "v12: rounded scar shoulders",
    description: "A smooth taper closes each scar shoulder without changing its center or support.",
    roundedScarShoulder: true,
  },
  {
    ...COMPACT_BASE, id: "v12-b_surface-refined", label: "v12: refined surface sampling",
    description: "Denser shared surface and border samples at the original scar profile.",
    surfaceDetail: 2,
  },
  {
    ...COMPACT_BASE, id: "v12-c_soft-surface", label: "v12: soft sampled surface",
    description: "Rounded shoulders added to the refined shared surface.",
    surfaceDetail: 2,
    roundedScarShoulder: true,
  },
  {
    ...COMPACT_BASE, id: "v13-control_shared-contours", label: "v13: shared straight contours",
    description: "One source boundary for borders, country fills, highlights, and stipple land.",
    surfaceDetail: 2, roundedScarShoulder: true, countryContourDegrees: 0,
  },
  {
    ...COMPACT_BASE, id: "v13-a_gentle-contours", label: "v13: gentle contour rounding",
    description: "Small shared corner fillets, constrained by close-view picking accuracy.",
    surfaceDetail: 2, roundedScarShoulder: true, countryContourDegrees: 0.0025,
  },
  {
    ...COMPACT_BASE, id: "v13-b_rounded-contours", label: "v13: stronger contour rounding",
    description: "Twice the gentle fillet, using the same fixed display shape at every zoom.",
    surfaceDetail: 2, roundedScarShoulder: true, countryContourDegrees: 0.005,
  },
  {
    ...COMPACT_BASE, id: "v14-control_equal-peers", label: "v14: equal country highlights",
    description: "Full-strength category marks and exact-country marks in the three other views.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 1,
  },
  {
    ...COMPACT_BASE, id: "v14-a_half-peers", label: "v14: half-strength peer countries",
    description: "Origin stays fully lit; reached peers use half the fill and border strength.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.5,
  },
  {
    ...COMPACT_BASE, id: "v14-b_stronger-peers", label: "v14: 65-percent peer countries",
    description: "A gentler origin/peer distinction, without changing lines, labels, or timing.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.65,
  },
  {
    ...COMPACT_BASE, id: "v15-control_original-dots", label: "v15: original stipple size",
    description: "The original 82,000 points and original screen diameter, with the adopted profile.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.5,
    physicalPointScale: 1, physicalDetail: "fixed",
  },
  {
    ...COMPACT_BASE, id: "v15-a_dot-regrowth", label: "v15: stipple regrowth",
    description: "Dots grow where their local projected spacing permits, with no added samples.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.5,
    physicalPointScale: 1, physicalDetail: "regrow",
  },
  {
    ...COMPACT_BASE, id: "v15-b_four-child-dots", label: "v15: four-child stipple",
    description: "A readable parent resolves into four smaller geographically anchored samples.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.5,
    physicalPointScale: 1, physicalDetail: "split1",
  },
  {
    ...COMPACT_BASE, id: "v15-c_two-level-dots", label: "v15: two-level stipple",
    description: "A second split where projected room permits, within the same bounded child pool.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.5,
    physicalPointScale: 1, physicalDetail: "split2",
  },
  {
    ...COMPACT_BASE, id: "v16-control_flat-palette", label: "v16: coral and green flat fields",
    description: "The new environmental palette on flat shells, before adding atmospheric depth.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.5,
    physicalPointScale: 1, physicalDetail: "split1", atmosphereMode: "flat",
  },
  {
    ...COMPACT_BASE, id: "v16-a_atmospheric-mantle", label: "v16: atmospheric mantle",
    description: "Shallow lit relief gives the existing coral and green fields a sculpted surface.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.5,
    physicalPointScale: 1, physicalDetail: "split1", atmosphereMode: "mantle",
  },
  {
    ...COMPACT_BASE, id: "v16-b_cloudlets", label: "v16: soft cloudlets",
    description: "Bounded soft clusters with geographic anchors and separate coral/green layers.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.5,
    physicalPointScale: 1, physicalDetail: "split1", atmosphereMode: "cloudlets",
  },
  {
    ...COMPACT_BASE, id: "v16-c_volume-32", label: "v16: airy volume, 32 samples",
    description: "A bounded volume uses the actual globe depth and the same horizontal signals.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.5,
    physicalPointScale: 1, physicalDetail: "split1", atmosphereMode: "volume", atmosphereSamples: 32,
  },
  {
    ...COMPACT_BASE, id: "v16-d_volume-16", label: "v16: airy volume, 16 samples",
    description: "Half the ray samples, at the same target resolution, fields, and palette.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.5,
    physicalPointScale: 1, physicalDetail: "split1", atmosphereMode: "volume", atmosphereSamples: 16,
  },
  {
    ...COMPACT_BASE, id: "v16-e_volume-48", label: "v16: airy volume, 48 samples",
    description: "More ray samples, at the same target resolution, fields, and palette.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.5,
    physicalPointScale: 1, physicalDetail: "split1", atmosphereMode: "volume", atmosphereSamples: 48,
  },
  {
    ...COMPACT_BASE, id: "v16-f_mantle-air", label: "v16: mantle over quieter context",
    description: "Environmental-only context dots step back so the atmospheric fields read clearly.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.5,
    physicalPointScale: 1, physicalDetail: "split1", atmosphereMode: "mantle",
    environmentalContextOpacity: 0.25,
  },
  {
    ...COMPACT_BASE, id: "v16-g_volume-air", label: "v16: volume over quieter context",
    description: "The 32-sample volume with the same quieter environmental context.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.5,
    physicalPointScale: 1, physicalDetail: "split1", atmosphereMode: "volume", atmosphereSamples: 32,
    environmentalContextOpacity: 0.25,
  },
  {
    ...COMPACT_BASE, id: "v16-h_cloudlet-air", label: "v16: cloudlets over quieter context",
    description: "Soft environmental clusters with the same quieter context dots.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.5,
    physicalPointScale: 1, physicalDetail: "split1", atmosphereMode: "cloudlets",
    environmentalContextOpacity: 0.25,
  },
  {
    ...COMPACT_BASE, id: "v16-i_volume-air-16", label: "v16: quiet air, 16 samples",
    description: "The quieter volume with the lowest tested ray-sample count.",
    surfaceDetail: 2, roundedScarShoulder: true, selectionPeerStrength: 0.5,
    physicalPointScale: 1, physicalDetail: "split1", atmosphereMode: "volume", atmosphereSamples: 16,
    environmentalContextOpacity: 0.25,
  },
  {
    ...V17_BASE, id: "v17-control_original-yellow", label: "v17: original yellow scale",
    description: "The selected air and stipple with the original zero-alpha socioeconomic minimum.",
  },
  {
    ...V17_BASE, id: "v17-a_visible-minimum", label: "v17: visible yellow minimum",
    description: "Japan's previous yellow alpha sets the new minimum, with a linear source mapping.",
    socioeconomicStyle: "color",
  },
  {
    ...V17_BASE, id: "v17-b_fine-hatching", label: "v17: fine geographic hatching",
    description: "Hatch coverage repeats the same value, fading to mean color below visible detail.",
    socioeconomicStyle: "hatch",
  },
  {
    ...V17_BASE, id: "v17-c_woven-texture", label: "v17: quiet woven texture",
    description: "Two crossing stripe families share the same source value and average color.",
    socioeconomicStyle: "woven",
  },
  {
    ...V17_BASE, id: "v17-d_color-quiet", label: "v17: color over quieter context",
    description: "The visible minimum with geographic context dots at quarter opacity.",
    socioeconomicStyle: "color", socioeconomicContextOpacity: 0.25,
  },
  {
    ...V17_BASE, id: "v17-e_hatch-quiet", label: "v17: hatching over quieter context",
    description: "Fine socioeconomic hatching with geographic context dots at quarter opacity.",
    socioeconomicStyle: "hatch", socioeconomicContextOpacity: 0.25,
  },
  {
    ...V17_BASE, id: "v17-f_woven-quiet", label: "v17: weave over quieter context",
    description: "Woven socioeconomic texture with geographic context dots at quarter opacity.",
    socioeconomicStyle: "woven", socioeconomicContextOpacity: 0.25,
  },
  {
    ...V17_BASE, id: "v17-g_soft-hatching", label: "v17: softer hatching",
    description: "Lower hatch contrast keeps the visible texture restrained at close range.",
    socioeconomicStyle: "hatch", socioeconomicContextOpacity: 0.25,
    socioeconomicPatternContrast: 0.1,
  },
  {
    ...V17_BASE, id: "v18-a_composed", label: "v18: composed globe with bounded quality",
    description: "The selected treatments with automatic detail and explicit quality overrides.",
    socioeconomicStyle: "hatch", socioeconomicContextOpacity: 0.25,
    socioeconomicPatternContrast: 0.1, quality: true,
  },
  {
    ...V17_BASE, id: "v18-b_clear-chrome", label: "v18: readable foreground chrome",
    description: "Globe words fade behind the controls and country card at their existing size.",
    socioeconomicStyle: "hatch", socioeconomicContextOpacity: 0.25,
    socioeconomicPatternContrast: 0.1, quality: true, chromeOcclusion: true,
  },
  {
    ...V19_BASE, id: "v19-control_composed", label: "v19 control: equal slots",
    description: "The selected v18 composition with its equal four-column profile row.",
  },
  {
    ...V19_TIGHT, id: "v19-a_painted-n-spacing", label: "v19: painted n spacing",
    description: "Adjacent painted indicator edges are separated by one rendered lowercase n.",
  },
  {
    ...V19_TIGHT, id: "v20-control_tight-spacing", label: "v20 control: tight spacing",
    description: "The selected painted-edge spacing with the translation still right-aligned.",
  },
  {
    ...V20_CENTERED, id: "v20-a_centered-translation", label: "v20: centered translation",
    description: "English centers beneath the right-aligned native emotional term.",
  },
  {
    ...V20_CENTERED, id: "v21-control_plain-profile", label: "v21 control: plain profile edge",
    description: "The selected compact row with the incumbent translucent profile plate.",
  },
  {
    ...V21_GLOW, id: "v21-a_wide-profile-glow", label: "v21: wide profile glow",
    description: "A broad low-alpha edge glow fades outward from the translucent plate.",
  },
  {
    ...V21_GLOW, id: "v22-control_existing-flight", label: "v22 control: existing flight",
    description: "The new profile treatment with the existing camera radius change.",
  },
  {
    ...V22_ROTATION, id: "v22-a_rotation-only", label: "v22: rotation-only flight",
    description: "Country-cycle travel rotates at the current camera radius without zooming.",
  },
  {
    ...V22_ROTATION, id: "v23-control_heading-after-flight", label: "v23 control: delayed profile",
    description: "Rotation-only travel with the existing heading and post-network reveal order.",
  },
  {
    ...V23_REVEAL, id: "v23-a_network-profile-reveal", label: "v23: network and profile together",
    description: "Travel shows no country; network and a soft profile reveal begin together.",
  },
  {
    ...V23_REVEAL, id: "v24-control_current-pace", label: "v24 control: current pace",
    description: "The selected sequence at the existing 30-second dwell and 2.5-second flight.",
  },
  {
    ...V23_REVEAL, id: "v24-a_brisk-cycle", label: "v24: brisk cycle",
    description: "A 10-second dwell, 1.2-second flight, and 0.3-second empty beat.",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 300, flightMs: 1200, dwellMs: 10000,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v24-b_balanced-cycle", label: "v24: balanced cycle",
    description: "A 14-second dwell, 1.5-second flight, and 0.4-second empty beat.",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 14000,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v24-c_calm-cycle", label: "v24: calm cycle",
    description: "An 18-second dwell, 1.8-second flight, and 0.5-second empty beat.",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 500, flightMs: 1800, dwellMs: 18000,
      motionScale: 1.25 },
  },
  {
    ...V23_REVEAL, id: "v25-a_quicker-dwell", label: "v25: 25 percent shorter dwell",
    description: "The selected cycle with country dwell reduced from 14 to 10.5 seconds.",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v26-a_indicators-first", label: "v26: indicators above country",
    description: "The four pain indicators sit above the divider and country name.",
    profileOrder: "indicators-first",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v27-a_soft-halo", label: "v27: soft halo only",
    description: "The broad profile halo remains without the hard one-pixel outline.",
    profileOrder: "indicators-first",
    profileHardOutline: false,
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v28-a_share-and-locate", label: "v28: share and locate",
    description: "The action reads share and locate your pain with looser line spacing.",
    profileOrder: "indicators-first",
    profileHardOutline: false,
    sharePainLabel: "share and locate\nyour pain",
    sharePainLooseLines: true,
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v29-a_vertical-legends", label: "v29: vertical value legends",
    description: "Environmental and socioeconomic scales use a narrow vertical footprint.",
    profileOrder: "indicators-first",
    profileHardOutline: false,
    sharePainLabel: "share and locate\nyour pain",
    sharePainLooseLines: true,
    generatedLegendOrientation: "vertical",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v30-a_legend-halo", label: "v30: quiet legend halo",
    description: "The desktop emotional legend gains a restrained dark text halo.",
    profileOrder: "indicators-first",
    profileHardOutline: false,
    sharePainLabel: "share and locate\nyour pain",
    sharePainLooseLines: true,
    generatedLegendOrientation: "vertical",
    emotionalLegendHalo: true,
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v31-a_missing-diagonal", label: "v31: diagonal missing data",
    description: "Socioeconomic regions without data use a neutral rising diagonal hatch.",
    profileOrder: "indicators-first",
    profileHardOutline: false,
    sharePainLabel: "share and locate\nyour pain",
    sharePainLooseLines: true,
    generatedLegendOrientation: "vertical",
    emotionalLegendHalo: true,
    socioeconomicMissingStyle: "diagonal",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v31-b_missing-cross", label: "v31: crosshatched missing data",
    description: "Socioeconomic regions without data use a neutral gray crosshatch.",
    profileOrder: "indicators-first",
    profileHardOutline: false,
    sharePainLabel: "share and locate\nyour pain",
    sharePainLooseLines: true,
    generatedLegendOrientation: "vertical",
    emotionalLegendHalo: true,
    socioeconomicMissingStyle: "cross",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v32-a_consistent-dots", label: "v32: consistent larger dots",
    description: "Original uniform dots regrow without splitting and use the same tuning on every layer.",
    profileOrder: "indicators-first",
    profileHardOutline: false,
    sharePainLabel: "share and locate\nyour pain",
    sharePainLooseLines: true,
    generatedLegendOrientation: "vertical",
    emotionalLegendHalo: true,
    socioeconomicMissingStyle: "diagonal",
    physicalDetail: "regrow",
    physicalPointScale: 1.18,
    stippleAllLayers: true,
    stipplePointCount: 82_000,
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v32-b_uniform-double-density", label: "v32: uniform double density",
    description: "All dots resolve into one uniform 164,000-point field on approach.",
    profileOrder: "indicators-first",
    profileHardOutline: false,
    sharePainLabel: "share and locate\nyour pain",
    sharePainLooseLines: true,
    generatedLegendOrientation: "vertical",
    emotionalLegendHalo: true,
    socioeconomicMissingStyle: "diagonal",
    physicalDetail: "uniform",
    physicalPointScale: 1.18,
    stippleAllLayers: true,
    stipplePointCount: 164_000,
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v33-control_soft-scars", label: "v33 control: soft scars",
    description: "The selected unsplit dots with existing unshaded scar displacement.",
    profileOrder: "indicators-first", profileHardOutline: false,
    sharePainLabel: "share and locate\nyour pain", sharePainLooseLines: true,
    generatedLegendOrientation: "vertical", emotionalLegendHalo: true,
    socioeconomicMissingStyle: "diagonal", physicalDetail: "regrow",
    physicalPointScale: 1.18, stippleAllLayers: true, stipplePointCount: 82_000,
    scarDepthStyle: "none",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v33-a_hillshade", label: "v33: scar hillshade",
    description: "Directional local shading reveals the slopes of scar hills and valleys.",
    profileOrder: "indicators-first", profileHardOutline: false,
    sharePainLabel: "share and locate\nyour pain", sharePainLooseLines: true,
    generatedLegendOrientation: "vertical", emotionalLegendHalo: true,
    socioeconomicMissingStyle: "diagonal", physicalDetail: "regrow",
    physicalPointScale: 1.18, stippleAllLayers: true, stipplePointCount: 82_000,
    scarDepthStyle: "hillshade",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v33-b_contours-land", label: "v33: land scar contours",
    description: "Thin equal-displacement bands appear only on land.",
    profileOrder: "indicators-first", profileHardOutline: false,
    sharePainLabel: "share and locate\nyour pain", sharePainLooseLines: true,
    generatedLegendOrientation: "vertical", emotionalLegendHalo: true,
    socioeconomicMissingStyle: "diagonal", physicalDetail: "regrow",
    physicalPointScale: 1.18, stippleAllLayers: true, stipplePointCount: 82_000,
    scarDepthStyle: "contour-land",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v33-c_contours-ocean", label: "v33: land and ocean contours",
    description: "Equal-displacement bands continue across the shared ocean surface.",
    profileOrder: "indicators-first", profileHardOutline: false,
    sharePainLabel: "share and locate\nyour pain", sharePainLooseLines: true,
    generatedLegendOrientation: "vertical", emotionalLegendHalo: true,
    socioeconomicMissingStyle: "diagonal", physicalDetail: "regrow",
    physicalPointScale: 1.18, stippleAllLayers: true, stipplePointCount: 82_000,
    scarDepthStyle: "contour-all",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v33-d_hybrid-relief", label: "v33: restrained hybrid relief",
    description: "Softer hillshade and land contours reinforce the same scar displacement.",
    profileOrder: "indicators-first", profileHardOutline: false,
    sharePainLabel: "share and locate\nyour pain", sharePainLooseLines: true,
    generatedLegendOrientation: "vertical", emotionalLegendHalo: true,
    socioeconomicMissingStyle: "diagonal", physicalDetail: "regrow",
    physicalPointScale: 1.18, stippleAllLayers: true, stipplePointCount: 82_000,
    scarDepthStyle: "hybrid",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v34-control_current-air", label: "v34 control: current air",
    description: "The selected scar treatment with the incumbent mixed translucent volume.",
    profileOrder: "indicators-first", profileHardOutline: false,
    sharePainLabel: "share and locate\nyour pain", sharePainLooseLines: true,
    generatedLegendOrientation: "vertical", emotionalLegendHalo: true,
    socioeconomicMissingStyle: "diagonal", physicalDetail: "regrow",
    physicalPointScale: 1.18, stippleAllLayers: true, stipplePointCount: 82_000,
    scarDepthStyle: "hillshade", atmosphereMode: "volume",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v34-a_stronger-air", label: "v34: stronger air",
    description: "Temperature and CO2 gain a higher-opacity response in their existing volume.",
    profileOrder: "indicators-first", profileHardOutline: false,
    sharePainLabel: "share and locate\nyour pain", sharePainLooseLines: true,
    generatedLegendOrientation: "vertical", emotionalLegendHalo: true,
    socioeconomicMissingStyle: "diagonal", physicalDetail: "regrow",
    physicalPointScale: 1.18, stippleAllLayers: true, stipplePointCount: 82_000,
    scarDepthStyle: "hillshade", atmosphereMode: "volume-strong",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v34-b_separated-air", label: "v34: separated air layers",
    description: "Temperature stays close to Earth while CO2 occupies a higher band.",
    profileOrder: "indicators-first", profileHardOutline: false,
    sharePainLabel: "share and locate\nyour pain", sharePainLooseLines: true,
    generatedLegendOrientation: "vertical", emotionalLegendHalo: true,
    socioeconomicMissingStyle: "diagonal", physicalDetail: "regrow",
    physicalPointScale: 1.18, stippleAllLayers: true, stipplePointCount: 82_000,
    scarDepthStyle: "hillshade", atmosphereMode: "volume-separated",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
  {
    ...V23_REVEAL, id: "v34-c_strong-separated-air", label: "v34: strong separated air",
    description: "The stronger volume uses a lower Temperature band and a higher CO2 band.",
    profileOrder: "indicators-first", profileHardOutline: false,
    sharePainLabel: "share and locate\nyour pain", sharePainLooseLines: true,
    generatedLegendOrientation: "vertical", emotionalLegendHalo: true,
    socioeconomicMissingStyle: "diagonal", physicalDetail: "regrow",
    physicalPointScale: 1.18, stippleAllLayers: true, stipplePointCount: 82_000,
    scarDepthStyle: "hillshade", atmosphereMode: "volume-strong-separated",
    cycle: { ...V23_REVEAL.cycle, prepareMs: 400, flightMs: 1500, dwellMs: 10500,
      motionScale: 1 },
  },
];

const DEFAULT_COUNTRY_PROFILE_PRESET_ID = "v34-c_strong-separated-air";

/** Resolve `cpPreset`, falling back to the adopted preset. */
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
