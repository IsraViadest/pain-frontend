/**
 * CO2 haze intensity map (RGBA DataTexture) for a shell slightly outside the globe.
 * Stamps / blurs like {@link ./painHeatField.ts}; RGB is gray from tune.hazeColor, alpha carries intensity.
 */
import * as THREE from "three";
import type { PainPoint } from "../types/api";
import {
  painPointToFieldTexel,
  SCAR_MAP_HEIGHT,
  SCAR_MAP_WIDTH,
} from "./painScarField";

/** pain-server `category` value that feeds the CO2 haze shell. */
const CO2_HAZE_CATEGORY = "CO2";

/** Intensity→stamp size blend (not debug-tuned). */
const HAZE_STAMP_RADIUS_INTENSITY_FLOOR = 0.25;
const HAZE_STAMP_RADIUS_INTENSITY_WEIGHT = 0.75;

/** Quadratic peak: low intensities contribute much less (matches heat defaults). */
const HAZE_STAMP_PEAK_POWER = 2;
const HAZE_STAMP_PEAK_FLOOR = 0;

const BYTES_PER_RGBA_PIXEL = 4;
/** Treat maxHaze at or below this as an empty field (skip max / log scale). */
const HAZE_MAX_EPSILON = 1e-6;

/**
 * How smoothed texel values map to [0, 1] before `alphaThreshold` / `maxAlpha`.
 * Debug-panel Normalization select; default `"log"` compresses outliers.
 */
export type Co2HazeNormMode = "max" | "raw" | "log";

/**
 * CPU stamp / blur / alpha knobs for {@link createCo2HazeTexture}
 * (debug panel CO2 Haze section).
 */
export type Co2HazeTune = {
  /** Base stamp radius in texture pixels before intensity scaling. */
  stampRadiusBase: number;
  /** Extra stamp radius at full intensity (px). */
  stampRadiusSpan: number;
  /** First box-blur radius (px); 0 skips meaningful blur. */
  blurPass1Radius: number;
  /** Second box-blur radius (px). */
  blurPass2Radius: number;
  /** Cap on RGBA alpha byte (0–255) after normalize. */
  maxAlpha: number;
  /** Normalized intensity below this → alpha 0. */
  alphaThreshold: number;
  /** Field stretch before alpha mapping — see {@link Co2HazeNormMode}. */
  normMode: Co2HazeNormMode;
  /** Gray RGB byte (0–255) written to every texel; default 255 = #ffffff. */
  hazeColor: number;
  /** Base material opacity in {@link ../GlobeView.ts tick} before the sine breath. */
  hazeOpacity: number;
};

/** Tuned CO2 haze look (debug panel defaults). */
export const CO2_HAZE_TUNE_DEFAULTS: Co2HazeTune = {
  stampRadiusBase: 20,
  stampRadiusSpan: 11,
  blurPass1Radius: 3,
  blurPass2Radius: 1,
  maxAlpha: 255,
  alphaThreshold: 0,
  normMode: "log",
  hazeColor: 255,
  hazeOpacity: 1.0,
};

function boxBlurHaze(
  src: Float32Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const iy = y + dy;
        if (iy < 0 || iy >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const ix = x + dx;
          if (ix < 0 || ix >= width) continue;
          sum += src[iy * width + ix]!;
          count++;
        }
      }
      out[y * width + x] = sum / count;
    }
  }
  return out;
}

function makeHazeRgbaDataTexture(bytes: Uint8Array): THREE.DataTexture {
  const tex = new THREE.DataTexture(
    bytes as unknown as ArrayBufferView<ArrayBuffer>,
    SCAR_MAP_WIDTH,
    SCAR_MAP_HEIGHT,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  // SphereGeometry UVs: flip so north (row 0 in our equirect) matches the mesh map.
  tex.flipY = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Stamp peak from intensity: floor + (1 − floor) × intensity^power.
 * Visualization-only clamp — does not modify stored {@link PainPoint.intensity}.
 */
function hazeStampPeak(intensity: number): number {
  const clampedIntensity = THREE.MathUtils.clamp(intensity, 0, 1);
  return (
    HAZE_STAMP_PEAK_FLOOR +
    (1 - HAZE_STAMP_PEAK_FLOOR) * clampedIntensity ** HAZE_STAMP_PEAK_POWER
  );
}

/**
 * Map a smoothed haze texel to [0, 1] according to {@link Co2HazeNormMode}.
 * `max` stretches the peak to 1; `raw` leaves the accumulated value; `log`
 * uses log(1 + x) / log(1 + max) so outliers compress and mid values lift.
 */
function hazeNormalizedValue(
  value: number,
  maxHaze: number,
  normMode: Co2HazeNormMode,
): number {
  switch (normMode) {
    case "raw":
      return THREE.MathUtils.clamp(value, 0, 1);
    case "log": {
      if (maxHaze <= HAZE_MAX_EPSILON) return 0;
      return THREE.MathUtils.clamp(
        Math.log(1 + value) / Math.log(1 + maxHaze),
        0,
        1,
      );
    }
    case "max": {
      const scale = maxHaze > HAZE_MAX_EPSILON ? 1 / maxHaze : 1;
      return THREE.MathUtils.clamp(value * scale, 0, 1);
    }
  }
}

/** Keep only points whose `category` is `"CO2"`. */
export function filterCo2HazePoints(points: PainPoint[]): PainPoint[] {
  return points.filter((p) => p.category === CO2_HAZE_CATEGORY);
}

/**
 * Build an equirectangular RGBA haze map from CO2 points.
 * RGB is a uniform gray from {@link Co2HazeTune.hazeColor}; alpha comes from
 * {@link Co2HazeTune.normMode} then `alphaThreshold` / `maxAlpha` (0 = transparent).
 *
 * @param co2Points — already filtered to `category === "CO2"` (see {@link filterCo2HazePoints}).
 * @param tune — stamp / blur / alpha knobs (debug panel); defaults to {@link CO2_HAZE_TUNE_DEFAULTS}.
 */
export function createCo2HazeTexture(
  co2Points: PainPoint[],
  tune: Co2HazeTune = CO2_HAZE_TUNE_DEFAULTS,
): THREE.DataTexture {
  const hazeAcc = new Float32Array(SCAR_MAP_WIDTH * SCAR_MAP_HEIGHT);

  for (const p of co2Points) {
    const { cx, cy } = painPointToFieldTexel(p);
    // Rendering-only clamp — the stored PainPoint.intensity value is never modified; clamping only happens here at render time.
    const inten = THREE.MathUtils.clamp(p.intensity, 0, 1);
    const radiusPx = Math.round(
      tune.stampRadiusBase +
        tune.stampRadiusSpan *
          (HAZE_STAMP_RADIUS_INTENSITY_FLOOR +
            HAZE_STAMP_RADIUS_INTENSITY_WEIGHT * inten),
    );
    const peak = hazeStampPeak(inten);

    for (let dy = -radiusPx; dy <= radiusPx; dy++) {
      const iy = cy + dy;
      if (iy < 0 || iy >= SCAR_MAP_HEIGHT) continue;
      for (let dx = -radiusPx; dx <= radiusPx; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radiusPx) continue;
        let ix = cx + dx;
        ix = ((ix % SCAR_MAP_WIDTH) + SCAR_MAP_WIDTH) % SCAR_MAP_WIDTH;
        const idx = iy * SCAR_MAP_WIDTH + ix;
        const t = dist / radiusPx;
        const w = (1 - t) ** 2;
        hazeAcc[idx] = Math.min(1, hazeAcc[idx]! + peak * w);
      }
    }
  }

  let smoothed = boxBlurHaze(
    hazeAcc,
    SCAR_MAP_WIDTH,
    SCAR_MAP_HEIGHT,
    tune.blurPass1Radius,
  );
  smoothed = boxBlurHaze(
    smoothed,
    SCAR_MAP_WIDTH,
    SCAR_MAP_HEIGHT,
    tune.blurPass2Radius,
  );

  let maxHaze = 0;
  for (let i = 0; i < smoothed.length; i++) {
    maxHaze = Math.max(maxHaze, smoothed[i]!);
  }

  const bytes = new Uint8Array(
    SCAR_MAP_WIDTH * SCAR_MAP_HEIGHT * BYTES_PER_RGBA_PIXEL,
  );
  const rgb = THREE.MathUtils.clamp(Math.round(tune.hazeColor), 0, 255);
  for (let i = 0; i < smoothed.length; i++) {
    const normalized = hazeNormalizedValue(
      smoothed[i]!,
      maxHaze,
      tune.normMode,
    );
    const alpha =
      normalized < tune.alphaThreshold
        ? 0
        : Math.round(normalized * tune.maxAlpha);
    const o = i * BYTES_PER_RGBA_PIXEL;
    bytes[o] = rgb;
    bytes[o + 1] = rgb;
    bytes[o + 2] = rgb;
    bytes[o + 3] = alpha;
  }

  return makeHazeRgbaDataTexture(bytes);
}
