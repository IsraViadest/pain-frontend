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

  colourMode: "white",
  density: 0,
};
