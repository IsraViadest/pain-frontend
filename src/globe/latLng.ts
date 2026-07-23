import * as THREE from "three";

/** Equirectangular placement on a Y-up unit sphere (matches typical Three.js globe UVs). */
export function latLngToVector3(
  lat: number,
  lng: number,
  radius: number,
): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

/**
 * Inverse of {@link latLngToVector3}: world (or unit) direction → WGS84 degrees.
 *
 * Convention must match the forward map (negated X, `lng + 180` in θ).
 * Round-trip check: `vector3ToLatLng(latLngToVector3(lat, lng, 1).normalize())`
 * recovers `(lat, lng)` within float tolerance for lat ∈ [-90, 90], lng ∈ [-180, 180].
 *
 * @param v — sphere direction (any length; normalized internally).
 */
export function vector3ToLatLng(v: THREE.Vector3): { lat: number; lng: number } {
  const n = v.clone().normalize();
  // y = cos(φ) = sin(lat) with φ = 90° − lat (same as latLngToVector3).
  const lat = THREE.MathUtils.radToDeg(
    Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)),
  );
  // θ = atan2(z, −x) because forward uses x = −r·sin(φ)·cos(θ).
  const thetaDeg = THREE.MathUtils.radToDeg(Math.atan2(n.z, -n.x));
  // Forward used θ = lng + 180 → wrap back into [-180, 180].
  let lng = thetaDeg - 180;
  lng = ((((lng + 180) % 360) + 360) % 360) - 180;
  return { lat, lng };
}
