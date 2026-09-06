/**
 * App entry — wires production UI chrome to GlobeView and pain-server (or dev mock).
 *
 * Data flow (production):
 *   layer button → fetchPoints(layer) → api/client → GET /init/:layer → adapter → globe.setMarkers()
 *
 * Dev:
 *   npm run dev              — mock CSV API (Vite /api proxy)
 *   npm run dev:pain-server  — real backend on :3000 (Vite /init proxy)
 *
 * Globe debug UI is opt-in only (?globeDebug=1 or localStorage pain-globe-debug=1).
 */
import "./style.css";
import { fetchLayers, fetchPoints } from "./api/client";
import { getCountryCentroid } from "./api/countryCentroids";
import {
  METRICS_KIND_LAYER,
  trackToggle,
} from "./api/metricsApi";
import { getMapLayerById, isChoroplethMapLayer, resolveLayerLexiconBucket } from "./api/layers";
import type { MapLayer, PainPoint } from "./types/api";
import {
  GlobeView,
  type GlobeLayerDisplayMeta,
  type MarkerHoverInfo,
  type MultiplexHoverInfo,
  PAIN_VIZ_MODE,
  type PainVisualizationMode,
  type WordCloudHoverInfo,
} from "./globe/GlobeView";
import type { VisualTheme } from "./globe/layerTextures";
import { isDebugScarVisual } from "./globe/debugScarVisual";
import {
  mountGlobeDebugPanel,
  shouldShowGlobeDebugPanel,
} from "./globe/globeDebugPanel";
import { SurveyModal } from "./survey/SurveyModal";
import { flyGlobeToLatLng } from "./survey/globeFlyTo";
import {
  hideSurveyLoadingOverlay,
  showSurveyLoadingOverlay,
} from "./survey/surveyLoadingOverlay";
import {
  hideSurveyResultModal,
  showSurveyResultModal,
} from "./survey/surveyResultModal";
import { type SurveySubmissionPayload } from "./survey/surveyData";
import { submitSurvey } from "./survey/surveyApi";
import { showConsentModal } from "./survey/consentModal";
import { initBackgroundMusic } from "./sound/backgroundMusic";
import {
  mountProductionChrome,
  type ProductionChrome,
} from "./ui/productionChrome";
import { playPainSound } from "./sound/soundEngine";
import { hideLegend, showLegend } from "./ui/legend";
import { installTextSelectionGuard } from "./ui/textSelectionGuard";
import "./emo/emo.css";
import { loadEmoData } from "./emo/emoData";
import { createEmoLabelLayer, type EmoLabelLayer } from "./emo/labelLayer";
import { createEmoArcLayer, type EmoArcLayer } from "./emo/arcs";
import { createEmoSelectionLayer, type EmoSelectionLayer } from "./emo/selection";
import { createEmoLeaderLineLayer, type EmoLeaderLineLayer } from "./emo/leaderLines";
import { createEmoSelectionMotion, type EmoSelectionMotion } from "./emo/selectionMotion";
import type { EmoViewParams } from "./emo/viewParams";
import { createEmoLegend, type EmoLegendLayer } from "./emo/legend";
import {
  shouldShowEmoViews,
  shouldOpenEmoPanel,
  resolveEmoViewFromUrl,
  applyEmoCaptureOverrides,
} from "./emo/emoViewConfig";
import { findEmoPreset, type EmoPreset } from "./emo/viewPresets";
import { mountEmoViewPanel } from "./ui/emoViewPanel";
import type { CountryProfileRuntime } from "./countryProfile/runtime";
import type { CountryPresentation } from "./countryProfile/presentation";

const THEME_STORAGE_KEY = "pain-ui-theme";

const canvas = document.querySelector<HTMLCanvasElement>("#globe");
const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const wordCloudToggle = document.querySelector<HTMLButtonElement>("#word-cloud-toggle");

if (!canvas || !statusEl || !wordCloudToggle) {
  throw new Error("Missing DOM nodes");
}

const hudStatus = statusEl;
let lastLayerId = "";
let currentPainVizMode: PainVisualizationMode = PAIN_VIZ_MODE.scars;
let chrome: ProductionChrome | null = null;
/** Layer list from last successful fetchLayers (for all-layers Promise.all). */
let cachedLayers: MapLayer[] = [];
/**
 * Session cache of fetched layer points (layerId → PainPoint[]).
 * Cleared on page reload; never invalidated mid-session (pain-server data is stable within a visit).
 */
const pointCache = new Map<string, PainPoint[]>();
/** True while concurrent multi-layer visuals are shown. */
let showAllLayersActive = false;
/** In-flight {@link loadPoints} fetch; aborted on the next layer switch. */
let loadPointsAbortController: AbortController | null = null;
/** Idle time before applying a layer switch; coalesces rapid clicks to avoid WebGL context loss. */
const LAYER_CHANGE_DEBOUNCE_MS = 150;
/** Debounced {@link applyPendingLayerChange} timer for rapid layer clicks. */
let pendingLayerChangeTimer: ReturnType<typeof setTimeout> | null = null;
let layerChangeRevision = 0;

const surveyModalHost = document.querySelector<HTMLElement>("#survey-modal");
if (!surveyModalHost) throw new Error("Missing #survey-modal mount");

/** Current pain viz mode (production chrome cycles this; no HUD select). */
function readPainVizMode(): PainVisualizationMode {
  return currentPainVizMode;
}

const wordCloudBtn = wordCloudToggle;
const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("Missing app root");
const appRootEl: HTMLDivElement = appRoot;
// Floating tooltip for multiplex / word-cloud hovers (not in index.html).
const hoverModal = document.createElement("div");
hoverModal.id = "multiplex-hover";
hoverModal.className = "multiplex-hover";
hoverModal.hidden = true;
appRootEl.appendChild(hoverModal);

function readStoredTheme(): VisualTheme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "blue"
      ? "blue"
      : "dark";
  } catch {
    return "blue";
  }
}

function getInitialTheme(): VisualTheme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === null
      ? "blue"
      : readStoredTheme();
  } catch {
    return "blue";
  }
}

function persistTheme(theme: VisualTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
}

const initialTheme = getInitialTheme();
document.documentElement.dataset.theme = initialTheme;

if (isDebugScarVisual()) {
  document.documentElement.dataset.scarDebug = "true";
}

// The page is dragged and looked at, not read. `body { user-select: none }` states that and
// browsers enforce it only for gestures they consider the user's own, so Select All still
// marks the words in some of them. See ui/textSelectionGuard.ts.
installTextSelectionGuard();

// --- Globe + optional debug panel (see index.html) ---
const globe = new GlobeView(canvas);
const scarMapPreview = document.querySelector<HTMLCanvasElement>(
  "#scar-map-preview",
);
const globeDebugHost = document.querySelector<HTMLElement>("#globe-debug-panel");
const globeDebugToggle = document.querySelector<HTMLButtonElement>(
  "#globe-debug-toggle",
);

let postSubmitRunning = false;

async function runPostSubmitSequence(payload: SurveySubmissionPayload): Promise<void> {
  if (postSubmitRunning) return;
  postSubmitRunning = true;
  const overlayHost = appRootEl;
  try {
    showSurveyLoadingOverlay(overlayHost);
    const res = await submitSurvey(payload);
    await hideSurveyLoadingOverlay();
    if (!res) {
      console.warn("[main] Survey submission failed; skipping post-submit fly-to.");
      return;
    }
    globe.setAutoSpinEnabled(false);
    // Assumption: `submitSurvey` returns pain-server coordinates as `{ lat, lng }` (see surveyApi.ts).
    const resultLat = res.lat;
    const resultLng = res.lng;
    await flyGlobeToLatLng(
      globe.camera,
      globe.controls,
      resultLat,
      resultLng,
      globe.earthContent,
    );
    const removeSurfaceMarker = globe.addSurfaceMarker(resultLat, resultLng);
    chrome?.setUiEnabled(false);
    new Audio("/sounds/Results.mp3").play().catch(() => {});
    showSurveyResultModal(overlayHost, {
      lat: resultLat,
      lng: resultLng,
      message: res.text,
      onClose: () => {
        removeSurfaceMarker();
        hideSurveyResultModal();
        globe.setAutoSpinEnabled(true);
        chrome?.setUiEnabled(true);
      },
    });
  } finally {
    postSubmitRunning = false;
  }
}

const surveyModal = new SurveyModal(surveyModalHost, {
  onSurveySubmitted: (payload) => {
    void runPostSubmitSequence(payload);
  },
});

const showGlobeDebugEntry = shouldShowGlobeDebugPanel();
let globeDebugMounted = false;

function setGlobeDebugPanelOpen(open: boolean): void {
  if (!globeDebugHost || !globeDebugToggle) return;
  if (open) {
    globeDebugHost.hidden = false;
    if (scarMapPreview) scarMapPreview.hidden = false;
    if (!globeDebugMounted) {
      mountGlobeDebugPanel(globe, globeDebugHost, scarMapPreview);
      globeDebugMounted = true;
    }
    globeDebugToggle.setAttribute("aria-expanded", "true");
  } else {
    globeDebugHost.hidden = true;
    if (scarMapPreview) scarMapPreview.hidden = true;
    globeDebugToggle.setAttribute("aria-expanded", "false");
  }
}

function isGlobeDebugHotkey(ev: KeyboardEvent): boolean {
  if (!ev.shiftKey || ev.code !== "KeyG") return false;
  // Mac: Option+Shift+G; also Cmd+Shift+G (common expectation on macOS).
  return ev.altKey || ev.metaKey;
}

function globeDebugHotkeyTargetIgnoresShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.closest("[contenteditable=true]")) return true;
  return false;
}

if (globeDebugToggle && globeDebugHost && showGlobeDebugEntry) {
  globeDebugToggle.hidden = false;
  globeDebugToggle.title =
    "Toggle globe debug (Option+Shift+G or Cmd+Shift+G on Mac)";
  globeDebugToggle.addEventListener("click", () => {
    setGlobeDebugPanelOpen(globeDebugHost.hidden);
  });
  window.addEventListener("keydown", (ev) => {
    if (!isGlobeDebugHotkey(ev)) return;
    if (globeDebugHotkeyTargetIgnoresShortcut(ev.target)) return;
    ev.preventDefault();
    setGlobeDebugPanelOpen(globeDebugHost.hidden);
  });
} else if (!showGlobeDebugEntry && isDebugScarVisual() && scarMapPreview) {
  globe.setScarMapPreviewCanvas(scarMapPreview);
}
globe.setVisualTheme(initialTheme);
globe.setGlobeDisplayMode("points");
globe.setPainVisualizationMode(currentPainVizMode);
let wordCloudEnabled = false;
globe.setWordCloudEnabled(wordCloudEnabled);

// --- Production chrome event handlers ---
function syncThemeToggle(themeBtn: HTMLButtonElement): void {
  const t = document.documentElement.dataset.theme === "blue" ? "blue" : "dark";
  themeBtn.textContent = "blue mode";
  themeBtn.removeAttribute("aria-label");
  themeBtn.setAttribute("aria-pressed", t === "blue" ? "true" : "false");
}

function wireThemeToggle(themeBtn: HTMLButtonElement): void {
  syncThemeToggle(themeBtn);
  themeBtn.addEventListener("click", () => {
    const next: VisualTheme =
      document.documentElement.dataset.theme === "blue" ? "dark" : "blue";
    document.documentElement.dataset.theme = next;
    persistTheme(next);
    globe.setVisualTheme(next);
    syncThemeToggle(themeBtn);
  });
}

function getCurrentMapLayer(): MapLayer | undefined {
  return getMapLayerById(lastLayerId);
}

function currentLayerSupportsWordCloud(): boolean {
  return getCurrentMapLayer()?.text === true;
}

/** Turn off word clouds when the selected layer has no text metadata; sync button state. */
function syncWordCloudForCurrentLayer(): void {
  if (!currentLayerSupportsWordCloud() && wordCloudEnabled) {
    wordCloudEnabled = false;
    globe.setWordCloudEnabled(false);
  }
  syncWordCloudToggle();
}

function syncWordCloudToggle(): void {
  const supportsText = currentLayerSupportsWordCloud();
  wordCloudBtn.disabled = !supportsText;
  wordCloudBtn.setAttribute("aria-disabled", supportsText ? "false" : "true");
  wordCloudBtn.textContent = wordCloudEnabled
    ? "Word clouds: On"
    : "Word clouds: Off";
  wordCloudBtn.setAttribute("aria-pressed", wordCloudEnabled ? "true" : "false");
}

syncWordCloudToggle();

wordCloudBtn.addEventListener("click", () => {
  wordCloudEnabled = !wordCloudEnabled;
  globe.setWordCloudEnabled(wordCloudEnabled);
  syncWordCloudToggle();
});

/** HTML for the floating tooltip when hovering a multiplex node or cluster. */
function renderMultiplexHover(info: MultiplexHoverInfo): string {
  if (info.kind === "node") {
    if (info.metadata) {
      const year = info.metadata.year ? ` (${info.metadata.year})` : "";
      const source = info.metadata.sourceUrl.length > 42
        ? `${info.metadata.sourceUrl.slice(0, 39)}...`
        : info.metadata.sourceUrl;
      return `${info.metadata.country} · ${info.metadata.layerLabel} · ${info.metadata.metricLabel} ${info.metadata.rawValue.toFixed(1)}${year} · intensity ${info.intensity.toFixed(2)} · source ${source}`;
    }
    const fallbackLabel =
      // MultiplexNodeHover.type is a hover tooltip field, not a PainPoint property. Kept separate from the uiLayer rename intentionally.
      info.type[0]?.toUpperCase() + info.type.slice(1).toLowerCase();
    return `${fallbackLabel} · intensity ${info.intensity.toFixed(2)} · source user submission`;
  }
  return `<strong>Cluster beacon</strong><br/>${info.count} nearby points<br/>Avg intensity ${info.avgIntensity.toFixed(2)}`;
}

/** HTML for the floating tooltip when hovering a pain marker (debug-only). */
function renderMarkerHover(info: MarkerHoverInfo): string {
  return `<strong>${info.layerId}</strong><br/>Intensity ${info.intensity.toFixed(3)}<br/>Lat ${info.lat.toFixed(2)}, Lng ${info.lng.toFixed(2)}<br/>${info.category}`;
}

/** HTML for the floating tooltip when hovering a text-layer word-cloud sprite. */
function renderWordCloudHover(info: WordCloudHoverInfo): string {
  const msg = info.fullText.length > 220
    ? `${info.fullText.slice(0, 217)}...`
    : info.fullText;
  return `<strong>${info.country}</strong><br/>${info.shortLabel}<br/>${msg}`;
}

/** Pixel offset from cursor when positioning the floating hover tooltip (avoids covering the pointer). */
const HOVER_TOOLTIP_OFFSET_X = 14;
const HOVER_TOOLTIP_OFFSET_Y = 12;
/** Max pointer travel (px) between down and up to count as a click rather than an orbit drag. */
const CLICK_MAX_MOVE_PX = 5;
/**
 * When false, globe click-to-sound listeners are not registered.
 * Flip to true to re-enable the soft bell on pain-point clicks.
 */
const SOUND_ENABLED = false;

canvas.addEventListener("pointermove", (ev) => {
  if (wordCloudEnabled && currentLayerSupportsWordCloud()) {
    const w = globe.pickWordCloudHover(ev.clientX, ev.clientY);
    if (w) {
      hoverModal.hidden = false;
      hoverModal.innerHTML = renderWordCloudHover(w);
      hoverModal.style.left = `${ev.clientX + HOVER_TOOLTIP_OFFSET_X}px`;
      hoverModal.style.top = `${ev.clientY + HOVER_TOOLTIP_OFFSET_Y}px`;
      return;
    }
  }
  if (
    shouldShowGlobeDebugPanel() &&
    readPainVizMode() === PAIN_VIZ_MODE.points
  ) {
    const marker = globe.pickMarkerHover(ev.clientX, ev.clientY);
    if (marker) {
      hoverModal.hidden = false;
      hoverModal.innerHTML = renderMarkerHover(marker);
      hoverModal.style.left = `${ev.clientX + HOVER_TOOLTIP_OFFSET_X}px`;
      hoverModal.style.top = `${ev.clientY + HOVER_TOOLTIP_OFFSET_Y}px`;
      return;
    }
  }
  if (readPainVizMode() !== PAIN_VIZ_MODE.multiplexV0) {
    hoverModal.hidden = true;
    return;
  }
  const info = globe.pickMultiplexHover(ev.clientX, ev.clientY);
  if (!info) {
    hoverModal.hidden = true;
    return;
  }
  hoverModal.hidden = false;
  hoverModal.innerHTML = renderMultiplexHover(info);
  hoverModal.style.left = `${ev.clientX + HOVER_TOOLTIP_OFFSET_X}px`;
  hoverModal.style.top = `${ev.clientY + HOVER_TOOLTIP_OFFSET_Y}px`;
});

canvas.addEventListener("pointerleave", () => {
  hoverModal.hidden = true;
});

/** Pointer down position for click-vs-drag detection on the globe canvas. */
let pointerDownPos: { x: number; y: number } | null = null;
let lastSoundTime = 0;

if (SOUND_ENABLED) {
  canvas.addEventListener("pointerdown", (ev) => {
    pointerDownPos = { x: ev.clientX, y: ev.clientY };
  });

  /**
   * Click-in-place on the globe: play a soft bell for pain at the pointer.
   * Points mode uses exact marker pick (any hit); scars/multiplex sample scar
   * dent strength and only play when a pain point is nearby.
   * Ignores orbit drags (pointer moved more than {@link CLICK_MAX_MOVE_PX}).
   */
  canvas.addEventListener("pointerup", (ev) => {
    if (!pointerDownPos) return;
    const dx = Math.abs(ev.clientX - pointerDownPos.x);
    const dy = Math.abs(ev.clientY - pointerDownPos.y);
    pointerDownPos = null;
    if (dx > CLICK_MAX_MOVE_PX || dy > CLICK_MAX_MOVE_PX) return;
    if (Date.now() - lastSoundTime < 300) return;

    if (readPainVizMode() === PAIN_VIZ_MODE.points) {
      const hit = globe.pickMarkerHover(ev.clientX, ev.clientY);
      if (!hit) return;
      playPainSound(hit.intensity, hit.layerId);
      lastSoundTime = Date.now();
      return;
    }

    const scarIntensity = globe.sampleScarAtClick(ev.clientX, ev.clientY);
    if (scarIntensity === null) return;
    if (!globe.pickNearestPainPoint(ev.clientX, ev.clientY)) return;
    if (!lastLayerId) return;
    playPainSound(scarIntensity, lastLayerId);
    lastSoundTime = Date.now();
  });
}

function setStatus(msg: string): void {
  hudStatus.textContent = msg;
}

/** Stipple tint overrides for known layers; unknown ids use GET /init `color`. */
const LAYER_STIPPLE_COLOR_OVERRIDES: Record<string, string> = {
  emopain: "#6B15CE",
  envpain: "#00674F",
  physpain: "#FF0000",
  socioecopain: "#FFFF00",
};

// The country profile is its own experiment, but it reuses the chosen emotional view without
// exposing the old views panel. Its implementation stays behind a dynamic import below.
const countryProfileEnabled = ["1", "true"].includes(
  new URLSearchParams(window.location.search).get("cp") ?? "",
);
const emoViewControlsEnabled = shouldShowEmoViews();
const emoViewsEnabled = emoViewControlsEnabled || countryProfileEnabled;
const emoLabelHost = document.querySelector<HTMLElement>("#emo-label-host");
const emoPanelHost = document.querySelector<HTMLElement>("#emo-view-panel");
const emoPanelToggle = document.querySelector<HTMLButtonElement>("#emo-view-toggle");
const emoLegendHost = document.querySelector<HTMLElement>("#emo-legend");
let emoLabelLayer: EmoLabelLayer | null = null;
let emoLegend: EmoLegendLayer | null = null;
let emoArcLayer: EmoArcLayer | null = null;
let emoLeaderLineLayer: EmoLeaderLineLayer | null = null;
let emoSelectionLayer: EmoSelectionLayer | null = null;
let emoMotion: EmoSelectionMotion | null = null;
const emoView = resolveEmoViewFromUrl();
let emoPreset: EmoPreset | undefined = findEmoPreset(emoView.presetId);
let emoParams = emoView.params;
let emoPanel: { setParam: (key: "randomSeed", value: number) => void } | null = null;
let countryProfileRuntime: CountryProfileRuntime | null = null;
let countryProfileRuntimeReady: Promise<void> | null = null;
let countryPresentation: CountryPresentation | null = null;
let preserveCountryProfileOnEmoClear = false;
let presentationBaseParams: EmoViewParams | null = null;

/** Whole globe words fade behind visible chrome, using the label layer's existing box sweep. */
function countryChromeRects(): readonly DOMRectReadOnly[] {
  return [...document.querySelectorAll<HTMLElement>(
    "#ui-title, #ui-layer-stack, #ui-share-pain, #ui-bottom-left, #ui-legend, #emo-legend, #country-profile",
  )].flatMap((element) => {
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || Number(style.opacity) <= 0.01) return [];
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 &&
      rect.left < innerWidth && rect.top < innerHeight ? [rect] : [];
  });
}

function applyCountryProfileGlobePreset(layerId: string): void {
  const preset = countryProfileRuntime?.preset;
  const quality = countryProfileRuntime?.quality?.settings;
  emoLabelLayer?.setOcclusionRects(preset?.chromeOcclusion ? countryChromeRects : null);
  document.getElementById("emo-legend")?.toggleAttribute(
    "data-soft-halo",
    preset?.emotionalLegendHalo === true,
  );
  globe.setRoundedScarShoulder(preset?.roundedScarShoulder ?? false);
  globe.setScarDepthStyle(preset?.scarDepthStyle ?? "none");
  globe.setEnvironmentalAtmosphere(preset?.atmosphereMode ?? "control",
    quality?.samples ?? preset?.atmosphereSamples ?? 32,
    quality?.fraction ?? preset?.atmosphereFraction ?? 0.5);
  globe.setSocioeconomicStyle(preset?.socioeconomicStyle ?? null,
    countryProfileRuntime?.socioeconomicMinimum ?? 0, preset?.socioeconomicPatternContrast ?? 0.25,
    preset?.socioeconomicMissingStyle);
  globe.setSurfaceDetail(preset?.surfaceDetail ?? 1);
  void globe.setCountryContourRounding(preset?.countryContourDegrees ?? null);
  emoSelectionLayer?.setPeerStrength(preset?.selectionPeerStrength ?? null);
  const physical = layerId === "physpain" || layerId === "all-layers";
  const enhancedStipple = physical || preset?.stippleAllLayers === true;
  globe.setStippleContextOpacity(layerId === "envpain" ? preset?.environmentalContextOpacity ?? 1 :
    layerId === "socioecopain" ? preset?.socioeconomicContextOpacity ?? 1 : 1);
  globe.setStippleDetailCapacity(quality?.capacity ?? 131_072);
  globe.setStipplePointCount(preset?.stipplePointCount ?? 82_000);
  const detail = preset?.physicalDetail ?? "fixed";
  globe.setStippleDetailMode(enhancedStipple ?
    quality && (detail === "split1" || detail === "split2") ? quality.detail : detail : "fixed");
  globe.setStipplePointTune({
    scale: enhancedStipple ? preset?.physicalPointScale ?? 1 : 1,
    nearBoost: enhancedStipple ? preset?.physicalPointNearBoost ?? 0 : 0,
  });
  globe.setEnvironmentalFieldPattern(
    preset?.environmentalFieldPattern ?? "smooth",
  );
}

function applyEmoParams(next: EmoViewParams): void {
  emoParams = next;
  emoLabelLayer?.setParams(next);
  emoArcLayer?.setParams(next);
  emoLeaderLineLayer?.setParams(next);
  emoSelectionLayer?.setParams(next);
  emoLegend?.setParams(next);
  emoMotion?.setParams(next);
}

function setPresentationTiming(active: boolean, timeScale: number): void {
  if (!active) {
    if (presentationBaseParams) applyEmoParams(presentationBaseParams);
    presentationBaseParams = null;
    return;
  }
  if (!presentationBaseParams) presentationBaseParams = { ...emoParams };
  const preset = countryProfileRuntime?.preset;
  const factor = (preset?.cycle?.motionScale ?? (preset?.refinement ? 1.5 : 3)) * timeScale;
  applyEmoParams({
    ...presentationBaseParams,
    selectionMotionMs: presentationBaseParams.selectionMotionMs * factor,
    selectionLeaderMs: presentationBaseParams.selectionLeaderMs * factor,
    selectionSpreadMs: presentationBaseParams.selectionSpreadMs * factor,
  });
}

/**
 * Show the DOM label views for the emotional layer and for all-layers mode, and suppress the
 * incumbent sprite word cloud while they are up so the two never draw at once.
 * Other single layers keep their existing visuals untouched.
 *
 * The control preset is the incumbent word cloud, so it inverts the pair: sprites on, DOM
 * labels hidden. This runs after the setWordCloudEnabled calls in applyGlobeLayer and
 * handleAllLayers, so it has the last word.
 */
function syncEmoLayer(layerId: string): void {
  if (!emoViewsEnabled || !emoLabelHost) return;
  const active = layerId === "emopain" || layerId === "all-layers";
  const sprites = active && emoPreset?.useIncumbentSprites === true;
  // Leaving the emotional layer returns the globe to its default state rather than to the state
  // it happened to be left in. Hiding the labels is not enough: the country mark, the network and
  // the leader lines are scene objects, and a selection made here would otherwise still be
  // marking countries on an environmental or physical globe that never asked for it. Coming back
  // therefore starts clean, and the country has to be clicked again.
  if (!active || sprites) {
    preserveCountryProfileOnEmoClear = true;
    try {
      emoLabelLayer?.clearSelection();
    } finally {
      preserveCountryProfileOnEmoClear = false;
    }
    // Snap rather than ease. A layer switch is not a gesture on the globe, and easing it would
    // leave a half-sunk world on screen for anyone who switched back inside the transition.
    emoMotion?.reset();
  }
  emoLabelHost.hidden = !active || sprites;
  // The legend is held to the emotional layer alone, not to all-layers mode. The operator's
  // reason: all-layers is the whole globe at once and the strip is a key to one of its four
  // layers, so it belongs where that layer is the subject. The labels and the network still run
  // in both, which is decision 7 and is not reopened here.
  emoLegend?.setVisible(layerId === "emopain" && !sprites);
  emoArcLayer?.setVisible(active && !sprites);
  emoLeaderLineLayer?.setVisible(active && !sprites);
  // Which globe is underneath decides how far a leader line may reach down. In all-layers mode
  // the base mesh is an invisible depth mask, so a line can be buried below the scar dents and
  // be cut back to the surface; on the emotional layer alone that mesh is hidden and nothing
  // cuts anything, so the same line reaches out of the planet as a spear. See leaderLines.ts.
  emoLeaderLineLayer?.setDepthMasked(layerId === "all-layers");
  if (active) {
    globe.setWordCloudEnabled(sprites);
  }
}

/** Show or hide the views panel, keeping the entry button's aria state in step. */
function setEmoPanelOpen(open: boolean): void {
  if (!emoPanelHost || !emoPanelToggle) return;
  emoPanelHost.hidden = !open;
  emoPanelToggle.setAttribute("aria-expanded", open ? "true" : "false");
}

if (emoViewControlsEnabled && emoPanelHost && emoPanelToggle) {
  emoPanelToggle.hidden = false;
  emoPanelToggle.title = "Toggle emotional pain label views ([ and ] step between them)";
  emoPanelToggle.addEventListener("click", () => setEmoPanelOpen(emoPanelHost.hidden));
}

function handleCountrySurfaceClick(clientX: number, clientY: number): void {
  const runtime = countryProfileRuntime;
  if (!runtime) return;
  countryPresentation?.allowManualMotion();
  const surface = globe.pickSurfaceLatLng(clientX, clientY);
  const iso3 = surface ? runtime.countryAt(surface.lat, surface.lng) : null;
  const emotionalLayer = lastLayerId === "emopain" || lastLayerId === "all-layers";

  if (!iso3) {
    if (emotionalLayer) emoLabelLayer?.clearSelection();
    runtime.clear(true);
    return;
  }
  if (!emotionalLayer) {
    runtime.toggle(iso3, true);
    return;
  }
  if (runtime.selectedIso3 === iso3) emoLabelLayer?.clearSelection();
  else emoLabelLayer?.selectCountry(iso3);
}

async function ensureCountryProfileRuntime(): Promise<void> {
  if (!countryProfileEnabled || countryProfileRuntime) return;
  countryProfileRuntimeReady ??= (async () => {
    const [{ CountryProfileRuntime }, { CountryPresentation }] = await Promise.all([
      import("./countryProfile/runtime"),
      import("./countryProfile/presentation"),
    ]);
    countryProfileRuntime = await CountryProfileRuntime.create(
      pointCache,
      appRootEl,
      lastLayerId,
    );
    const runtime = countryProfileRuntime;
    applyCountryProfileGlobePreset(lastLayerId);
    if (runtime.preset.refinement) {
      chrome?.setSharePainLabel(
        runtime.preset.sharePainLabel ?? "share your pain\nlocate it",
        runtime.preset.sharePainLooseLines,
      );
    }
    countryPresentation = new CountryPresentation({
    appRoot: appRootEl,
    controlHost: runtime.preset.refinement ? chrome?.countryCycleHost : undefined,
    refinement: runtime.preset.refinement,
    profiles: runtime.profiles,
    controls: globe.controls,
    getSelectedIso3: () => runtime.selectedIso3,
    getCurrentLayer: () => lastLayerId,
    enterAllLayers: async () => {
      if (lastLayerId !== "all-layers") await handleAllLayers();
    },
    restoreLayer: (layerId) => {
      if (layerId === lastLayerId) return;
      if (layerId === "all-layers") {
        void handleAllLayers().catch((error) =>
          setStatus(error instanceof Error ? error.message : String(error)),
        );
      } else handleLayerChange(layerId);
    },
    moveTo: async (iso3, signal, durationMs) => {
      const centroid = getCountryCentroid(iso3);
      if (!centroid) throw new Error(`No presentation centroid for ${iso3}`);
      await flyGlobeToLatLng(
        globe.camera,
        globe.controls,
        centroid.lat,
        centroid.lng,
        globe.earthContent,
        { durationMs, signal, preserveRadius: runtime.preset.cycle?.preserveZoom },
      );
    },
    selectCountry: (iso3) => {
      runtime.select(iso3, false);
      emoLabelLayer?.selectCountry(iso3);
    },
    clearCountry: () => {
      runtime.clear(false);
      emoLabelLayer?.clearSelection();
    },
    isBuilding: (iso3) => {
      const category = runtime.profiles.get(iso3)?.emotional.categoryKey;
      return category ? emoMotion?.isBuilding(category) === true : false;
    },
    isRetreating: () => (emoMotion?.retreatingCategories().length ?? 0) > 0,
    setMotionPaused: (paused) => emoMotion?.setPaused(paused),
    setPresentationTiming,
    setProfileSuppressed: (suppressed) => runtime.setProfileSuppressed(suppressed),
    setProfileAutoplay: (autoplay) => runtime.setAutoplay(autoplay),
    previewCountry: (iso3) => runtime.previewCountry(iso3),
    previewDuringFlight: runtime.preset.cycle?.previewDuringFlight,
    revealWithNetwork: runtime.preset.cycle?.revealWithNetwork,
    prepareMs: runtime.preset.cycle?.prepareMs,
    flightMs: runtime.preset.cycle?.flightMs,
    dwellMs: runtime.preset.cycle?.dwellMs,
    getAutoSpin: () => globe.isAutoSpinEnabled(),
    setAutoSpin: (enabled) => globe.setAutoSpinEnabled(enabled),
    });
  })();
  try {
    await countryProfileRuntimeReady;
  } catch (error) {
    countryProfileRuntimeReady = null;
    throw error;
  }
}

/**
 * Apply layer visuals and auto-switch pain viz mode:
 * physpain → scars; all other / unknown ids → points.
 */
function applyGlobeLayer(layerId: string): void {
  const vizMode =
    layerId === "physpain" ? PAIN_VIZ_MODE.scars : PAIN_VIZ_MODE.points;
  currentPainVizMode = vizMode;
  globe.setPainVisualizationMode(vizMode);
  applyCountryProfileGlobePreset(layerId);

  globe.setWordCloudEnabled(layerId === "emopain");
  syncEmoLayer(layerId);

  const layer = getMapLayerById(layerId);
  const meta: GlobeLayerDisplayMeta | undefined = layer
    ? {
        color: LAYER_STIPPLE_COLOR_OVERRIDES[layerId] ?? layer.color,
        text: layer.text,
        geospatial: layer.geospatial,
        lexiconBucket: resolveLayerLexiconBucket(layerId),
      }
    : undefined;
  globe.updateLayerVisuals(layerId, meta);
  showLegend(layerId, countryProfileRuntime?.legendForLayer(layerId));
}

async function applyPendingLayerChange(
  layerId: string,
  revision: number,
): Promise<void> {
  globe.setMarkers([]);
  const prevLayerId = lastLayerId;
  if (
    prevLayerId &&
    prevLayerId !== layerId &&
    // all-layers-off already tracked in handleLayerChange (immediate path).
    prevLayerId !== "all-layers"
  ) {
    trackToggle(METRICS_KIND_LAYER, prevLayerId, false);
  }
  trackToggle(METRICS_KIND_LAYER, layerId, true);
  lastLayerId = layerId;
  applyGlobeLayer(layerId);
  syncWordCloudForCurrentLayer();
  await loadPoints();
  if (revision !== layerChangeRevision) return;
  // Start after setMarkers too. Cached loadPoints resolves immediately, but its synchronous globe
  // rebuild still blocks the frame in which a CSS transition would otherwise begin.
  countryProfileRuntime?.setLayer(layerId);
}

function handleLayerChange(layerId: string): void {
  if (
    layerId === lastLayerId &&
    !showAllLayersActive &&
    // Allow re-selecting the current layer while a debounce is still pending.
    pendingLayerChangeTimer === null
  ) {
    return;
  }
  const revision = ++layerChangeRevision;
  loadPointsAbortController?.abort();
  if (showAllLayersActive) {
    // BEFORE THE GLOBE CHANGES, NOT 150 MS AFTER IT. All-layers mode is what makes the base mesh
    // an invisible depth mask, and that mask is the only thing cutting the buried part of every
    // leader line back to the surface. The rest of this switch is debounced by
    // LAYER_CHANGE_DEBOUNCE_MS to coalesce rapid clicks, so leaving the foot to the deferred
    // syncEmoLayer drew every line's whole buried length across the disc for that window.
    // Photographed at 60 ms after the click: hairlines over the ocean and the land; at 1500 ms,
    // none. The layer this belongs to rebuilds its geometry inside the call rather than on its
    // next frame, because the render loop draws before it updates these layers.
    emoLeaderLineLayer?.setDepthMasked(false);
    showAllLayersActive = false;
    globe.setShowAllLayersMode(false);
    chrome?.setAllLayersActive(false);
    trackToggle(METRICS_KIND_LAYER, "all-layers", false);
  }
  chrome?.setActiveLayer(layerId);
  // Immediate: user feedback + fetch cancel. Deferred: GPU rebuild (coalesce rapid clicks).
  clearTimeout(pendingLayerChangeTimer ?? undefined);
  pendingLayerChangeTimer = setTimeout(() => {
    pendingLayerChangeTimer = null;
    void applyPendingLayerChange(layerId, revision).catch((e) =>
      setStatus(e instanceof Error ? e.message : String(e)),
    );
  }, LAYER_CHANGE_DEBOUNCE_MS);
}

/**
 * Stack all-layer visuals (phys scars, socio choropleth, env CO2 haze, emo word clouds).
 * Uncached layers are fetched in parallel; layers already in {@link pointCache} are reused.
 */
async function handleAllLayers(): Promise<void> {
  if (cachedLayers.length === 0) {
    setStatus("No layers loaded yet");
    return;
  }
  const revision = ++layerChangeRevision;

  loadPointsAbortController?.abort();
  clearTimeout(pendingLayerChangeTimer ?? undefined);
  pendingLayerChangeTimer = null;

  showAllLayersActive = true;
  chrome?.setAllLayersActive(true);
  hideLegend();
  if (lastLayerId) {
    trackToggle(METRICS_KIND_LAYER, lastLayerId, false);
  }
  trackToggle(METRICS_KIND_LAYER, "all-layers", true);
  lastLayerId = "all-layers";

  const phys = cachedLayers.find((l) => l.id === "physpain");
  const socio = cachedLayers.find((l) => isChoroplethMapLayer(l));
  const emo = cachedLayers.find((l) => l.text === true && l.geospatial === false);

  currentPainVizMode = PAIN_VIZ_MODE.scars;
  globe.setPainVisualizationMode(PAIN_VIZ_MODE.scars);
  globe.setWordCloudEnabled(true);
  syncEmoLayer("all-layers");
  globe.setShowAllLayersMode(true, {
    physpainLayerId: phys?.id ?? "physpain",
    choroplethLayerId: socio?.id ?? "socioecopain",
    choroplethColorHex: socio?.color ?? null,
    emopainLayerId: emo?.id ?? "emopain",
    lexiconBucket: resolveLayerLexiconBucket(emo?.id ?? "emopain"),
  });

  // Skip GET /init/:layer for ids already in pointCache (prior single-layer or all-layers visit).
  const cachedPoints: PainPoint[] = [];
  const layersToFetch: MapLayer[] = [];
  for (const layer of cachedLayers) {
    const hit = pointCache.get(layer.id);
    if (hit) {
      cachedPoints.push(...hit);
    } else {
      layersToFetch.push(layer);
    }
  }
  const fetchedLists = await Promise.all(
    layersToFetch.map((layer) => fetchPoints(layer.id)),
  );
  for (let i = 0; i < layersToFetch.length; i++) {
    const points = fetchedLists[i] ?? [];
    pointCache.set(layersToFetch[i]!.id, points);
  }
  if (revision !== layerChangeRevision) {
    await ensureCountryProfileRuntime();
    return;
  }
  const allPoints: PainPoint[] = [...cachedPoints, ...fetchedLists.flat()];
  globe.setMarkers(allPoints);
  await ensureCountryProfileRuntime();
  if (revision !== layerChangeRevision) return;
  applyCountryProfileGlobePreset(lastLayerId);
  countryProfileRuntime?.setLayer(lastLayerId);
  syncWordCloudToggle();
  setStatus(
    `${allPoints.length} point(s) across ${cachedLayers.length} layer(s) — all visuals`,
  );
}

// --- pain-server / mock: populate layer chrome and load points for current layer ---
async function loadLayersIntoChrome(layers: MapLayer[]): Promise<void> {
  cachedLayers = layers;
  chrome = await mountProductionChrome(appRootEl, layers, {
    onLayerChange: handleLayerChange,
    onAllLayers: () => {
      void handleAllLayers().catch((e) =>
        setStatus(e instanceof Error ? e.message : String(e)),
      );
    },
    onSharePain: () => {
      void showConsentModal(
        appRootEl,
        () => {
          surveyModal.open();
        },
        () => {},
      );
    },
  });
  const themeBtn = document.querySelector<HTMLButtonElement>("#theme-toggle");
  if (themeBtn) wireThemeToggle(themeBtn);
}

async function loadPoints(): Promise<void> {
  const layer = lastLayerId;
  if (!layer) return;
  const cached = pointCache.get(layer);
  if (cached) {
    globe.setMarkers(cached);
    setStatus(
      `${cached.length} point(s) for “${layer}” — scar map rebuilds on load (see console)`,
    );
    return;
  }
  const controller = new AbortController();
  loadPointsAbortController = controller;
  try {
    const points = await fetchPoints(layer, controller.signal);
    if (controller.signal.aborted) return;
    pointCache.set(layer, points);
    globe.setMarkers(points);
    setStatus(
      `${points.length} point(s) for “${layer}” — scar map rebuilds on load (see console)`,
    );
  } catch (e) {
    if (
      controller.signal.aborted ||
      (e instanceof DOMException && e.name === "AbortError") ||
      (e instanceof Error && e.name === "AbortError")
    ) {
      return;
    }
    throw e;
  }
}

// --- render loop + initial API bootstrap ---
function loop(now: number): void {
  globe.tick();
  // Before the three layers, so none of them sees a different instant of the same animation.
  emoMotion?.tick();
  emoLabelLayer?.update();
  emoArcLayer?.update();
  emoLeaderLineLayer?.update();
  const exactCountry = countryProfileRuntime?.preset.selectionPeerStrength !== undefined &&
    lastLayerId !== "emopain" && lastLayerId !== "all-layers"
    ? countryProfileRuntime.selectedIso3 : null;
  emoSelectionLayer?.setExactCountry(exactCountry,
    exactCountry ? getMapLayerById(lastLayerId)?.color ?? "#ffffff" : "#ffffff");
  emoSelectionLayer?.update();
  const runtime = countryProfileRuntime;
  const quality = runtime?.quality;
  if (quality) {
    const category = runtime.selectedIso3 ? runtime.profiles.get(runtime.selectedIso3)?.emotional.categoryKey : null;
    const busy = Boolean(emoMotion?.retreatingCategories().length ||
      (category && emoMotion?.isBuilding(category)));
    const pool = globe.getStippleDetailStats();
    const ready = pool !== null && pool.capacityLimit === quality.settings.capacity &&
      pool.targetCapacity === quality.settings.capacity;
    const change = quality.tick(now, busy, ready, document.hidden);
    if (change === "apply") applyCountryProfileGlobePreset(lastLayerId);
    if (change) {
      const storage = globe.getRenderDetailStorage();
      appRootEl.dataset.cpQuality = quality.level;
      appRootEl.dataset.cpQualityTarget = quality.target;
      appRootEl.dataset.cpDetailBytes = String(storage.total);
      appRootEl.dataset.cpDetailBudget = String(quality.activeBudgetBytes);
      appRootEl.dataset.cpBudgetExceeded = String(storage.total > quality.activeBudgetBytes);
    }
  }
  requestAnimationFrame(loop);
}

(async () => {
  initBackgroundMusic();
  if (emoViewsEnabled && emoLabelHost) {
    try {
      emoMotion = createEmoSelectionMotion({ data: await loadEmoData(), params: emoView.params });
      emoLabelLayer = await createEmoLabelLayer({
        host: emoLabelHost,
        globe,
        data: await loadEmoData(),
        params: emoView.params,
        motion: emoMotion,
        // The label layer owns the selection because it owns the click; the arcs and the
        // country fill are told from here.
        onSelect: (selection) => {
          countryPresentation?.allowManualMotion();
          // Order matters here. setSelection clears any wave in flight, and the arc layer starts
          // the new one, so the arcs go second or the wave they just planned is thrown away.
          emoMotion?.setSelection(selection?.cat ?? null);
          emoArcLayer?.setSelectedCategory(selection?.cat ?? null, selection?.iso3 ?? null);
          emoSelectionLayer?.setSelectedCategory(selection?.cat ?? null);
          emoLegend?.setSelectedCategory(selection?.cat ?? null);
          if (!preserveCountryProfileOnEmoClear) {
            if (selection) countryProfileRuntime?.select(selection.iso3, true);
            else countryProfileRuntime?.clear(true);
          }
          // The leader lines are not told directly: they follow the motion, which is the one
          // signal all three layers share, so they cannot disagree about what is selected.
        },
        onCanvasMiss: countryProfileEnabled ? handleCountrySurfaceClick : undefined,
        // Walk the seed rather than randomising it, so clicking back and forth is repeatable.
        onReshuffle: () => {
          emoPanel?.setParam("randomSeed", (Math.round(emoParams.randomSeed) % 200) + 1);
        },
      });
      emoArcLayer = await createEmoArcLayer({
        globe,
        data: await loadEmoData(),
        params: emoView.params,
        motion: emoMotion,
      });
      emoLeaderLineLayer = await createEmoLeaderLineLayer({
        globe,
        data: await loadEmoData(),
        params: emoView.params,
        motion: emoMotion,
      });
      emoSelectionLayer = await createEmoSelectionLayer({
        globe,
        data: await loadEmoData(),
        params: emoView.params,
        motion: emoMotion,
      });
      if (emoLegendHost) {
        emoLegend = await createEmoLegend({
          host: emoLegendHost,
          data: await loadEmoData(),
          params: emoView.params,
          // A legend click is a click on a country, taking the same path as one on the globe.
          // There is no second selection route, so nothing can drift out of step with it.
          onPick: (iso3) => emoLabelLayer?.selectCountry(iso3),
          // Under `legendRepeatClick: "clear"`, a second click on the word already selected puts
          // the selection away by the same route a click on empty globe takes.
          onClear: () => emoLabelLayer?.clearSelection(),
          // Clicking the word whose network is still arriving does nothing. The legend asks
          // before it rolls, so a blocked click does not walk the seeded sequence.
          isBusy: (cat) => emoMotion?.isBuilding(cat) === true,
        });
      }
      syncEmoLayer(lastLayerId);
      applyEmoCaptureOverrides(globe);
      if (emoViewControlsEnabled && emoPanelHost && emoPanelToggle) {
        emoPanel = mountEmoViewPanel(emoPanelHost, {
          initialPresetId: emoView.presetId,
          initialParams: emoView.params,
          onChange: (preset, params) => {
            emoPreset = preset;
            applyEmoParams(params);
            syncEmoLayer(lastLayerId);
          },
          onMinimise: () => setEmoPanelOpen(false),
        });
        setEmoPanelOpen(shouldOpenEmoPanel());
      }
    } catch (e) {
      console.error("[main] emo label views failed to start", e);
    }
  }
  try {
    const layers = await fetchLayers();
    await loadLayersIntoChrome(layers);
    // Default to all-layers on load instead of activating the first API layer.
    await handleAllLayers();
  } catch (e) {
    setStatus(
      e instanceof Error
        ? e.message
        : "API unreachable — mock: `npm run dev`; pain-server: run backend on :3000 then `npm run dev:pain-server`.",
    );
  }
  requestAnimationFrame(loop);
})();
