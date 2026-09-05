/**
 * Heat intensity map (DataTexture) — not a visible shell.
 * Tints land stipple dots in scar mode (earthStippleGlobe fragment shader).
 */
import * as THREE from "three";
import type { PainPoint } from "../types/api";
import {
  painPointToFieldTexel,
  SCAR_MAP_HEIGHT,
  SCAR_MAP_WIDTH,
} from "./painScarField";

function boxBlurHeat(
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

function makeHeatDataTexture(bytes: Uint8Array): THREE.DataTexture {
  const tex = new THREE.DataTexture(
    bytes as unknown as ArrayBufferView<ArrayBuffer>,
    SCAR_MAP_WIDTH,
    SCAR_MAP_HEIGHT,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

/** Stamp peak curve for {@link createPainHeatTexture} (debug panel Heat map section). */
export type HeatMapBuildParams = {
  /** Exponent on clamped intensity; 2 = quadratic (low values contribute much less). */
  peakPower: number;
  /** Minimum stamp peak at intensity 0; blends up to 1.0 at intensity 1. */
  peakFloor: number;
  /**
   * Stamp radius in texels: `base + span * (0.25 + 0.75 * intensity)`.
   * Omit to keep the default heat-map stamps (10 + 28 × …).
   */
  stampRadiusBase?: number;
  stampRadiusSpan?: number;
  /** Box-blur radii in texels (two passes). Omit for default 5 then 3; 0 skips a pass. */
  blurPass1Radius?: number;
  blurPass2Radius?: number;
};

const DEFAULT_HEAT_MAP_BUILD: HeatMapBuildParams = {
  peakPower: 2,
  peakFloor: 0,
};

const DEFAULT_STAMP_RADIUS_BASE = 10;
const DEFAULT_STAMP_RADIUS_SPAN = 28;
const DEFAULT_BLUR_PASS_1 = 5;
const DEFAULT_BLUR_PASS_2 = 3;

/**
 * Stamp peak from intensity: floor + (1 − floor) × intensity^power.
 * At floor 0, power 2 → intensity² (quadratic contrast).
 */
function heatStampPeak(
  intensity: number,
  { peakPower, peakFloor }: HeatMapBuildParams,
): number {
  // Clamp for visualization only — stored intensity unchanged (Pattern 19)
  const clampedIntensity = THREE.MathUtils.clamp(intensity, 0, 1);
  return (
    peakFloor + (1 - peakFloor) * clampedIntensity ** peakPower
  );
}

/**
 * Accumulated pain intensity (0–1) per texel; wider stamps + blur than scar dents.
 * Sample on land stipple for a heat-map tint (cool → hot).
 */
export function createPainHeatTexture(
  points: PainPoint[],
  buildParams: HeatMapBuildParams = DEFAULT_HEAT_MAP_BUILD,
): THREE.DataTexture {
  const stampRadiusBase =
    buildParams.stampRadiusBase ?? DEFAULT_STAMP_RADIUS_BASE;
  const stampRadiusSpan =
    buildParams.stampRadiusSpan ?? DEFAULT_STAMP_RADIUS_SPAN;
  const blurPass1Radius = buildParams.blurPass1Radius ?? DEFAULT_BLUR_PASS_1;
  const blurPass2Radius = buildParams.blurPass2Radius ?? DEFAULT_BLUR_PASS_2;

  const heatAcc = new Float32Array(SCAR_MAP_WIDTH * SCAR_MAP_HEIGHT);

  for (const p of points) {
    const texel = painPointToFieldTexel(p);
    if (!texel) continue;
    const { cx, cy } = texel;
    // Rendering-only clamp: does not modify PainPoint.intensity (Pattern 19 — adapter stores API value as-is).
    const inten = THREE.MathUtils.clamp(p.intensity, 0, 1);
    const radiusPx = Math.round(
      stampRadiusBase + stampRadiusSpan * (0.25 + 0.75 * inten),
    );
    const peak = heatStampPeak(inten, buildParams);

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
        heatAcc[idx] = Math.min(1, heatAcc[idx]! + peak * w);
      }
    }
  }

  // Explicit Float32Array: heatAcc is ArrayBuffer-backed; blur returns ArrayBufferLike under TS 5.7+.
  let smoothed: Float32Array = heatAcc;
  if (blurPass1Radius > 0) {
    smoothed = boxBlurHeat(
      smoothed,
      SCAR_MAP_WIDTH,
      SCAR_MAP_HEIGHT,
      blurPass1Radius,
    );
  }
  if (blurPass2Radius > 0) {
    smoothed = boxBlurHeat(
      smoothed,
      SCAR_MAP_WIDTH,
      SCAR_MAP_HEIGHT,
      blurPass2Radius,
    );
  }

  let maxHeat = 0;
  for (let i = 0; i < smoothed.length; i++) {
    maxHeat = Math.max(maxHeat, smoothed[i]!);
  }
  const bytes = new Uint8Array(SCAR_MAP_WIDTH * SCAR_MAP_HEIGHT);
  for (let i = 0; i < smoothed.length; i++) {
    bytes[i] = Math.round(
      THREE.MathUtils.clamp(smoothed[i]!, 0, 1) * 255,
    );
  }

  const tex = makeHeatDataTexture(bytes);
  if (maxHeat > 1e-6) {
    console.info("[heat map] built", {
      pointCount: points.length,
      maxHeat: Number(maxHeat.toFixed(4)),
      hotTexels: bytes.filter((b) => b > 64).length,
    });
  }
  return tex;
}

/** Neutral heat (0) when overlay is off. */
export function createNeutralHeatTexture(): THREE.DataTexture {
  return makeHeatDataTexture(
    new Uint8Array(SCAR_MAP_WIDTH * SCAR_MAP_HEIGHT),
  );
}
