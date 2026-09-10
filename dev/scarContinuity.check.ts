/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
import assert from "node:assert/strict";
import { createPainScarDisplacementTexture, painPointToFieldTexel, SCAR_MAP_WIDTH }
  from "../src/globe/painScarField";
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
const centerPoint = point(0, 0);
const { cx, cy } = painPointToFieldTexel(centerPoint)!;
const unfiltered = { ...tune, blurPass1Radius: 0, blurPass2Radius: 0 };
const original = createPainScarDisplacementTexture([centerPoint], "probe", unfiltered);
const rounded = createPainScarDisplacementTexture([centerPoint], "probe",
  { ...unfiltered, roundedShoulder: true });
const at = cy * SCAR_MAP_WIDTH + cx;
assert.equal(original.image.data[at], rounded.image.data[at], "same configured center depth");
assert.equal(original.image.data[at + 4], rounded.image.data[at + 4], "same half-height shoulder");
assert.equal(rounded.image.data[at + 5], 128, "rounded support reaches neutral at its edge");
assert.ok(original.image.data[at + 5]! < 128, "control retains its hard cutoff");
original.dispose(); rounded.dispose();
console.info("scar continuity and rounded-shoulder checks passed");
