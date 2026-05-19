import * as THREE from "three";
import { unitDirectionToGlobeEquirectUV } from "./globeEquirectUV";

export function scarHeightTo01(byte: number): number {
  return byte / 255;
}

export function scarRadialOffset(
  height01: number,
  displacementScale: number,
  displacementBias: number,
): number {
  return height01 * displacementScale + displacementBias;
}

/**
 * Tiny outward lift so stipple / lines pass depth test on the CPU-warped globe mesh.
 * Fat lines need extra bias ≈ half line width in world units.
 */
export const SCAR_OVERLAY_SURFACE_BIAS = 0.0008;

/** Read red-channel scar height (0–1) from a CPU-side {@link THREE.DataTexture}. */
export function sampleScarHeight01(
  map: THREE.DataTexture,
  u: number,
  v: number,
): number {
  const image = map.image as {
    data?: ArrayLike<number>;
    width?: number;
    height?: number;
  };
  const data = image.data;
  const w = image.width ?? 0;
  const h = image.height ?? 0;
  if (!data || w < 1 || h < 1) return 0.5;

  const uu = ((u % 1) + 1) % 1;
  const vv = THREE.MathUtils.clamp(v, 0, 1);
  const x = uu * (w - 1);
  const y = vv * (h - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const tx = x - x0;
  const ty = y - y0;
  const i = (ix: number, iy: number) => data[iy * w + ix] ?? 128;
  const r00 = i(x0, y0);
  const r10 = i(x1, y0);
  const r01 = i(x0, y1);
  const r11 = i(x1, y1);
  const a = THREE.MathUtils.lerp(r00, r10, tx);
  const b = THREE.MathUtils.lerp(r01, r11, tx);
  return scarHeightTo01(THREE.MathUtils.lerp(a, b, ty));
}

/**
 * Warp sphere positions using the same radial offset as border line warping.
 * Optional `landAttr`: when set, only vertices with `aLand >= 0.5` move (legacy).
 * Stipple + borders should use the same shell — call without `landAttr` so ocean
 * and coastlines stay coplanar.
 */
export function applyScarToSpherePositions(
  base: Float32Array,
  out: Float32Array,
  map: THREE.DataTexture,
  displacementScale: number,
  displacementBias: number,
  surfaceBias = 0,
  landAttr?: THREE.BufferAttribute,
): void {
  const nVerts = base.length / 3;
  for (let vi = 0; vi < nVerts; vi++) {
    const i = vi * 3;
    if (landAttr && landAttr.getX(vi) < 0.5) {
      out[i] = base[i]!;
      out[i + 1] = base[i + 1]!;
      out[i + 2] = base[i + 2]!;
      continue;
    }

    const x = base[i]!;
    const y = base[i + 1]!;
    const z = base[i + 2]!;
    const dir = new THREE.Vector3(x, y, z).normalize();
    const baseRadius = Math.sqrt(x * x + y * y + z * z);
    const { u, v } = unitDirectionToGlobeEquirectUV(dir);
    const h = sampleScarHeight01(map, u, v);
    const radial = scarRadialOffset(h, displacementScale, displacementBias);
    const s = Math.max(0.0001, baseRadius + radial + surfaceBias);
    out[i] = dir.x * s;
    out[i + 1] = dir.y * s;
    out[i + 2] = dir.z * s;
  }
}
