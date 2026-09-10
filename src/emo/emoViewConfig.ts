/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/** Camera verification helpers and the retained internal panel URL formatter. */
import * as THREE from "three";
import type { GlobeView } from "../globe/GlobeView";
import { latLngToVector3 } from "../globe/latLng";
import {
  DEFAULT_EMO_PARAMS,
  diffEmoParams,
  type EmoViewParams,
} from "./viewParams";
import {
  findEmoPreset,
  resolveEmoPresetParams,
} from "./viewPresets";

/** The `ev` value, or null when the gate is off or unreadable. `emoViews` is the old spelling. */
function emoGateValue(): string | null {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get("ev") ?? q.get("emoViews");
  } catch {
    return null;
  }
}

/**
 * Whether the views panel starts open. `?emoPanel=0` starts it hidden, which is what the
 * gallery capture uses: the panel covers a third of the globe, so a screenshot taken with it
 * open is not a picture of the view. `?ev=2` is the shorthand for the same thing.
 *
 * The explicit parameter wins over the gate's shorthand in both directions, so `?ev=2&emoPanel=1`
 * opens the panel: a value someone typed beats one they implied. The entry button restores it
 * either way.
 */
export function shouldOpenEmoPanel(): boolean {
  try {
    const v = new URLSearchParams(window.location.search).get("emoPanel");
    if (v !== null) return v !== "0" && v !== "false";
  } catch {
    return true;
  }
  return emoGateValue() !== "2";
}

/**
 * The URL that reopens the current view from a cold load.
 *
 * Carries the preset id plus only the fields that differ from it, so an untouched preset is
 * just its id and a tweaked one stays readable. Every other query parameter is preserved, which
 * is what keeps `freeze` and `cam` alive across a reload.
 */
export function buildEmoViewUrl(presetId: string, params: EmoViewParams): string {
  const url = new URL(window.location.href);
  const q = url.searchParams;
  // The gate's own value is carried through, not rewritten. A URL built from an `ev=2` page that
  // came back as `ev=1` would reopen the panel over the view the operator was looking at, which
  // is exactly the thing `ev=2` exists to avoid.
  const gate = q.get("ev") ?? q.get("emoViews");
  q.set("ev", gate === "2" ? "2" : "1");
  // A URL built here supersedes one that was typed, so the long form must not survive alongside it.
  q.delete("emoViews");
  q.set("emoPreset", presetId);
  // The shorthands sit in an earlier layer than emoParams, so leaving stale ones behind would
  // produce a URL whose visible text disagrees with what it opens.
  for (const name of ["emoMode", "emoClick", "emoColour", "emoEnglish", "emoDensity"]) {
    q.delete(name);
  }
  const preset = findEmoPreset(presetId);
  const base = preset ? resolveEmoPresetParams(preset) : { ...DEFAULT_EMO_PARAMS };
  const diff = diffEmoParams(base, params);
  if (Object.keys(diff).length > 0) q.set("emoParams", JSON.stringify(diff));
  else q.delete("emoParams");
  return url.toString();
}

/**
 * Deterministic camera placement for reproducible captures and fair A/B comparison.
 *
 * The globe auto-spins every frame, so without this no two screenshots of the same preset are
 * comparable. `?freeze=1` stops the spin; `?cam=<lat>,<lng>,<distance>` places the camera over a
 * point instantly. The spin compensation matches survey/globeFlyTo.ts so a given lat/lng lands
 * under the camera regardless of where the globe had rotated to.
 */
export function applyEmoCaptureOverrides(globe: GlobeView): void {
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(window.location.search);
  } catch {
    return;
  }
  if (q.get("freeze") === "1" || q.get("freeze") === "true") {
    globe.setAutoSpinEnabled(false);
  }
  const cam = q.get("cam");
  if (!cam) return;
  const [lat, lng, dist] = cam.split(",").map(Number);
  if (![lat, lng, dist].every((n) => Number.isFinite(n))) {
    console.warn(`[emoViewConfig] ignoring malformed cam="${cam}"; expected lat,lng,distance`);
    return;
  }
  const position = latLngToVector3(lat, lng, 1).normalize().multiplyScalar(dist);
  position.applyEuler(new THREE.Euler(0, globe.earthContent.rotation.y, 0));
  globe.camera.position.copy(position);
  globe.controls.target.set(0, 0, 0);
  globe.controls.update();
}
