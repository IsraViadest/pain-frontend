import * as THREE from "three";

/**
 * Plate-carrée equirect UV for a unit direction (v = 0 at north pole).
 * Same grid as pain-server texture column/row (`x`/`y`), GeoJSON land masks, and scar
 * map texels (1000×482). Not a separate “row index” scheme — one shared equirect frame.
 * For Three.js {@link THREE.SphereGeometry} displacement, set `DataTexture.flipY = true`.
 */
export function unitDirectionToGlobeEquirectUV(dir: THREE.Vector3): {
  u: number;
  v: number;
} {
  const n = dir.clone().normalize();
  let u = Math.atan2(n.z, -n.x) / (2 * Math.PI);
  if (u < 0) u += 1;
  if (u >= 1) u -= 1;
  const v = 0.5 - Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)) / Math.PI;
  return { u, v };
}

/** Inverse of {@link unitDirectionToGlobeEquirectUV}. */
export function globeEquirectUvToLatLng(u: number, v: number): {
  lat: number;
  lng: number;
} {
  const uu = ((u % 1) + 1) % 1;
  const vv = THREE.MathUtils.clamp(v, 0, 1);
  return {
    lat: 90 - vv * 180,
    lng: uu * 360 - 180,
  };
}
