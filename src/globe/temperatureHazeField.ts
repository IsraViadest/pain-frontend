/**
 * Temperature haze intensity map (RGBA DataTexture) for a shell slightly outside the globe.
 * Stamps / blurs like {@link ./co2HazeField.ts}; RGB is fixed red (#ff0000), alpha carries intensity.
 */
import * as THREE from "three";
import type { PainPoint } from "../types/api";
import {
  painPointToFieldTexel,
  SCAR_MAP_HEIGHT,
  SCAR_MAP_WIDTH,
} from "./painScarField";

/** pain-server `category` value that feeds the temperature haze shell. */
const TEMPERATURE_HAZE_CATEGORY = "Temperature";

/** Hardcoded haze RGB (#ff0000). */
const HAZE_RED_BYTE = 0xff;
const HAZE_GREEN_BYTE = 0x00;
const HAZE_BLUE_BYTE = 0x00;

/** Intensity→stamp size blend (not debug-tuned). */
const HAZE_STAMP_RADIUS_INTENSITY_FLOOR = 0.25;
const HAZE_STAMP_RADIUS_INTENSITY_WEIGHT = 0.75;

/** Quadratic peak: low intensities contribute much less (matches heat defaults). */
const HAZE_STAMP_PEAK_POWER = 2;
const HAZE_STAMP_PEAK_FLOOR = 0;

const BYTES_PER_RGBA_PIXEL = 4;
/** Skip max-normalize when the field is effectively empty. */
const HAZE_MAX_EPSILON = 1e-6;

/**
 * CPU stamp / blur / alpha knobs for {@link createTemperatureHazeTexture}.
 * Stamp / blur are driven from GlobeView TempHeatTune; alpha caps use defaults.
 */
type TemperatureHazeTune = {
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
};

/** Defaults align with debug-panel Temperature Heat stamp/blur defaults. */
export const TEMPERATURE_HAZE_TUNE_DEFAULTS: TemperatureHazeTune = {
  stampRadiusBase: 3,
  stampRadiusSpan: 5,
  blurPass1Radius: 2,
  blurPass2Radius: 1,
  maxAlpha: 115,
  alphaThreshold: 0.03,
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
          // Equirect wrap on X so blur matches stamp wrap at the antimeridian.
          const ix = ((x + dx) % width + width) % width;
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
  tex.wrapS = THREE.RepeatWrapping;
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

/** Keep only points whose `category` is `"Temperature"`. */
export function filterTemperatureHazePoints(points: PainPoint[]): PainPoint[] {
  return points.filter((p) => p.category === TEMPERATURE_HAZE_CATEGORY);
}

/**
 * Build an equirectangular RGBA haze map from Temperature points.
 * RGB is fixed red (#ff0000); alpha is max-normalized intensity (0 = transparent).
 *
 * @param temperaturePoints — already filtered (see {@link filterTemperatureHazePoints}).
 * @param tune — stamp / blur / alpha knobs; defaults to {@link TEMPERATURE_HAZE_TUNE_DEFAULTS}.
 */
export function createTemperatureHazeTexture(
  temperaturePoints: PainPoint[],
  tune: TemperatureHazeTune = TEMPERATURE_HAZE_TUNE_DEFAULTS,
): THREE.DataTexture {
  const hazeAcc = new Float32Array(SCAR_MAP_WIDTH * SCAR_MAP_HEIGHT);

  for (const p of temperaturePoints) {
    const texel = painPointToFieldTexel(p);
    if (!texel) continue;
    const { cx, cy } = texel;
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
  const norm = maxHaze > HAZE_MAX_EPSILON ? 1 / maxHaze : 1;

  const bytes = new Uint8Array(
    SCAR_MAP_WIDTH * SCAR_MAP_HEIGHT * BYTES_PER_RGBA_PIXEL,
  );
  for (let i = 0; i < smoothed.length; i++) {
    const normalized = THREE.MathUtils.clamp(smoothed[i]! * norm, 0, 1);
    const alpha =
      normalized < tune.alphaThreshold
        ? 0
        : Math.round(normalized * tune.maxAlpha);
    const o = i * BYTES_PER_RGBA_PIXEL;
    bytes[o] = HAZE_RED_BYTE;
    bytes[o + 1] = HAZE_GREEN_BYTE;
    bytes[o + 2] = HAZE_BLUE_BYTE;
    bytes[o + 3] = alpha;
  }

  return makeHazeRgbaDataTexture(bytes);
}
