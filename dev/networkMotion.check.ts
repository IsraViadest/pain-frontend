/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
import assert from "node:assert/strict";
import type { EmoData } from "../src/emo/emoData";
import { createEmoSelectionMotion } from "../src/emo/selectionMotion";
import { DEFAULT_EMO_PARAMS } from "../src/emo/viewParams";

// A same-category replacement must leave the old geometry in its old order until it is empty.
let now = 0;
const originalNow = performance.now;
Object.defineProperty(performance, "now", { configurable: true, value: () => now });
try {
  const data = {
    countries: {},
    categories: [
      { key: "hurt", catKey: "hurt", label: "Hurt", family: "pain" },
      { key: "grief", catKey: "grief", label: "Grief", family: "pain" },
    ],
  } as EmoData;
  const motion = createEmoSelectionMotion({
    data,
    params: { ...DEFAULT_EMO_PARAMS, selectionLeaderMs: 100, selectionSpreadMs: 400,
      selectionRetractSpeed: 2, selectionMotionMs: 200 },
  });
  motion.setSelection("hurt");
  assert.equal(motion.markStrengthOf("AAA", 0.5), 1, "no wave preserves the historical full mark");
  motion.setSpread("hurt", "AAA", new Map([["AAA", 0], ["BBB", 1]]), 2);
  now = 149;
  motion.tick();
  assert.equal(motion.markStrengthOf("AAA", 0.5), 0, "origin waits for its mark arrival");
  now = 150;
  motion.tick();
  assert.equal(motion.markArrivalOf("AAA"), 0.5, "the existing arrival ramp is unchanged");
  assert.equal(motion.markStrengthOf("AAA", 0.5), 1, "origin marks at the arrival threshold");
  now = 349;
  motion.tick();
  assert.equal(motion.markStrengthOf("BBB", 0.5), 0, "peer waits for its own arrival");
  now = 350;
  motion.tick();
  for (const peerStrength of [1, 0.5, 0.65]) {
    assert.equal(motion.markStrengthOf("AAA", peerStrength), 1, "origin keeps full strength");
    assert.equal(motion.markStrengthOf("BBB", peerStrength), peerStrength, "peer takes its weight");
  }
  now = 500;
  motion.tick();
  assert.equal(motion.isBuilding("hurt"), false);
  const generation = motion.spreadGeneration();
  motion.setSpread("hurt", "BBB", new Map([["BBB", 0], ["AAA", 1]]), 2);
  assert.equal(motion.markStrengthOf("AAA", 0.5), 1, "overlap retains the outgoing origin");
  assert.equal(motion.markStrengthOf("BBB", 0.5), 0.5, "new origin cannot borrow its old peer arrival");
  now = 600;
  motion.tick();
  assert.equal(motion.spreadGeneration(), generation, "old geometry still has 150 ms of retreat");
  assert.equal(motion.markStrengthOf("AAA", 0.5), 1, "reversal keeps its own origin role");
  assert.equal(motion.markStrengthOf("BBB", 0.5), 0, "retracted peer waits for its new wave");
  now = 800;
  motion.tick();
  assert.equal(motion.spreadGeneration(), generation + 1);
  assert.equal(motion.arrivalFrontOf("hurt"), 0.125, "only 50 ms since the mesh became free");
  assert.equal(motion.markStrengthOf("BBB", 0.5), 1, "replacement origin reaches its own mark");
  assert.equal(motion.markStrengthOf("AAA", 0.5), 0, "old origin must arrive again as a peer");
  now = 1150;
  motion.tick();
  assert.equal(motion.arrivalFrontOf("hurt"), 1);
  assert.equal(motion.markStrengthOf("AAA", 0.5), 0.5, "completed replacement changes the old origin to a peer");
  motion.setSelection(null);
  now = 1400;
  motion.tick();
  // An empty wave stays through the frame that lands its independent emphasis fade.
  now += 1;
  motion.tick();
  assert.equal(motion.retreatingCategories().length, 0);

  motion.setSelection("hurt");
  motion.setSpread("hurt", "AAA", new Map([["AAA", 0], ["BBB", 1]]), 2);
  now = 1901;
  motion.tick();
  motion.setSelection("grief");
  motion.setSpread("grief", "CCC", new Map([["CCC", 0], ["DDD", 1]]), 2);
  assert.equal(motion.markStrengthOf("AAA", 0.5), 1, "different-category replacement retains old origin");
  assert.equal(motion.markStrengthOf("CCC", 0.5), 0, "different-category origin starts unmarked");
  now = 2051;
  motion.tick();
  const strengths = ["AAA", "BBB", "CCC", "DDD"].map((iso3) => motion.markStrengthOf(iso3, 0.5));
  assert.deepEqual(strengths, [1, 0, 1, 0], "retracting and growing categories keep separate origins");
  motion.setPaused(true);
  now = 3051;
  motion.tick();
  assert.deepEqual(
    ["AAA", "BBB", "CCC", "DDD"].map((iso3) => motion.markStrengthOf(iso3, 0.5)),
    strengths,
    "pause freezes both growing and retreating contributions",
  );
  motion.setPaused(false);
  now = 3101;
  motion.tick();
  assert.equal(motion.markStrengthOf("AAA", 0.5), 0, "old origin retracts after resume");
  assert.equal(motion.markStrengthOf("CCC", 0.5), 1, "new origin stays marked after resume");
  assert.equal(motion.markStrengthOf("DDD", 0.5), 0, "resume does not catch up hidden time");
  console.info("network replacement timing and origin strength check passed");
} finally {
  Object.defineProperty(performance, "now", { configurable: true, value: originalNow });
}
