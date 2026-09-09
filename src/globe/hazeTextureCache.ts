/** created by: Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach */
import type { DataTexture } from "three";
import type { PainPoint } from "../types/api";
import type { FieldTexturePattern } from "./fieldTexturePattern";

type HazeTune = Record<string, number | string>;
type Entry = {
  points: Float64Array;
  tune: HazeTune;
  pattern: FieldTexturePattern;
  texture: DataTexture;
};

// The fourth scalar distinguishes null coordinates from every numeric value.
const POINT_SCALARS = 4;
const coordinateNulls = (point: PainPoint): number =>
  Number(point.lat === null) | (Number(point.lng === null) << 1);

/** Owns one field texture; active materials borrow it until replacement or disposal. */
export class HazeTextureCache {
  private entry: Entry | null = null;

  getTexture(
    points: readonly PainPoint[],
    tune: HazeTune,
    pattern: FieldTexturePattern,
    build: () => DataTexture,
  ): DataTexture | null {
    // Hiding a layer must not evict the field reused when that layer returns.
    if (points.length === 0) return null;
    const entry = this.entry;
    const keys = Object.keys(tune);
    if (entry && entry.pattern === pattern &&
        keys.length === Object.keys(entry.tune).length &&
        keys.every((key) => Object.is(tune[key], entry.tune[key])) &&
        entry.points.length === points.length * POINT_SCALARS &&
        points.every((point, i) => {
          const offset = i * POINT_SCALARS;
          return Object.is(entry.points[offset], point.lat ?? 0) &&
            Object.is(entry.points[offset + 1], point.lng ?? 0) &&
            Object.is(entry.points[offset + 2], point.intensity) &&
            entry.points[offset + 3] === coordinateNulls(point);
        })) return entry.texture;

    // Release before allocating: even replacement retains only one generation.
    this.dispose();
    const signature = new Float64Array(points.length * POINT_SCALARS);
    points.forEach((point, i) => {
      const offset = i * POINT_SCALARS;
      signature[offset] = point.lat ?? 0;
      signature[offset + 1] = point.lng ?? 0;
      signature[offset + 2] = point.intensity;
      signature[offset + 3] = coordinateNulls(point);
    });
    const texture = build();
    this.entry = { points: signature, tune: { ...tune }, pattern, texture };
    return texture;
  }

  /** Active texture bytes belong to the baseline; count retained inactive CPU/GPU bytes. */
  additionalStorageBytes(active: DataTexture | null): number {
    if (!this.entry) return 0;
    return this.entry.points.byteLength + (this.entry.texture === active ? 0 :
      this.entry.texture.image.data.byteLength * 2);
  }

  dispose(): void {
    this.entry?.texture.dispose();
    this.entry = null;
  }
}
