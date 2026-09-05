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
    categories: [{ key: "hurt", catKey: "hurt", label: "Hurt", family: "pain" }],
  } as EmoData;
  const motion = createEmoSelectionMotion({
    data,
    params: { ...DEFAULT_EMO_PARAMS, selectionLeaderMs: 100, selectionSpreadMs: 400,
      selectionRetractSpeed: 2, selectionMotionMs: 200 },
  });
  motion.setSelection("hurt");
  motion.setSpread("hurt", "AAA", new Map([["AAA", 0], ["BBB", 1]]), 2);
  now = 500;
  motion.tick();
  assert.equal(motion.isBuilding("hurt"), false);
  const generation = motion.spreadGeneration();
  motion.setSpread("hurt", "BBB", new Map([["BBB", 0], ["AAA", 1]]), 2);
  now = 600;
  motion.tick();
  assert.equal(motion.spreadGeneration(), generation, "old geometry still has 150 ms of retreat");
  now = 800;
  motion.tick();
  assert.equal(motion.spreadGeneration(), generation + 1);
  assert.equal(motion.arrivalFrontOf("hurt"), 0.125, "only 50 ms since the mesh became free");
  now = 1150;
  motion.tick();
  assert.equal(motion.arrivalFrontOf("hurt"), 1);
  motion.setSelection(null);
  now = 1400;
  motion.tick();
  // An empty wave stays through the frame that lands its independent emphasis fade.
  now += 1;
  motion.tick();
  assert.equal(motion.retreatingCategories().length, 0);
  console.info("network replacement timing check passed");
} finally {
  Object.defineProperty(performance, "now", { configurable: true, value: originalNow });
}
