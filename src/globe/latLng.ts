import * as THREE from "three";
import type { PainPoint } from "../types/api";

/** True when a pain point has WGS84 coordinates (country-only non-text rows store null). */
export function hasPainPointCoordinates(
  p: PainPoint,
): p is PainPoint & { lat: number; lng: number } {
  return p.lat !== null && p.lng !== null;
}

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
