/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { EmoData } from "../src/emo/emoData";
import { createEmoSelectionMotion } from "../src/emo/selectionMotion";
import { DEFAULT_EMO_PARAMS } from "../src/emo/viewParams";
import { latLngToVector3 } from "../src/globe/latLng";
import { flyGlobeToLatLng } from "../src/survey/globeFlyTo";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number =>
  setTimeout(() => callback(performance.now()), 5) as unknown as number;
globalThis.cancelAnimationFrame = (handle: number): void =>
  clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label);
}

const data: EmoData = {
  meta: {
    generated: "fixture",
    source: { lexicon: "fixture", percentages: "fixture", percentagesAreDummy: true },
    rule: "fixture",
    countryCount: 1,
    categoryCount: 1,
    englishFallbackCount: 0,
    tiedWinnerCount: 0,
  },
  categories: [
    { key: "01_hurt", catKey: "hurt", label: "Hurt", family: "fixture" },
  ],
  countries: {},
};
const motion = createEmoSelectionMotion({
  data,
  params: {
    ...DEFAULT_EMO_PARAMS,
    selectionLeaderMs: 400,
    selectionSpreadMs: 400,
    selectionRetractSpeed: 2,
  },
});
motion.setSelection("01_hurt");
motion.setSpread("01_hurt", "AAA", new Map([["AAA", 0]]), 1);
await sleep(40);
motion.tick();
const beforePause = motion.leaderArrivalOf("AAA");
motion.setPaused(true);
await sleep(80);
motion.tick();
const duringPause = motion.leaderArrivalOf("AAA");
assert(motion.isPaused(), "motion reports paused");
assert(Math.abs(duringPause - beforePause) < 1e-9, "paused motion is unchanged");
motion.setPaused(false);
await sleep(40);
motion.tick();
assert(!motion.isPaused(), "motion reports resumed");
assert(motion.leaderArrivalOf("AAA") > duringPause, "resumed motion advances");

const camera = new THREE.PerspectiveCamera();
camera.position.set(0, 0, 2.6);
let updates = 0;
let radii: number[] = [];
const controls = {
  target: new THREE.Vector3(),
  enabled: true,
  update: () => {
    updates += 1;
    radii.push(camera.position.length());
  },
} as unknown as OrbitControls;
const earth = new THREE.Group();
await flyGlobeToLatLng(camera, controls, 10, 20, earth, {
  durationMs: 30,
  radius: 2.6,
});
const expected = latLngToVector3(10, 20, 1).normalize().multiplyScalar(2.6);
assert(camera.position.distanceTo(expected) < 1e-9, "completed flight reaches target");
assert(controls.enabled, "completed flight restores controls");
assert(updates > 1, "completed flight updates controls");

await flyGlobeToLatLng(camera, controls, -5, -30, earth, {
  durationMs: 0,
  radius: 2.6,
});
const reducedTarget = latLngToVector3(-5, -30, 1).normalize().multiplyScalar(2.6);
assert(camera.position.distanceTo(reducedTarget) < 1e-9, "zero-time flight cuts to target");

camera.position.set(0, 0, 2.2);
radii = [];
await flyGlobeToLatLng(camera, controls, 35, 130, earth, {
  durationMs: 30,
  radius: 9,
  preserveRadius: true,
});
assert(radii.length > 1, "rotation-only flight produced intermediate frames");
assert(radii.every((radius) => Math.abs(radius - 2.2) < 1e-9),
  "rotation-only flight changed camera radius");

const abortController = new AbortController();
const aborting = flyGlobeToLatLng(camera, controls, -20, 100, earth, {
  durationMs: 500,
  radius: 2.6,
  signal: abortController.signal,
});
await sleep(25);
abortController.abort();
let abortName = "";
try {
  await aborting;
} catch (error) {
  abortName = error instanceof DOMException ? error.name : "unknown";
}
const stoppedAt = camera.position.clone();
await sleep(30);
assert(abortName === "AbortError", "aborted flight rejects with AbortError");
assert(camera.position.equals(stoppedAt), "aborted flight stops moving");
assert(controls.enabled, "aborted flight restores controls");

console.info("presentation motion check passed");
