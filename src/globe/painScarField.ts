/**
 * Scar height map (DataTexture) — not a visible shell.
 * Fed into stipple vertex shader + CPU border warp; optional globe CPU warp when visible.
 * Built by GlobeView.scheduleScarFieldRebuild() from API pain points.
 */
import * as THREE from "three";
import {
  DUMMY_PAIN_TEXTURE_HEIGHT,
  DUMMY_PAIN_TEXTURE_WIDTH,
  PPP_TEXTURE_PIXEL_Y_OFFSET,
} from "../api/coordinates";
import type { PainPoint } from "../types/api";
import { unitDirectionToGlobeEquirectUV } from "./globeEquirectUV";
import { latLngToVector3 } from "./latLng";
import { isDebugScarVisual } from "./debugScarVisual";

/** Same grid as DummyPain / pain-server x,y (aligns with coast + stipple lat/lng). */
export const SCAR_MAP_WIDTH = DUMMY_PAIN_TEXTURE_WIDTH;
export const SCAR_MAP_HEIGHT = DUMMY_PAIN_TEXTURE_HEIGHT;
/** Flat surface in the scar height map (byte 0–255). 128 = neutral with displacement bias. */
const SCAR_NEUTRAL_DEPTH = 128;
const SCAR_MIN_DEPTH = 0;

/** DummyPain grid / lat-lng → scar & heat map texel (shared frame). */
export function painPointToFieldTexel(p: PainPoint): { cx: number; cy: number } {
  const maxCol = SCAR_MAP_WIDTH - 1;
  const maxRow = SCAR_MAP_HEIGHT - 1;
  const tx = p.scarMapTexelX;
  const ty = p.scarMapTexelY;
  if (typeof tx === "number" && typeof ty === "number") {
    return {
      cx: Math.round(THREE.MathUtils.clamp(tx, 0, maxCol)),
      cy: Math.round(
        THREE.MathUtils.clamp(
          ty + PPP_TEXTURE_PIXEL_Y_OFFSET,
          0,
          maxRow,
        ),
      ),
    };
  }
  const { u, v } = unitDirectionToGlobeEquirectUV(
    latLngToVector3(p.lat, p.lng, 1),
  );
  return {
    cx: Math.floor(((u % 1) + 1) % 1 * maxCol),
    cy: Math.floor(THREE.MathUtils.clamp(v, 0, 1) * maxRow),
  };
}

function makeRedDataTexture(bytes: Uint8Array): THREE.DataTexture {
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

type ScarMapBuildStats = {
  layerId: string;
  pointCount: number;
  pointsConsidered: number;
};

/** CPU-side knobs for stamping + blurring before the scar DataTexture uploads to GPU. */
type ScarHeightMapBuildParams = {
  /** Floor on stamp radius in texture pixels (after intensity-based size). */
  stampRadiusMin: number;
  /** Scales footprint; large values merge sites and flatten detail. */
  stampRadiusMul: number;
  /** Scales dent depth in the texture (GPU scar displacement scale still applies). */
  stampPeakMul: number;
  /** Gaussian shoulder `exp(-t² × σ)`; higher = tighter, more peaked bumps. */
  falloffSigma: number;
  /** Box-blur radius in pixels after stamps; 0 skips. Larger = smoother field. */
  blurPass1Radius: number;
  blurPass2Radius: number;
};

const DEFAULT_SCAR_HEIGHT_MAP_BUILD: ScarHeightMapBuildParams = {
  stampRadiusMin: 5,
  stampRadiusMul: 1,
  stampPeakMul: 1,
  falloffSigma: 2.75,
  blurPass1Radius: 3,
  blurPass2Radius: 2,
};

/**
 * Box blur on float scar depth (neutral = {@link SCAR_NEUTRAL_DEPTH}).
 * Smooths the height field so coastlines / stipple follow broad dents instead of pixel spikes.
 */
function boxBlurScarDepth(
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

/**
 * Scar height map from pain lat/lng. Same field warps stipple (GPU) and coastlines (CPU).
 *
 * Stamps are intentionally **wider and smoother** than the earliest scar build: tiny
 * high-frequency dents read as jagged “spikes” when the same field warps long polylines.
 * Broader Gaussian-ish falloff + light blur → dents that flow like lines drawn on a curved surface.
 * Live tuning passes `Partial<ScarHeightMapBuildParams>` from the globe debug sliders.
 */
export function createPainScarDisplacementTexture(
  points: PainPoint[],
  layerId = "unknown",
  buildOverrides: Partial<ScarHeightMapBuildParams> = {},
): THREE.DataTexture {
  const cfg: ScarHeightMapBuildParams = {
    ...DEFAULT_SCAR_HEIGHT_MAP_BUILD,
    ...buildOverrides,
  };
  const blur1 = Math.max(0, Math.round(cfg.blurPass1Radius));
  const blur2 = Math.max(0, Math.round(cfg.blurPass2Radius));
  const t0 = isDebugScarVisual() ? performance.now() : 0;
  const depthAcc = new Float32Array(SCAR_MAP_WIDTH * SCAR_MAP_HEIGHT);
  depthAcc.fill(SCAR_NEUTRAL_DEPTH);

  const stats: ScarMapBuildStats = {
    layerId,
    pointCount: points.length,
    pointsConsidered: points.length,
  };

  for (const p of points) {
    const { cx, cy } = painPointToFieldTexel(p);
    const inten = Math.sqrt(THREE.MathUtils.clamp(p.intensity, 0, 1));
    const baseRadius = Math.round(
      (8 + 24 * (0.2 + 0.8 * inten)) * cfg.stampRadiusMul,
    );
    const radiusPx = Math.max(1, Math.max(cfg.stampRadiusMin, baseRadius));
    const peakDent =
      (60 + 110 * (0.15 + 0.85 * inten)) * cfg.stampPeakMul;

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
        // Smooth shoulder (vs (1−t)^3 + tiny support) removes high-frequency jigglies on outlines.
        const falloffDepth = Math.exp(-(t * t) * cfg.falloffSigma);
        const sub = peakDent * falloffDepth;
        depthAcc[idx] = Math.max(SCAR_MIN_DEPTH, depthAcc[idx]! - sub);
      }
    }
  }

  let smoothed: Float32Array = depthAcc;
  if (blur1 > 0) {
    smoothed = boxBlurScarDepth(smoothed, SCAR_MAP_WIDTH, SCAR_MAP_HEIGHT, blur1);
  }
  if (blur2 > 0) {
    smoothed = boxBlurScarDepth(smoothed, SCAR_MAP_WIDTH, SCAR_MAP_HEIGHT, blur2);
  }

  if (isDebugScarVisual()) {
    console.info("[scar map] built", {
      ...stats,
      buildMs: Math.round(performance.now() - t0),
    });
  }

  const depthBytes = new Uint8Array(SCAR_MAP_WIDTH * SCAR_MAP_HEIGHT);
  for (let i = 0; i < smoothed.length; i++) {
    depthBytes[i] = Math.round(THREE.MathUtils.clamp(smoothed[i]!, 0, 255));
  }

  return makeRedDataTexture(depthBytes);
}

export function drawScarMapPreview(
  canvas: HTMLCanvasElement,
  tex: THREE.DataTexture,
): void {
  const image = tex.image as { data?: Uint8Array; width?: number; height?: number };
  const data = image.data;
  const w = image.width ?? SCAR_MAP_WIDTH;
  const h = image.height ?? SCAR_MAP_HEIGHT;
  if (!data) return;

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const imgData = ctx.createImageData(w, h);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const g = data[row * w + col] ?? SCAR_NEUTRAL_DEPTH;
      const o = (row * w + col) * 4;
      imgData.data[o] = g;
      imgData.data[o + 1] = g;
      imgData.data[o + 2] = g;
      imgData.data[o + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}
