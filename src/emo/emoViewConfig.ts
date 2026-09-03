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
import {
  DEFAULT_EMO_PARAMS,
  EMO_ENUM_VALUES,
  diffEmoParams,
  type EmoEnumKey,
  type EmoViewParams,
} from "./viewParams";
import {
  DEFAULT_EMO_PRESET_ID,
  findEmoPreset,
  resolveEmoPresetParams,
} from "./viewPresets";

const EMO_VIEWS_LS_KEY = "pain-emo-views";

/**
 * Enable with `?ev=1` or `localStorage.setItem("pain-emo-views", "1")` then reload.
 * Off by default, so production is untouched until a preset is promoted deliberately.
 *
 * `?emoViews=1` is still accepted. It was the original spelling and PROGRESS.md, which is
 * append-only and therefore cannot be rewritten, records many URLs that use it. Dropping it would
 * kill working links in the archive, so the long form stays readable and the short one is what
 * gets written and documented.
 */
export function shouldShowEmoViews(): boolean {
  try {
    if (localStorage.getItem(EMO_VIEWS_LS_KEY) === "1") return true;
  } catch {
    /* private mode / quota */
  }
  try {
    const q = new URLSearchParams(window.location.search);
    const v = q.get("ev") ?? q.get("emoViews");
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

/**
 * Whether the views panel starts open. `?emoPanel=0` starts it hidden, which is what the
 * gallery capture uses: the panel covers a third of the globe, so a screenshot taken with it
 * open is not a picture of the view. The entry button still restores it.
 */
export function shouldOpenEmoPanel(): boolean {
  try {
    const v = new URLSearchParams(window.location.search).get("emoPanel");
    return v !== "0" && v !== "false";
  } catch {
    return true;
  }
}

/** One enum parameter, validated against its allowed values because these are hand-typed. */
function readEnumParam(
  q: URLSearchParams,
  name: string,
  key: EmoEnumKey,
  params: EmoViewParams,
): void {
  const raw = q.get(name);
  if (raw === null) return;
  const allowed: readonly string[] = EMO_ENUM_VALUES[key];
  if (!allowed.includes(raw)) {
    console.warn(`[emoViewConfig] ignoring ${name}="${raw}"; expected ${allowed.join(" | ")}`);
    return;
  }
  Object.assign(params, { [key]: raw });
}

/**
 * Apply an exact override object, as written by the view panel's "reload with these".
 *
 * Unknown keys and values of the wrong type are dropped rather than thrown on, matching the
 * rest of this module: every one of these values can arrive hand-edited.
 */
function applyParamsJson(raw: string, params: EmoViewParams): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`[emoViewConfig] ignoring emoParams; not valid JSON`);
    return;
  }
  if (typeof parsed !== "object" || parsed === null) return;
  for (const [key, value] of Object.entries(parsed)) {
    if (!(key in DEFAULT_EMO_PARAMS)) continue;
    const typed = key as keyof EmoViewParams;
    if (typeof value !== typeof DEFAULT_EMO_PARAMS[typed]) continue;
    if (typeof value === "string") {
      const allowed: readonly string[] | undefined =
        EMO_ENUM_VALUES[typed as EmoEnumKey];
      if (allowed && !allowed.includes(value)) continue;
    }
    Object.assign(params, { [typed]: value });
  }
}

interface EmoViewSelection {
  presetId: string;
  params: EmoViewParams;
}

/**
 * Resolve which view to open from the query string, so any view is reachable from a cold load
 * and a screenshot of it is reproducible.
 *
 * Four layers, each overriding the one before:
 *   1. DEFAULT_EMO_PARAMS
 *   2. `?emoPreset=<id>`   a named entry in the append-only registry
 *   3. `?emoMode=` and friends, single-field shorthands, kept because they are documented
 *   4. `?emoParams=<json>` an exact override object, what the panel's reload button writes
 */
export function resolveEmoViewFromUrl(): EmoViewSelection {
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(window.location.search);
  } catch {
    return { presetId: DEFAULT_EMO_PRESET_ID, params: { ...DEFAULT_EMO_PARAMS } };
  }

  const requested = q.get("emoPreset");
  const preset = findEmoPreset(requested ?? DEFAULT_EMO_PRESET_ID);
  if (requested !== null && !preset) {
    console.warn(`[emoViewConfig] unknown emoPreset="${requested}"; falling back to the default`);
  }
  const resolved = preset ?? findEmoPreset(DEFAULT_EMO_PRESET_ID);
  const params = resolved
    ? resolveEmoPresetParams(resolved)
    : { ...DEFAULT_EMO_PARAMS };

  readEnumParam(q, "emoMode", "labelMode", params);
  readEnumParam(q, "emoClick", "clickMode", params);
  readEnumParam(q, "emoColour", "colourMode", params);
  readEnumParam(q, "emoEnglish", "englishText", params);
  const density = Number(q.get("emoDensity"));
  if (Number.isFinite(density) && density > 0) params.density = density;

  const json = q.get("emoParams");
  if (json !== null) applyParamsJson(json, params);

  return { presetId: resolved?.id ?? DEFAULT_EMO_PRESET_ID, params };
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
  q.set("ev", "1");
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
