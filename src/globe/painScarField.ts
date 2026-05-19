import * as THREE from "three";
import type { PainPoint } from "../types/api";
import { unitDirectionToGlobeEquirectUV } from "./globeEquirectUV";
import { latLngToVector3 } from "./latLng";
import { isDebugScarVisual } from "./debugScarVisual";

/** Equirect resolution; must match sphere UVs (same convention as stipple + borders). */
export const SCAR_MAP_WIDTH = 1024;
export const SCAR_MAP_HEIGHT = 512;
/** Flat surface in the scar height map (byte 0–255). 128 = neutral with displacement bias. */
export const SCAR_NEUTRAL_DEPTH = 128;
export const SCAR_MIN_DEPTH = 0;
const SCAR_STAMP_POINT_CAP = 3_000;

function painPointToGlobeUv(p: PainPoint): { u: number; v: number } {
  return unitDirectionToGlobeEquirectUV(latLngToVector3(p.lat, p.lng, 1));
}

function scarStampPoints(points: PainPoint[]): PainPoint[] {
  if (points.length <= SCAR_STAMP_POINT_CAP) return points;
  const step = Math.ceil(points.length / SCAR_STAMP_POINT_CAP);
  const sampled: PainPoint[] = [];
  for (let i = 0; i < points.length; i += step) {
    sampled.push(points[i]!);
  }
  return sampled;
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
  tex.needsUpdate = true;
  return tex;
}

export type ScarMapBuildStats = {
  layerId: string;
  pointCount: number;
  pointsConsidered: number;
};

/**
 * Scar height map from pain lat/lng. Same field warps stipple (GPU) and coastlines (CPU).
 */
export function createPainScarDisplacementTexture(
  points: PainPoint[],
  layerId = "unknown",
): THREE.DataTexture {
  const depthAcc = new Float32Array(SCAR_MAP_WIDTH * SCAR_MAP_HEIGHT);
  depthAcc.fill(SCAR_NEUTRAL_DEPTH);

  const stats: ScarMapBuildStats = {
    layerId,
    pointCount: points.length,
    pointsConsidered: 0,
  };

  for (const p of scarStampPoints(points)) {
    stats.pointsConsidered++;
    const { u, v } = painPointToGlobeUv(p);
    const cx = Math.floor(((u % 1) + 1) % 1 * (SCAR_MAP_WIDTH - 1));
    const cy = Math.floor(THREE.MathUtils.clamp(v, 0, 1) * (SCAR_MAP_HEIGHT - 1));
    const inten = Math.sqrt(THREE.MathUtils.clamp(p.intensity, 0, 1));
    const radiusPx = Math.round(18 + 58 * (0.2 + 0.8 * inten));
    const peakDent = 72 + 140 * (0.15 + 0.85 * inten);

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
        const falloffDepth = (1 - t) ** 3;
        const sub = peakDent * falloffDepth;
        depthAcc[idx] = Math.max(SCAR_MIN_DEPTH, depthAcc[idx]! - sub);
      }
    }
  }

  if (isDebugScarVisual()) {
    console.info("[scar map] built", stats);
  }

  const depthBytes = new Uint8Array(SCAR_MAP_WIDTH * SCAR_MAP_HEIGHT);
  for (let i = 0; i < depthAcc.length; i++) {
    depthBytes[i] = Math.round(THREE.MathUtils.clamp(depthAcc[i]!, 0, 255));
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
  for (let i = 0; i < w * h; i++) {
    const g = data[i] ?? SCAR_NEUTRAL_DEPTH;
    const o = i * 4;
    imgData.data[o] = g;
    imgData.data[o + 1] = g;
    imgData.data[o + 2] = g;
    imgData.data[o + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
}
