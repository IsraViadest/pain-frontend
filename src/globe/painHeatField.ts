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

/**
 * Accumulated pain intensity (0–1) per texel; wider stamps + blur than scar dents.
 * Sample on land stipple for a heat-map tint (cool → hot).
 */
export function createPainHeatTexture(points: PainPoint[]): THREE.DataTexture {
  const heatAcc = new Float32Array(SCAR_MAP_WIDTH * SCAR_MAP_HEIGHT);

  for (const p of points) {
    const { cx, cy } = painPointToFieldTexel(p);
    // Rendering-only clamp: does not modify PainPoint.intensity (Pattern 19 — adapter stores API value as-is).
    const inten = THREE.MathUtils.clamp(p.intensity, 0, 1);
    const radiusPx = Math.round(10 + 28 * (0.25 + 0.75 * inten));
    const peak = 0.25 + 0.75 * inten;

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

  let smoothed = boxBlurHeat(heatAcc, SCAR_MAP_WIDTH, SCAR_MAP_HEIGHT, 5);
  smoothed = boxBlurHeat(smoothed, SCAR_MAP_WIDTH, SCAR_MAP_HEIGHT, 3);

  let maxHeat = 0;
  for (let i = 0; i < smoothed.length; i++) {
    maxHeat = Math.max(maxHeat, smoothed[i]!);
  }
  const norm = maxHeat > 1e-6 ? 1 / maxHeat : 1;

  const bytes = new Uint8Array(SCAR_MAP_WIDTH * SCAR_MAP_HEIGHT);
  for (let i = 0; i < smoothed.length; i++) {
    bytes[i] = Math.round(
      THREE.MathUtils.clamp(smoothed[i]! * norm, 0, 1) * 255,
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
