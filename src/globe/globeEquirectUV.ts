import * as THREE from "three";

/**
 * Plate-carrée equirect UV for a unit direction (v = 0 at north pole).
 * Same equirect frame as GeoJSON land masks and the scar height map (1000×482).
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
