/**
 * Where a label and its arcs sit above the globe.
 *
 * This lives in its own module because the labels and the arcs have to agree. They ride the same
 * camera-distance ramp and the same per-category shell, and two private copies of one curve is
 * exactly how they would drift apart: before this existed the arcs rode a fixed radius while the
 * labels descended on approach, so the two crossed over each other as the camera came in.
 */
import type { EmoData } from "./emoData";
import type { EmoViewParams } from "./viewParams";

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (v: number): number => v * v * (3 - 2 * v);

/** 0 at `from`, 1 at `to`, eased. Works whether `from` is above or below `to`. */
export const ramp = (value: number, from: number, to: number): number =>
  smoothstep(clamp01((value - from) / (to - from || 1)));

/** 0 when the camera is at the far stop, 1 when it is at the near stop. */
export function emoZoomRamp(cameraDistance: number, params: EmoViewParams): number {
  return ramp(cameraDistance, params.cameraFar, params.cameraNear);
}

/** Radius the base shell's labels ride at, for a point on that ramp. */
export function emoLabelStandoff(near: number, params: EmoViewParams): number {
  return params.standoffFar + (params.standoffNear - params.standoffFar) * near;
}

/**
 * Radius the base shell's arcs ride at.
 *
 * Expressed as the arc's share of the label's height above the surface rather than as a fixed
 * radius, so the arc keeps its place under the text at every zoom instead of rising through it.
 * `arcLift` therefore still means exactly what it says at the far end of the ramp.
 */
export function emoArcRadius(near: number, params: EmoViewParams): number {
  const share = (params.arcLift - 1) / (params.standoffFar - 1 || 1);
  return 1 + (emoLabelStandoff(near, params) - 1) * share;
}

/**
 * Shell index of each pain category: its position in the dataset's own order, which is the
 * 01 to 14 category numbering. Deliberately not a semantic ordering; that is a later round's
 * question, and a number nobody chose is easier to argue with than one somebody did.
 */
export function emoCategoryShells(data: EmoData): Map<string, number> {
  return new Map(data.categories.map((c, i) => [c.key, i]));
}
