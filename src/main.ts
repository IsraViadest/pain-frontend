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
import { getMapLayerById, resolveLayerLexiconBucket } from "./api/layers";
import type { MapLayer } from "./types/api";
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
import {
  mountProductionChrome,
  type ProductionChrome,
} from "./ui/productionChrome";

const THEME_STORAGE_KEY = "pain-ui-theme";

const VIZ_CYCLE_ORDER: PainVisualizationMode[] = [
  PAIN_VIZ_MODE.scars,
  PAIN_VIZ_MODE.points,
  PAIN_VIZ_MODE.multiplexV0,
];

function vizModeLabel(mode: PainVisualizationMode): string {
  switch (mode) {
    case PAIN_VIZ_MODE.scars:
      return "Scar dents (topology)";
    case PAIN_VIZ_MODE.points:
      return "Point markers";
    case PAIN_VIZ_MODE.multiplexV0:
      return "Multiplex v0 (experimental)";
  }
}

function nextVizMode(current: PainVisualizationMode): PainVisualizationMode {
  const index = VIZ_CYCLE_ORDER.indexOf(current);
  const nextIndex = index < 0 ? 0 : (index + 1) % VIZ_CYCLE_ORDER.length;
  return VIZ_CYCLE_ORDER[nextIndex]!;
}

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
  return `<strong>${info.layerId}</strong><br/>Intensity ${info.intensity.toFixed(3)}<br/>Lat ${info.lat.toFixed(2)}, Lng ${info.lng.toFixed(2)}<br/>${info.datatype}`;
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
    currentPainVizMode === PAIN_VIZ_MODE.points
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
  if (currentPainVizMode !== PAIN_VIZ_MODE.multiplexV0) {
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

function setStatus(msg: string): void {
  hudStatus.textContent = msg;
}

function applyGlobeLayer(layerId: string): void {
  const layer = getMapLayerById(layerId);
  const meta: GlobeLayerDisplayMeta | undefined = layer
    ? {
        color: layer.color,
        text: layer.text,
        lexiconBucket: resolveLayerLexiconBucket(layerId),
      }
    : undefined;
  globe.setLayerTexture(layerId, meta);
}

function handleLayerChange(layerId: string): void {
  lastLayerId = layerId;
  applyGlobeLayer(layerId);
  syncWordCloudForCurrentLayer();
  chrome?.setActiveLayer(layerId);
  void loadPoints().catch((e) =>
    setStatus(e instanceof Error ? e.message : String(e)),
  );
}

function handleVizCycle(): void {
  currentPainVizMode = nextVizMode(currentPainVizMode);
  globe.setPainVisualizationMode(currentPainVizMode);
  chrome?.setVizModeLabel(vizModeLabel(currentPainVizMode));
  hoverModal.hidden = true;
}

// --- pain-server / mock: populate layer chrome and load points for current layer ---
async function loadLayersIntoChrome(layers: MapLayer[]): Promise<void> {
  chrome = await mountProductionChrome(appRootEl, layers, {
    onLayerChange: handleLayerChange,
    onVizCycle: handleVizCycle,
    onSharePain: () => {
      console.warn(
        "[main] Share your pain — survey flow ships on feat/user-survey (not merged here).",
      );
    },
  });

  if (layers[0]) {
    const layerId = layers[0].id;
    lastLayerId = layerId;
    applyGlobeLayer(layerId);
    syncWordCloudForCurrentLayer();
    chrome.setActiveLayer(layerId);
  }

  chrome.setVizModeLabel(vizModeLabel(currentPainVizMode));
}

async function loadPoints(): Promise<void> {
  const layer = lastLayerId;
  if (!layer) return;
  const points = await fetchPoints(layer);
  globe.setMarkers(points);
  setStatus(
    `${points.length} point(s) for “${layer}” — scar map rebuilds on load (see console)`,
  );
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
