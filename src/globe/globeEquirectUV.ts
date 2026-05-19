import * as THREE from "three";

/**
 * Equirectangular UV for a unit direction, aligned with Three.js default
 * {@link THREE.SphereGeometry} (phiLength 2π, thetaLength π). Use this for
 * displacement maps, stipple land sampling, and scar sampling so data lines
 * up with the mesh and with GeoJSON built from the same `latLngToVector3`.
 *
 * (The common mistake `atan2(z, x) + 0.5` shifts longitude vs this sphere.)
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

/** Inverse of {@link unitDirectionToGlobeEquirectUV} (plate-carrée lat from v). */
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

/** Unit-sphere direction for equirect UV (matches {@link latLngToVector3} after conversion). */
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
