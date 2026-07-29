import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as THREE from "three";
import { latLngToVector3 } from "../globe/latLng";
import {
  SURVEY_FLY_TO_CAMERA_RADIUS,
  SURVEY_FLY_TO_DURATION_MS,
} from "./surveyData";

type GlobeFlyToOptions = {
  radius?: number;
  durationMs?: number;
};

/** Normalized time upper bound (t ∈ [0, 1]). */
const FLY_TO_T_MAX = 1;

/** Unit sphere radius — direction is normalized before scaling to camera distance. */
const UNIT_SPHERE_RADIUS = 1;

function easeInOutCubic(t: number): number {
  // Standard ease-in-out cubic: t<0.5 → 4t³; else 1 - (-2t+2)³/2
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Smoothly move the camera to look at a lat/lng from outside the globe.
 * OrbitControls target stays at the origin (globe center).
 */
export function flyGlobeToLatLng(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  lat: number,
  lng: number,
  earthContent: THREE.Object3D,
  options: GlobeFlyToOptions = {},
): Promise<void> {
  const radius = options.radius ?? SURVEY_FLY_TO_CAMERA_RADIUS;
  const durationMs = options.durationMs ?? SURVEY_FLY_TO_DURATION_MS;

  const targetPosition = latLngToVector3(lat, lng, UNIT_SPHERE_RADIUS)
    .normalize()
    .multiplyScalar(radius);
  // Y-axis only — match frozen earthContent spin at fly-to start
  targetPosition.applyEuler(new THREE.Euler(0, earthContent.rotation.y, 0));

  const startPosition = camera.position.clone();
  // Globe center — OrbitControls orbit target
  controls.target.set(0, 0, 0);

  const wasEnabled = controls.enabled;
  controls.enabled = false;

  const startTime = performance.now();

  return new Promise((resolve) => {
    const step = (now: number): void => {
      const elapsed = now - startTime;
      const t = Math.min(FLY_TO_T_MAX, elapsed / durationMs); // clamp normalized time
      const eased = easeInOutCubic(t);

      camera.position.lerpVectors(startPosition, targetPosition, eased);
      controls.update();

      if (t < FLY_TO_T_MAX) {
        requestAnimationFrame(step);
        return;
      }

      controls.enabled = wasEnabled;
      resolve();
    };

    requestAnimationFrame(step);
  });
}
