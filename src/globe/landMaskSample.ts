import * as THREE from "three";

type LandMaskRaster = {
  data: Uint8ClampedArray;
  w: number;
  h: number;
};

/** Bilinear sample of mask luminance 0–1 (RGBA canvas from {@link rasterLandMaskFromCountries}). */
function sampleMaskLuminance01(
  mask: LandMaskRaster,
  u: number,
  v: number,
): number {
  const { data, w, h } = mask;
  if (w < 2 || h < 2) return 0;
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
  const lum = (ix: number, iy: number) => {
    const i = (iy * w + ix) * 4;
    return (
      (0.2126 * data[i]! +
        0.7152 * data[i + 1]! +
        0.0722 * data[i + 2]!) /
      255
    );
  };
  const a = THREE.MathUtils.lerp(lum(x0, y0), lum(x1, y0), tx);
  const b = THREE.MathUtils.lerp(lum(x0, y1), lum(x1, y1), tx);
  return THREE.MathUtils.lerp(a, b, ty);
}

/** Same threshold as stipple GeoJSON land mask (`earthStippleGlobe` `isLandPixel`). */
function isLandAtUv(mask: LandMaskRaster, u: number, v: number): boolean {
  return sampleMaskLuminance01(mask, u, v) > 0.45;
}
