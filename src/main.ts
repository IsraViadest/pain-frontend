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
import {
  METRICS_KIND_LAYER,
  trackToggle,
  trackVizMode,
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
import {
  mountProductionChrome,
  type ProductionChrome,
} from "./ui/productionChrome";
import { playPainSound } from "./sound/soundEngine";

const THEME_STORAGE_KEY = "pain-ui-theme";

const canvas = document.querySelector<HTMLCanvasElement>("#globe");
const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const wordCloudToggle = document.querySelector<HTMLButtonElement>("#word-cloud-toggle");
const themeToggle = document.querySelector<HTMLButtonElement>("#theme-toggle");

if (!canvas || !statusEl || !wordCloudToggle || !themeToggle) {
  throw new Error("Missing DOM nodes");
}

const hudStatus = statusEl;
let lastLayerId = "";
let currentPainVizMode: PainVisualizationMode = PAIN_VIZ_MODE.scars;
let chrome: ProductionChrome | null = null;
/** Layer list from last successful fetchLayers (for all-layers Promise.all). */
let cachedLayers: MapLayer[] = [];
/** True while concurrent multi-layer visuals are shown. */
let showAllLayersActive = false;
/** In-flight {@link loadPoints} fetch; aborted on the next layer switch. */
let loadPointsAbortController: AbortController | null = null;

const surveyModalHost = document.querySelector<HTMLElement>("#survey-modal");
if (!surveyModalHost) throw new Error("Missing #survey-modal mount");

/** Current pain viz mode (production chrome cycles this; no HUD select). */
function readPainVizMode(): PainVisualizationMode {
  return currentPainVizMode;
}

const wordCloudBtn = wordCloudToggle;
const themeBtn = themeToggle;
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
    showSurveyResultModal(overlayHost, {
      lat: resultLat,
      lng: resultLng,
      onClose: () => {
        removeSurfaceMarker();
        hideSurveyResultModal();
        globe.setAutoSpinEnabled(true);
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
function syncThemeToggle(): void {
  const t = document.documentElement.dataset.theme === "blue" ? "blue" : "dark";
  themeBtn.textContent = t === "blue" ? "Dark mode" : "Blue mode";
  themeBtn.setAttribute("aria-pressed", t === "blue" ? "true" : "false");
}

syncThemeToggle();

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

themeBtn.addEventListener("click", () => {
  const next: VisualTheme =
    document.documentElement.dataset.theme === "blue" ? "dark" : "blue";
  document.documentElement.dataset.theme = next;
  persistTheme(next);
  globe.setVisualTheme(next);
  syncThemeToggle();
});

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

/**
 * Apply layer visuals and auto-switch pain viz mode:
 * physpain → scars; all other / unknown ids → points.
 */
function applyGlobeLayer(layerId: string): void {
  const vizMode =
    layerId === "physpain" ? PAIN_VIZ_MODE.scars : PAIN_VIZ_MODE.points;
  currentPainVizMode = vizMode;
  globe.setPainVisualizationMode(vizMode);
  trackVizMode(vizMode);

  globe.setWordCloudEnabled(layerId === "emopain");

  const layer = getMapLayerById(layerId);
  const meta: GlobeLayerDisplayMeta | undefined = layer
    ? {
        color: layer.color,
        text: layer.text,
        geospatial: layer.geospatial,
        lexiconBucket: resolveLayerLexiconBucket(layerId),
      }
    : undefined;
  globe.updateLayerVisuals(layerId, meta);
}

function handleLayerChange(layerId: string): void {
  loadPointsAbortController?.abort();
  if (showAllLayersActive) {
    showAllLayersActive = false;
    globe.setShowAllLayersMode(false);
    chrome?.setAllLayersActive(false);
  }
  const prevLayerId = lastLayerId;
  if (prevLayerId && prevLayerId !== layerId) {
    trackToggle(METRICS_KIND_LAYER, prevLayerId, false);
  }
  trackToggle(METRICS_KIND_LAYER, layerId, true);
  lastLayerId = layerId;
  globe.setMarkers([]);
  applyGlobeLayer(layerId);
  syncWordCloudForCurrentLayer();
  chrome?.setActiveLayer(layerId);
  void loadPoints().catch((e) =>
    setStatus(e instanceof Error ? e.message : String(e)),
  );
}

/**
 * Fetch every layer in parallel and stack visuals:
 * physpain scars, socio choropleth shell, env CO2 haze, emo word clouds.
 */
async function handleAllLayers(): Promise<void> {
  if (cachedLayers.length === 0) {
    setStatus("No layers loaded yet");
    return;
  }

  showAllLayersActive = true;
  chrome?.setAllLayersActive(true);

  const phys = cachedLayers.find((l) => l.id === "physpain");
  const socio = cachedLayers.find((l) => isChoroplethMapLayer(l));
  const emo = cachedLayers.find((l) => l.text === true && l.geospatial === false);

  currentPainVizMode = PAIN_VIZ_MODE.scars;
  globe.setPainVisualizationMode(PAIN_VIZ_MODE.scars);
  trackVizMode(PAIN_VIZ_MODE.scars);
  globe.setWordCloudEnabled(true);
  globe.setShowAllLayersMode(true, {
    physpainLayerId: phys?.id ?? "physpain",
    choroplethLayerId: socio?.id ?? "socioecopain",
    choroplethColorHex: socio?.color ?? null,
    emopainLayerId: emo?.id ?? "emopain",
    lexiconBucket: resolveLayerLexiconBucket(emo?.id ?? "emopain"),
  });

  const pointLists = await Promise.all(
    cachedLayers.map((layer) => fetchPoints(layer.id)),
  );
  const allPoints: PainPoint[] = pointLists.flat();
  globe.setMarkers(allPoints);
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
      surveyModal.open();
    },
  });

  if (layers[0]) {
    const layerId = layers[0].id;
    lastLayerId = layerId;
    applyGlobeLayer(layerId);
    trackToggle(METRICS_KIND_LAYER, layerId, true);
    syncWordCloudForCurrentLayer();
    chrome.setActiveLayer(layerId);
  }
}

async function loadPoints(): Promise<void> {
  const layer = lastLayerId;
  if (!layer) return;
  const controller = new AbortController();
  loadPointsAbortController = controller;
  try {
    const points = await fetchPoints(layer, controller.signal);
    if (controller.signal.aborted) return;
    globe.setMarkers(points);
    setStatus(
      `${points.length} point(s) for “${layer}” — scar map rebuilds on load (see console)`,
    );
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    if (e instanceof Error && e.name === "AbortError") return;
    throw e;
  }
}

// --- render loop + initial API bootstrap ---
function loop(): void {
  globe.tick();
  requestAnimationFrame(loop);
}

(async () => {
  try {
    const layers = await fetchLayers();
    await loadLayersIntoChrome(layers);
    await loadPoints();
  } catch (e) {
    setStatus(
      e instanceof Error
        ? e.message
        : "API unreachable — mock: `npm run dev`; pain-server: run backend on :3000 then `npm run dev:pain-server`.",
    );
  }
  requestAnimationFrame(loop);
})();
