/**
 * Every tunable of the emotional-pain label views, in one object.
 *
 * A named preset is a partial override of these defaults (see viewPresets.ts). Presets are
 * append-only: once shipped, a preset's values are never edited, so an older design stays
 * reachable for comparison. Adjust behaviour by adding a preset, not by changing these numbers.
 */
export interface EmoViewParams {
  /** Which language a label shows. `focal` renders English near the camera axis, native elsewhere. */
  labelMode: "english" | "native" | "bilingual" | "focal";
  /** Which English string to use: the short category label, or the gloss of the native term. */
  englishText: "category" | "gloss";
  /** What a click does. The two behaviours compete for the same target, so a preset picks one. */
  clickMode: "off" | "toggleLanguage" | "selectNetwork";

  /** Label standoff above the globe surface (globe radius = 1) when the camera is far / near. */
  standoffFar: number;
  standoffNear: number;
  /** Camera distances mapped to the far / near ends of the standoff and size ramps. */
  cameraFar: number;
  cameraNear: number;
  /** Label size in CSS pixels at the far / near ends of the ramp. */
  fontPxFar: number;
  fontPxNear: number;
  /** Second line size, as a fraction of the first, in bilingual mode. */
  secondLineScale: number;

  /** Hide a label once its direction faces this far away from the camera. */
  facingMin: number;
  /** Facing values at which a label reaches full / zero opacity. */
  fadeStart: number;
  /** How grey a label goes at the limb, 0 keeps full colour. */
  edgeDesaturation: number;

  /** Half-angle in degrees of the focal cone used by `labelMode: "focal"`. */
  focalConeDeg: number;
  /** Width of the blend band at the cone edge, in degrees. */
  focalBlendDeg: number;

  /** Whether the within-category arcs are drawn: never, always, or for the clicked country. */
  networkMode: "off" | "all" | "selected";
  /** How many nearest same-category neighbours each country links to. Edges are deduplicated. */
  kNeighbours: number;
  /** Radius the arcs ride at. Below the label standoff, or arcs cross through the text. */
  arcLift: number;
  /** Degrees of arc removed at each end, so a line stops short of the label it points at. */
  arcEndTrimDeg: number;
  /** Arc width in world units, so it is a fraction of the globe radius rather than pixels. */
  arcWidth: number;
  arcOpacity: number;
  /** Opacity multiplier applied to every label except the selected one. */
  selectionDim: number;
  /** Alpha of the wash filling the selected country. */
  selectionFill: number;

  /** White is the default; colour is opt-in because the families do not carry clean meaning. */
  colourMode: "white" | "family" | "category";
  /** Global cap on visible labels, lowest score dropped first. 0 means no cap. */
  density: number;
}

export const DEFAULT_EMO_PARAMS: EmoViewParams = {
  labelMode: "english",
  englishText: "category",
  clickMode: "off",

  // Matches the incumbent word cloud's 1.11 standoff at the far end, and descends toward the
  // surface as the camera approaches so labels read as belonging to their country.
  standoffFar: 1.11,
  standoffNear: 1.015,
  cameraFar: 2.8,
  cameraNear: 1.4,
  fontPxFar: 13,
  fontPxNear: 9,
  secondLineScale: 0.72,

  facingMin: 0.05,
  fadeStart: 0.28,
  edgeDesaturation: 0.55,

  focalConeDeg: 26,
  focalBlendDeg: 12,

  networkMode: "off",
  kNeighbours: 3,
  // Just under the far standoff of 1.11, so arcs pass beneath the labels rather than through
  // them. They do not follow the zoom ramp, so they separate from the labels on approach; that
  // is a composition question for the multiplex phase, not a defect here.
  arcLift: 1.06,
  arcEndTrimDeg: 1.5,
  arcWidth: 0.0025,
  arcOpacity: 0.55,
  selectionDim: 0.25,
  selectionFill: 0.18,

  colourMode: "white",
  density: 0,
};

/**
 * The permitted values of every enum-valued parameter.
 *
 * One source of truth for two consumers that would otherwise drift: the URL reader validates
 * hand-typed values against it, and the view panel builds its dropdowns from it. An unvalidated
 * enum is worth guarding because an unrecognised labelMode falls through every branch of the
 * renderer's switch and silently hides all 195 labels.
 */
export const EMO_ENUM_VALUES: { [K in EmoEnumKey]: readonly EmoViewParams[K][] } = {
  labelMode: ["english", "native", "bilingual", "focal"],
  englishText: ["category", "gloss"],
  clickMode: ["off", "toggleLanguage", "selectNetwork"],
  networkMode: ["off", "all", "selected"],
  colourMode: ["white", "family", "category"],
};

/** The parameters whose value is one of a fixed set of strings. */
export type EmoEnumKey = {
  [K in keyof EmoViewParams]: EmoViewParams[K] extends string ? K : never;
}[keyof EmoViewParams];

/** The parameters that a slider can drive. */
export type EmoNumberKey = {
  [K in keyof EmoViewParams]: EmoViewParams[K] extends number ? K : never;
}[keyof EmoViewParams];

/**
 * The fields in which `to` differs from `from`.
 *
 * Used twice, against two different baselines. Against a preset's resolved parameters it gives
 * the shortest URL that reproduces the current view; against DEFAULT_EMO_PARAMS it gives exactly
 * the `params` object literal for a new entry in the append-only preset registry.
 */
export function diffEmoParams(
  from: EmoViewParams,
  to: EmoViewParams,
): Partial<EmoViewParams> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(to) as (keyof EmoViewParams)[]) {
    if (from[key] !== to[key]) out[key] = to[key];
  }
  return out as Partial<EmoViewParams>;
}
