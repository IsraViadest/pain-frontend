/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
import { stipplePointScaleAtCameraDistance } from "../src/globe/stipplePointScale";

const fixed = { scale: 1.18, nearBoost: 0 };
const boosted = { scale: 1, nearBoost: 0.18 };

if (stipplePointScaleAtCameraDistance(1.35, fixed) !== 1.18) {
  throw new Error("fixed stipple scale changed with camera distance");
}
if (stipplePointScaleAtCameraDistance(2.35, boosted) !== 1) {
  throw new Error("close boost changed the far-camera scale");
}
if (stipplePointScaleAtCameraDistance(1.35, boosted) !== 1.18) {
  throw new Error("close boost did not reach its near-camera scale");
}
