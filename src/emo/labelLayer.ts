/**
 * DOM-overlay label layer for the emotional-pain views.
 *
 * WHY DOM RATHER THAN WEBGL TEXT: the 195 labels span 20 scripts, including Arabic contextual
 * joining (one term carries U+200C ZWNJ), Devanagari and Bengali conjuncts, Khmer and Myanmar
 * reordering, and Thaana RTL. DOM text goes through the browser's own shaping engine, which is
 * the only path verified correct for all of them. troika-three-text was measured and rejected:
 * its Typesetter has no GSUB/GPOS engine (Indic shaping is open issue #303), and MSDF atlases
 * map codepoints 1:1 with no shaping step at all. Measured cost of this layer at 195 bilingual
 * labels is 0.40 ms median per frame, so the trade is cheap.
 *
 * It reads GlobeView's public `camera`, `renderer` and `earthContent` and needs no change to it.
 * `earthContent.rotation.y` is the globe's spin, so labels are rotated by it before projection.
 */
import * as THREE from "three";
import type { GlobeView } from "../globe/GlobeView";
import { latLngToVector3 } from "../globe/latLng";
import { ensureCountryCentroidsLoaded, getCountryCentroid } from "../api/countryCentroids";
import type { EmoData } from "./emoData";
import type { EmoViewParams } from "./viewParams";

/**
 * Which country is selected, and the category whose network that reveals.
 * Not exported: main.ts takes it through inference on the `onSelect` callback, and the repo's
 * ts-prune gate fails any export nothing imports.
 */
interface EmoSelection {
  iso3: string;
  cat: string;
}

interface LabelEntry {
  iso3: string;
  cat: string;
  /** Unit direction on the unrotated globe. */
  dir: THREE.Vector3;
  el: HTMLElement;
  nativeEl: HTMLElement;
  englishEl: HTMLElement;
  /** The two English strings a label can show, so `englishText` switches without a rebuild. */
  englishCategory: string;
  englishGloss: string;
  score: number;
  /** Rank by score, 0 = strongest. Used by the density cap. */
  rank: number;
  hasNative: boolean;
  /** Per-label language override set by clickMode "toggleLanguage". */
  toggled: boolean;
  visible: boolean;

  /** Screen position written this frame, in CSS pixels. The declutter sweep reads these. */
  sx: number;
  sy: number;
  /** Whether the facing and density tests passed this frame, so the sweep should consider it. */
  candidate: boolean;
  /** Bit 1 = native line drawn, bit 2 = English line drawn. Identifies which box was measured. */
  lines: number;
  measuredLines: number;
  measuredFontPx: number;
  /** Measured box size in CSS pixels, valid for `measuredLines` at `measuredFontPx`. */
  boxW: number;
  boxH: number;
  /** Eased toward the sweep's 0 or 1 decision, so a decluttered label fades out of the way. */
  declutterAlpha: number;
  declutterTarget: number;
}

export interface EmoLabelLayer {
  /** Call once per frame, after globe.tick(). */
  update(): void;
  setParams(next: EmoViewParams): void;
  destroy(): void;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (v: number): number => v * v * (3 - 2 * v);
/** 0 at `from`, 1 at `to`, eased. Works whether `from` is above or below `to`. */
const ramp = (value: number, from: number, to: number): number =>
  smoothstep(clamp01((value - from) / (to - from || 1)));

/**
 * How often the declutter sweep runs, in milliseconds.
 *
 * The overlap test is quadratic in the candidate labels, roughly 10k box comparisons at this
 * camera. That is nothing ten times a second and wasteful a hundred and twenty times a second,
 * and the globe rotates by about a tenth of a degree between sweeps, so nothing is missed.
 */
const DECLUTTER_SWEEP_MS = 100;
/** How long a label takes to fade out of, or back into, the decluttered set. */
const DECLUTTER_FADE_MS = 180;
/** Below this the label is not painted, which also stops it swallowing clicks meant for others. */
const DECLUTTER_ALPHA_MIN = 0.01;

/**
 * Build the label layer. Resolves once country centroids are loaded, since every label needs
 * a lat/lng and the centroid table is fetched lazily.
 */
export async function createEmoLabelLayer(options: {
  host: HTMLElement;
  globe: GlobeView;
  data: EmoData;
  params: EmoViewParams;
  /**
   * Fired when `clickMode: "selectNetwork"` changes the selection. The layer owns the selection,
   * because it owns the click; the arc layer and the country fill are told through this.
   */
  onSelect?: (selection: EmoSelection | null) => void;
  /** Fired when `clickMode: "reshuffleNetwork"` asks for a different random world network. */
  onReshuffle?: () => void;
}): Promise<EmoLabelLayer> {
  const { host, globe, data } = options;
  let params = options.params;

  await ensureCountryCentroidsLoaded();

  const categoryLabel = new Map(data.categories.map((c) => [c.key, c.label]));
  const categoryFamily = new Map(data.categories.map((c) => [c.key, c.family]));

  const ranked = Object.entries(data.countries).sort((a, b) => b[1].score - a[1].score);
  const entries: LabelEntry[] = [];
  let missingCentroid = 0;

  ranked.forEach(([iso3, country], rank) => {
    const centroid = getCountryCentroid(iso3);
    if (!centroid) {
      missingCentroid += 1;
      return;
    }
    const englishCategory = categoryLabel.get(country.cat) ?? country.cat;
    const englishGloss = country.en;
    const hasNative = country.term.length > 0;

    const el = document.createElement("div");
    el.className = `emo-label emo-sc-${country.script}`;
    el.dataset.iso3 = iso3;
    el.dataset.cat = country.cat;
    el.dataset.family = categoryFamily.get(country.cat) ?? "";
    el.title = `${country.name}: ${englishCategory}\n${
      hasNative ? `${country.term} (${country.langEn}): ${country.en}` : "no term in this language; showing English"
    }`;

    const nativeEl = document.createElement("div");
    nativeEl.className = "emo-label__native";
    nativeEl.textContent = country.term;

    const englishEl = document.createElement("div");
    englishEl.className = "emo-label__english";

    el.append(nativeEl, englishEl);
    host.appendChild(el);

    entries.push({
      iso3,
      cat: country.cat,
      dir: latLngToVector3(centroid.lat, centroid.lng, 1).normalize(),
      el,
      nativeEl,
      englishEl,
      englishCategory,
      englishGloss,
      score: country.score,
      rank,
      hasNative,
      toggled: false,
      visible: false,
      sx: 0,
      sy: 0,
      candidate: false,
      lines: 0,
      measuredLines: -1,
      measuredFontPx: -1,
      boxW: 0,
      boxH: 0,
      declutterAlpha: 1,
      declutterTarget: 1,
    });
  });

  if (missingCentroid > 0) {
    console.warn(`[emoLabelLayer] ${missingCentroid} countries have no centroid and are not drawn`);
  }

  /**
   * Write the English strings. Called once at build time and again whenever `englishText`
   * changes, so the switch costs 195 text writes rather than a rebuild of the whole layer.
   *
   * A country whose winning category is a declared lexicon gap has no native term, so its
   * "native" line carries English too and has to follow the same switch.
   */
  function applyEnglishText(): void {
    for (const entry of entries) {
      const english = params.englishText === "gloss" ? entry.englishGloss : entry.englishCategory;
      entry.englishEl.textContent = english;
      if (!entry.hasNative) entry.nativeEl.textContent = english;
    }
  }

  applyEnglishText();
  // Colour is opt-in (decision 3). The host attribute selects a palette; see emo.css.
  host.dataset.colour = params.colourMode;

  let selected: string | null = null;

  const onClick = (ev: MouseEvent): void => {
    if (params.clickMode === "off") return;
    const target = (ev.target as HTMLElement).closest(".emo-label");
    if (!target) return;
    const entry = entries.find((e) => e.el === target);
    if (!entry) return;
    ev.stopPropagation();
    if (params.clickMode === "toggleLanguage") {
      entry.toggled = !entry.toggled;
      return;
    }
    if (params.clickMode === "reshuffleNetwork") {
      options.onReshuffle?.();
      return;
    }
    // Clicking the selected country again clears the selection, so there is always a way out
    // without hunting for empty globe between 195 labels.
    selected = selected === entry.iso3 ? null : entry.iso3;
    options.onSelect?.(selected === null ? null : { iso3: entry.iso3, cat: entry.cat });
  };
  host.addEventListener("click", onClick);

  const world = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  let lastFontPx = -1;
  let lastSecondScale = -1;

  /**
   * Set whenever anything that changes a label's measured box changes: a parameter, the English
   * strings, or a font subset arriving after first paint. Resetting `lastFontPx` cannot stand in
   * for this, because update() restores it to the same quantised value before a sweep reads it.
   */
  let measureDirty = true;
  /** One log line per view rather than ten a second, so the drawn count can be compared. */
  let logNextSweep = true;
  let lastFrameMs = -1;
  let lastSweepMs = -1;

  // A script subset that arrives after first paint changes every box in that script, and nothing
  // else would notice: those widths were measured against the fallback face.
  const onFontsLoaded = (): void => {
    measureDirty = true;
  };
  document.fonts.addEventListener("loadingdone", onFontsLoaded);

  /**
   * Hide every candidate whose screen box collides with one already kept, strongest score first.
   *
   * Greedy in a fixed priority order, which is what keeps the result steady as the globe turns:
   * the same geometry always yields the same set. Labels are never moved, only hidden, because a
   * label that slides on every frame of a rotation reads as jitter rather than as placement.
   *
   * Measuring is the only expensive part, so it happens here, at the sweep rate, and only when a
   * box could actually have changed. Nothing else in this module calls getBoundingClientRect.
   */
  function declutterSweep(): void {
    // Every box measures zero while the host is not rendered, and a zero box collides with
    // nothing, so sweeping then would silently clear the whole set.
    if (host.getBoundingClientRect().width === 0) return;

    const candidates = entries.filter((e) => e.candidate);
    const stale =
      measureDirty ||
      candidates.some((e) => e.measuredLines !== e.lines || e.measuredFontPx !== lastFontPx);
    if (stale) {
      // One forced layout, then cheap reads: no style is written inside this loop.
      for (const entry of candidates) {
        const rect = entry.el.getBoundingClientRect();
        entry.boxW = rect.width;
        entry.boxH = rect.height;
        entry.measuredLines = entry.lines;
        entry.measuredFontPx = lastFontPx;
      }
      measureDirty = false;
    }

    const pad = params.declutterPad;
    const kept: LabelEntry[] = [];
    // The selected country is never decluttered away, so it goes first and wins every collision.
    const chosen = selected === null ? undefined : candidates.find((e) => e.iso3 === selected);
    if (chosen) {
      chosen.declutterTarget = 1;
      kept.push(chosen);
    }
    let hidden = 0;
    for (const entry of candidates) {
      if (entry === chosen) continue;
      let clash = false;
      for (const other of kept) {
        if (
          Math.abs(entry.sx - other.sx) < (entry.boxW + other.boxW) / 2 + pad &&
          Math.abs(entry.sy - other.sy) < (entry.boxH + other.boxH) / 2 + pad
        ) {
          clash = true;
          break;
        }
      }
      entry.declutterTarget = clash ? 0 : 1;
      if (clash) hidden += 1;
      else kept.push(entry);
    }

    if (logNextSweep) {
      logNextSweep = false;
      console.info(
        `[emoLabels] declutter=priority pad=${pad}px, ${candidates.length} candidates, ` +
          `${kept.length} drawn, ${hidden} hidden`,
      );
    }
  }

  function update(): void {
    const camera = globe.camera;
    const canvas = globe.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;

    const spin = globe.earthContent.rotation.y;
    const sinY = Math.sin(spin);
    const cosY = Math.cos(spin);

    const camLen = camera.position.length();
    // 0 when the camera is far, 1 when it is at the near stop.
    const near = ramp(camLen, params.cameraFar, params.cameraNear);
    const standoff = params.standoffFar + (params.standoffNear - params.standoffFar) * near;
    const fontPx = params.fontPxFar + (params.fontPxNear - params.fontPxFar) * near;

    // One style write drives every label's size, so zooming costs no per-label layout.
    const quantised = Math.round(fontPx * 4) / 4;
    if (quantised !== lastFontPx) {
      host.style.setProperty("--emo-font-px", `${quantised}px`);
      lastFontPx = quantised;
    }
    if (params.secondLineScale !== lastSecondScale) {
      host.style.setProperty("--emo-second-scale", String(params.secondLineScale));
      lastSecondScale = params.secondLineScale;
    }

    camDir.copy(camera.position).normalize();
    const focalCos = Math.cos((params.focalConeDeg * Math.PI) / 180);
    const focalOuterCos = Math.cos(((params.focalConeDeg + params.focalBlendDeg) * Math.PI) / 180);
    const cap = params.density > 0 ? params.density : Number.POSITIVE_INFINITY;

    const now = performance.now();
    // Wall-clock, so the fade takes the same time at 60 Hz as at 120. The first frame snaps.
    const fadeStep = lastFrameMs < 0 ? 1 : Math.min(1, (now - lastFrameMs) / DECLUTTER_FADE_MS);
    lastFrameMs = now;
    const declutterOn = params.declutterMode === "priority";

    for (const entry of entries) {
      const { dir, el } = entry;
      // Rotate the direction by the globe's spin, then project.
      const x = dir.x * cosY + dir.z * sinY;
      const z = -dir.x * sinY + dir.z * cosY;
      const facing = x * camDir.x + dir.y * camDir.y + z * camDir.z;
      entry.candidate = facing >= params.facingMin && entry.rank < cap;

      if (!entry.candidate) {
        if (entry.visible) {
          el.style.visibility = "hidden";
          entry.visible = false;
        }
        continue;
      }

      // Projected and laid out even while fully faded away, because the sweep needs a current
      // box and position to decide whether this label can come back.
      world.set(x * standoff, dir.y * standoff, z * standoff).project(camera);
      const sx = (world.x * 0.5 + 0.5) * w;
      const sy = (-world.y * 0.5 + 0.5) * h;
      entry.sx = sx;
      entry.sy = sy;

      // Which language this label shows right now.
      let showNative: boolean;
      let showEnglish: boolean;
      switch (params.labelMode) {
        case "english":
          showNative = false;
          showEnglish = true;
          break;
        case "native":
          showNative = entry.hasNative;
          showEnglish = !entry.hasNative;
          break;
        case "bilingual":
          showNative = entry.hasNative;
          showEnglish = true;
          break;
        case "focal": {
          // Inside the camera-axis cone the label reads in English; outside it reverts to native.
          const inFocus = ramp(facing, focalOuterCos, focalCos);
          showEnglish = inFocus > 0.5 || !entry.hasNative;
          showNative = !showEnglish;
          break;
        }
      }
      // The selected country reads in both languages, whatever the mode is doing elsewhere.
      if (entry.iso3 === selected) {
        showNative = entry.hasNative;
        showEnglish = true;
      }
      // A click swaps which single language this label shows, and a second click swaps it back.
      // When the mode already shows both lines there is nothing to swap.
      if (entry.toggled && showNative !== showEnglish) {
        const wasNative: boolean = showNative;
        showNative = showEnglish && entry.hasNative;
        showEnglish = wasNative || !entry.hasNative;
      }

      entry.nativeEl.style.display = showNative ? "" : "none";
      entry.englishEl.style.display = showEnglish ? "" : "none";
      entry.englishEl.classList.toggle("emo-label__english--secondary", showNative && showEnglish);
      entry.lines = (showNative ? 1 : 0) | (showEnglish ? 2 : 0);

      const goal = declutterOn ? entry.declutterTarget : 1;
      entry.declutterAlpha += (goal - entry.declutterAlpha) * fadeStep;

      // One decision, one writer. Nothing else in this loop touches visibility, so the facing
      // cull and the declutter cannot end up fighting over the same style.
      const paint = entry.declutterAlpha > DECLUTTER_ALPHA_MIN;
      if (paint !== entry.visible) {
        el.style.visibility = paint ? "visible" : "hidden";
        entry.visible = paint;
      }
      if (!paint) continue;

      const fade = ramp(facing, params.facingMin, params.fadeStart);
      const grey = 1 - params.edgeDesaturation * (1 - fade);
      // Dimming and the declutter fade multiply into the limb fade rather than fighting it:
      // opacity is written inline every frame, so a CSS rule for either would never win.
      const dim = selected !== null && entry.iso3 !== selected ? params.selectionDim : 1;
      el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
      el.style.opacity = (fade * dim * entry.declutterAlpha).toFixed(3);
      el.style.setProperty("--emo-grey", grey.toFixed(3));
    }

    if (declutterOn && now - lastSweepMs >= DECLUTTER_SWEEP_MS) {
      lastSweepMs = now;
      declutterSweep();
    }
  }

  return {
    update,
    setParams(next: EmoViewParams): void {
      const englishChanged = next.englishText !== params.englishText;
      // A preset that does not select must not leave a stale selection dimming the globe.
      if (next.clickMode !== "selectNetwork" && selected !== null) {
        selected = null;
        options.onSelect?.(null);
      }
      params = next;
      // Only on change: a slider drag calls this every input event, and 195 text writes per
      // tick would be felt.
      if (englishChanged) applyEnglishText();
      host.dataset.colour = next.colourMode;
      lastFontPx = -1;
      lastSecondScale = -1;
      // Any of these can change a box, and the next sweep is the only place that can find out.
      measureDirty = true;
      logNextSweep = true;
    },
    destroy(): void {
      host.removeEventListener("click", onClick);
      document.fonts.removeEventListener("loadingdone", onFontsLoaded);
      for (const entry of entries) entry.el.remove();
      entries.length = 0;
    },
  };
}
