/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
export type StipplePointTune = {
  scale: number;
  nearBoost: number;
};

const NEAR_DISTANCE = 1.35;
const FAR_DISTANCE = 2.35;

export function stipplePointScaleAtCameraDistance(
  cameraDistance: number,
  tune: StipplePointTune,
): number {
  const near = Math.max(
    0,
    Math.min(1, (FAR_DISTANCE - cameraDistance) / (FAR_DISTANCE - NEAR_DISTANCE)),
  );
  return tune.scale * (1 + tune.nearBoost * near);
}
