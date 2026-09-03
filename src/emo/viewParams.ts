import type { EmoCategoryGraph, EmoWorldGraph } from "./graphs";

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
  /**
   * What a bilingual label does when both of its lines carry the same word.
   *
   * 32 of the 195 countries are in that position: 29 whose primary language is English, plus the
   * 3 lexicon gaps that fall back to it. `one` draws the native line alone rather than printing
   * "Grief" above "Grief". It frees no room, measured; it just stops the label saying it twice.
   */
  identicalLines: "both" | "one";
  /**
   * What a click does. These compete for the same target, so a preset picks one.
   * `reshuffleNetwork` redraws a random world network with the next seed.
   */
  clickMode: "off" | "toggleLanguage" | "selectNetwork" | "reshuffleNetwork";

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
  /**
   * Extra transparency with distance from the viewer, on top of the limb fade above.
   *
   * `fadeStart` only acts in the last stretch before a label is culled, so labels stay at full
   * strength across most of the disc and the ones receding toward the horizon compete on equal
   * terms with the ones facing the camera. This is a plain ramp across the whole hemisphere
   * instead: at the centre a label keeps full opacity, and at the horizon it keeps 1 minus this.
   * 0 is the behaviour of every preset that predates it.
   */
  labelDepthFade: number;
  /**
   * Halo width as a fraction of the font size, replacing the directional drop shadow.
   *
   * The shipped `text-shadow: 0 1px 3px` darkens below a glyph and leaves its top edge
   * unprotected, which is weakest over the bright choropleth. Above 0 this becomes a symmetric
   * surround at this fraction of the current font size. 0 keeps the drop shadow, so every preset
   * that predates it is unchanged.
   */
  labelHalo: number;

  /** Half-angle in degrees of the focal cone used by `labelMode: "focal"`. */
  focalConeDeg: number;
  /** Width of the blend band at the cone edge, in degrees. */
  focalBlendDeg: number;

  /**
   * Which arcs are drawn. `all` and `selected` link countries sharing a pain category.
   * `connected` links the whole world by proximity while nothing is clicked, and switches to the
   * clicked country's category network once something is.
   */
  networkMode: "off" | "all" | "selected" | "connected";
  /**
   * How the classifier-agnostic world network is built. `mst`, `rng`, `gabriel` and `delaunay`
   * are guaranteed not to cross themselves; `knn` and `random` are not. See graphs.ts.
   */
  worldGraph: EmoWorldGraph;
  /**
   * How countries inside one pain category are joined. `complete` links all of them to all;
   * `gabriel` and `delaunay` are the same non-crossing rules the world graph offers, computed
   * over that category's own points.
   */
  categoryGraph: EmoCategoryGraph;
  /** How many nearest neighbours each country links to, for the two kNN-based rules. */
  kNeighbours: number;
  /** Seed for `worldGraph: "random"`, so a random network is still reproducible. */
  randomSeed: number;
  /**
   * Radius the arcs ride at when the camera is at the far stop. They follow the same zoom ramp
   * as the labels from there, keeping their share of the height above the surface, so keeping
   * this below `standoffFar` keeps the arcs under the text at every zoom. See layout.ts.
   */
  arcLift: number;
  /** Degrees of arc removed at each end, so a line stops short of the label it points at. */
  arcEndTrimDeg: number;
  /** Arc width in world units, so it is a fraction of the globe radius rather than pixels. */
  arcWidth: number;
  arcOpacity: number;
  /**
   * A hairline from each country up to its own label, so a word floating over a crowded region
   * is visibly attached to the country it names. Takes `arcWidth` and `arcOpacity` scaled by the
   * two `leader*Scale` values below.
   */
  leaderLines: "off" | "on";
  /**
   * Radius the leader line starts at, in globe radii.
   *
   * In all-layers mode the pain scars dent the surface inward, by up to about 0.08 of a radius
   * where a country is deeply marked, and a foot sitting just above the undented sphere then
   * leaves a visible gap between the line and the land it points at. A foot below the deepest
   * dent closes that gap at every depth, because the globe writes depth before these lines draw
   * and clips whatever falls inside it. The line therefore runs to the country's centre through
   * the surface, and only the part outside the surface is ever seen.
   */
  leaderFoot: number;
  /**
   * Leader width and opacity as fractions of the network's own, so the two read as different
   * kinds of line rather than as one line of two lengths. 1 makes them identical, which is how
   * every preset that predates these behaved.
   */
  leaderWidthScale: number;
  leaderOpacityScale: number;
  /** Opacity multiplier applied to every label except the selected one. */
  selectionDim: number;
  /** Alpha of the wash filling the countries of the selected pain category. */
  selectionFill: number;
  /**
   * Width of the outline drawn round those countries, in texels of the 2048 by 1024 highlight
   * map, which is about 1.7 screen pixels each at the gallery camera. 0 draws no outline, so a
   * preset chooses a wash, a thickened border, or both.
   */
  selectionOutline: number;
  /**
   * How the highlight sits on the country's own colour. `wash` lays white over it, which is what
   * shipped. `glow` adds a warm light to it instead, so the country's existing choropleth colour
   * brightens rather than being covered.
   */
  selectionStyle: "wash" | "glow";
  /**
   * How a selection is made legible. `dim` steps every other label back, which is what shipped.
   * `bold` leaves them alone and enlarges the selected category's labels instead. `both` does
   * each.
   *
   * The 19 Noto subsets ship at weight 400 only, so a weight above that is synthesised for the
   * non-Latin scripts. That is already true of the 600 every label uses, and unlike synthetic
   * oblique, which is why decision 6 bans italic, emboldening does not break Arabic joining or
   * Indic conjuncts. The size step is what carries most of the emphasis regardless.
   */
  selectionEmphasis: "dim" | "bold" | "both";
  /**
   * Radial separation between consecutive pain-category shells, in globe radii. Labels and arcs
   * both take it, so each category gains its own layer. 0 puts everything on one shell, which is
   * how every preset shipped before this behaved.
   */
  multiplexSpread: number;

  /**
   * White is the default; colour is opt-in because the families do not carry clean meaning.
   * `violet` is the near-white ramp: fourteen tints of one violet-to-pink band, separable side
   * by side and reading as white from a distance.
   */
  colourMode: "white" | "family" | "category" | "violet";
  /** Global cap on visible labels, lowest score dropped first. 0 means no cap. */
  density: number;
  /**
   * `priority` hides a label whose screen box collides with a stronger-scoring one. Labels are
   * never moved: no production globe library repositions them, because a label that slides on
   * every frame of a rotation reads as jitter rather than as placement.
   */
  declutterMode: "off" | "priority";
  /**
   * Minimum clear space required between two label boxes, in CSS pixels. Negative lets them
   * overlap by that much, which keeps more labels on screen at the cost of some collision.
   */
  declutterPad: number;
}

export const DEFAULT_EMO_PARAMS: EmoViewParams = {
  labelMode: "english",
  englishText: "category",
  // Off by default, so every preset that predates it renders exactly as it did.
  identicalLines: "both",
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
  // Both off, so every preset that predates them renders exactly as it did.
  labelDepthFade: 0,
  labelHalo: 0,

  focalConeDeg: 26,
  focalBlendDeg: 12,

  networkMode: "off",
  worldGraph: "knn",
  categoryGraph: "knn",
  kNeighbours: 3,
  // The workspace default seed, so a random network is the same one every reload.
  randomSeed: 43,
  // Just under the far standoff of 1.11, so arcs pass beneath the labels rather than through
  // them, and they hold that share of the height all the way in.
  arcLift: 1.06,
  arcEndTrimDeg: 1.5,
  arcWidth: 0.0025,
  arcOpacity: 0.55,
  // Off by default, so every preset that predates them renders exactly as it did.
  leaderLines: "off",
  // Just clear of the choropleth at 1.001 and the selection wash at 1.0025. Above every dent,
  // which is the behaviour every preset before this shipped with.
  leaderFoot: 1.004,
  // 1 and 1: the leader is exactly the network's line, as it was.
  leaderWidthScale: 1,
  leaderOpacityScale: 1,
  selectionDim: 0.25,
  selectionFill: 0.18,
  // All three keep the behaviour that shipped: a white wash, no outline, and dimming the rest.
  selectionOutline: 0,
  selectionStyle: "wash",
  selectionEmphasis: "dim",
  // Flat by default, so the 16 presets that predate the shells are unchanged.
  multiplexSpread: 0,

  colourMode: "white",
  density: 0,
  // Off by default so every preset shipped before this existed renders exactly as it did.
  declutterMode: "off",
  // Two labels whose boxes touch read as one word, so the default asks for a visible gap.
  declutterPad: 4,
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
  identicalLines: ["both", "one"],
  clickMode: ["off", "toggleLanguage", "selectNetwork", "reshuffleNetwork"],
  networkMode: ["off", "all", "selected", "connected"],
  worldGraph: ["knn", "mst", "rng", "gabriel", "delaunay", "random"],
  categoryGraph: ["knn", "complete", "gabriel", "delaunay"],
  leaderLines: ["off", "on"],
  selectionStyle: ["wash", "glow"],
  selectionEmphasis: ["dim", "bold", "both"],
  colourMode: ["white", "family", "category", "violet"],
  declutterMode: ["off", "priority"],
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
