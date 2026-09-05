import assert from "node:assert/strict";
import { createPainScarDisplacementTexture } from "../src/globe/painScarField";
import { sampleScarHeight01 } from "../src/globe/scarDisplacement";
import type { PainPoint } from "../src/types/api";

const point = (lat: number, lng: number): PainPoint => ({
  id: 1, lat, lng, intensity: 1, category: "physical", uiLayer: "physpain",
  createdAt: "2026-09-05T00:00:00Z",
});
const tune = { stampRadiusMin: 1, stampRadiusMul: 0.15, stampPeakMul: 0.35,
  falloffSigma: 1.05, blurPass1Radius: 4, blurPass2Radius: 1 };
const seam = createPainScarDisplacementTexture([point(0, 179.9)], "probe", tune);
assert.ok(Math.abs(sampleScarHeight01(seam, 1e-8, 0.5) -
  sampleScarHeight01(seam, 1 - 1e-8, 0.5)) < 1e-5, "longitude seam must be continuous");
seam.dispose();
for (const lat of [90, -90]) {
  const a = createPainScarDisplacementTexture([point(lat, 0)], "probe", tune);
  const b = createPainScarDisplacementTexture([point(lat, 123)], "probe", tune);
  assert.deepEqual(a.image.data, b.image.data, "a pole has no distinct longitude");
  const v = lat > 0 ? 0 : 1;
  const reference = sampleScarHeight01(a, 0, v);
  for (const u of [0.1, 0.4, 0.9, 1]) {
    assert.equal(sampleScarHeight01(a, u, v), reference, "coincident pole vertices agree");
  }
  a.dispose(); b.dispose();
}
console.info("scar seam and pole checks passed");
