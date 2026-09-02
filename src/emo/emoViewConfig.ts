/**
 * Opt-in gate for the emotional-pain label views.
 *
 * Follows the convention already used by the globe debug panel (globeDebugPanel.ts): a
 * `pain-`-prefixed kebab-case localStorage key wins over a camelCase URL parameter, and every
 * storage or URL read is wrapped because private mode and sandboxed frames throw.
 */
import * as THREE from "three";
import type { GlobeView } from "../globe/GlobeView";
import { latLngToVector3 } from "../globe/latLng";
import { DEFAULT_EMO_PARAMS, type EmoViewParams } from "./viewParams";

const EMO_VIEWS_LS_KEY = "pain-emo-views";

/**
 * Enable with `?emoViews=1` or `localStorage.setItem("pain-emo-views", "1")` then reload.
 * Off by default, so production is untouched until a preset is promoted deliberately.
 */
export function shouldShowEmoViews(): boolean {
  try {
    if (localStorage.getItem(EMO_VIEWS_LS_KEY) === "1") return true;
  } catch {
    /* private mode / quota */
  }
  try {
    const v = new URLSearchParams(window.location.search).get("emoViews");
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

/**
 * Read parameter overrides from the query string, so any view is reachable from a cold load
 * and a screenshot of it is reproducible. Unknown or malformed values fall back to the default
 * rather than throwing, because these are hand-typed.
 *
 * `?emoMode=native&emoClick=toggleLanguage&emoColour=family&emoDensity=60`
 */
export function readEmoParamsFromUrl(): EmoViewParams {
  const params: EmoViewParams = { ...DEFAULT_EMO_PARAMS };
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(window.location.search);
  } catch {
    return params;
  }
  const mode = q.get("emoMode");
  if (mode === "english" || mode === "native" || mode === "bilingual" || mode === "focal") {
    params.labelMode = mode;
  }
  const click = q.get("emoClick");
  if (click === "off" || click === "toggleLanguage" || click === "selectNetwork") {
    params.clickMode = click;
  }
  const colour = q.get("emoColour");
  if (colour === "white" || colour === "family" || colour === "category") {
    params.colourMode = colour;
  }
  const english = q.get("emoEnglish");
  if (english === "category" || english === "gloss") params.englishText = english;
  const density = Number(q.get("emoDensity"));
  if (Number.isFinite(density) && density > 0) params.density = density;
  return params;
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
