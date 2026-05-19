import * as THREE from "three";

/**
 * Plate-carrée equirect UV for a unit direction (v = 0 at north pole).
 * Matches DummyPain row indexing, GeoJSON land masks, and scar map texel rows.
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

/** @deprecated Alias for {@link unitDirectionToGlobeEquirectUV}. */
export function unitDirectionToPlateCarreeUV(dir: THREE.Vector3): {
  u: number;
  v: number;
} {
  return unitDirectionToGlobeEquirectUV(dir);
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

/** Unit-sphere direction for equirect UV (matches {@link latLngToVector3}). */
export function globeEquirectUvToUnitDirection(
  u: number,
  v: number,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const { lat, lng } = globeEquirectUvToLatLng(u, v);
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  target.x = -Math.sin(phi) * Math.cos(theta);
  target.z = Math.sin(phi) * Math.sin(theta);
  target.y = Math.cos(phi);
  return target;
}
