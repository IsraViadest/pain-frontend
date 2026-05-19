import * as THREE from "three";
import {
  DUMMY_PAIN_TEXTURE_HEIGHT,
  DUMMY_PAIN_TEXTURE_WIDTH,
  legacyTexturePixelToEquirectUv,
} from "../api/coordinates";
import type { PainPoint } from "../types/api";
import { unitDirectionToGlobeEquirectUV } from "./globeEquirectUV";
import { latLngToVector3 } from "./latLng";
import { isDebugScarVisual } from "./debugScarVisual";

/** Same grid as DummyPain / pain-server x,y (aligns with coast + stipple lat/lng). */
export const SCAR_MAP_WIDTH = DUMMY_PAIN_TEXTURE_WIDTH;
export const SCAR_MAP_HEIGHT = DUMMY_PAIN_TEXTURE_HEIGHT;
/** Flat surface in the scar height map (byte 0–255). 128 = neutral with displacement bias. */
export const SCAR_NEUTRAL_DEPTH = 128;
export const SCAR_MIN_DEPTH = 0;

function painPointToScarTexel(p: PainPoint): { cx: number; cy: number } {
  const maxCol = SCAR_MAP_WIDTH - 1;
  const maxRow = SCAR_MAP_HEIGHT - 1;
  const tx = p.metadata?.textureX;
  const ty = p.metadata?.textureY;
  if (typeof tx === "number" && typeof ty === "number") {
    const uv = legacyTexturePixelToEquirectUv(tx, ty);
    if (uv) {
      return {
        cx: Math.floor(uv.u * maxCol),
        cy: Math.floor(THREE.MathUtils.clamp(uv.v, 0, 1) * maxRow),
      };
    }
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
  // Row 0 = north in our buffer; Three.js sphere samples north at uv.y = 1.
  tex.flipY = true;
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
  const t0 = isDebugScarVisual() ? performance.now() : 0;
  const depthAcc = new Float32Array(SCAR_MAP_WIDTH * SCAR_MAP_HEIGHT);
  depthAcc.fill(SCAR_NEUTRAL_DEPTH);

  const stats: ScarMapBuildStats = {
    layerId,
    pointCount: points.length,
    pointsConsidered: points.length,
  };

  for (const p of points) {
    const { cx, cy } = painPointToScarTexel(p);
    const inten = Math.sqrt(THREE.MathUtils.clamp(p.intensity, 0, 1));
    const radiusPx = Math.max(1, Math.round(1 + 3 * (0.2 + 0.8 * inten)));
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
    console.info("[scar map] built", {
      ...stats,
      buildMs: Math.round(performance.now() - t0),
    });
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
  for (let row = 0; row < h; row++) {
    const srcRow = h - 1 - row;
    for (let col = 0; col < w; col++) {
      const g = data[srcRow * w + col] ?? SCAR_NEUTRAL_DEPTH;
      const o = (row * w + col) * 4;
      imgData.data[o] = g;
      imgData.data[o + 1] = g;
      imgData.data[o + 2] = g;
      imgData.data[o + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}
