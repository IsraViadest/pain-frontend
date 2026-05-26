/**
 * App entry — wires HUD controls to GlobeView and pain-server (or dev mock).
 *
 * Data flow (production):
 *   layer select → fetchPoints(layer) → api/client → GET /init/:layer → adapter → globe.setMarkers()
 *
 * Dev:
 *   npm run dev              — mock CSV API (Vite /api proxy)
 *   npm run dev:pain-server  — real backend on :3000 (Vite /init proxy)
 *
 * Globe debug UI is opt-in only (?globeDebug=1 or localStorage pain-globe-debug=1).
 */
import "./style.css";
import { fetchLayers, fetchPoints, submitPain } from "./api/client";
import {
  GlobeView,
  type MultiplexHoverInfo,
  type PainVisualizationMode,
  type WordCloudHoverInfo,
} from "./globe/GlobeView";
import type { VisualTheme } from "./globe/layerTextures";
import { isDebugScarVisual } from "./globe/debugScarVisual";
import {
  mountGlobeDebugPanel,
  shouldShowGlobeDebugPanel,
} from "./globe/globeDebugPanel";

const THEME_STORAGE_KEY = "pain-ui-theme";

const canvas = document.querySelector<HTMLCanvasElement>("#globe");
const layerSelect = document.querySelector<HTMLSelectElement>("#layer-select");
const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const refreshBtn = document.querySelector<HTMLButtonElement>("#refresh-points");
const testPostBtn = document.querySelector<HTMLButtonElement>("#test-post");
const wordCloudToggle = document.querySelector<HTMLButtonElement>("#word-cloud-toggle");
const themeToggle = document.querySelector<HTMLButtonElement>("#theme-toggle");
const painVizSelect =
  document.querySelector<HTMLSelectElement>("#pain-viz-mode");

if (
  !canvas ||
  !layerSelect ||
  !statusEl ||
  !refreshBtn ||
  !testPostBtn ||
  !wordCloudToggle ||
  !themeToggle ||
  !painVizSelect
) {
  throw new Error("Missing DOM nodes");
}

const painVizEl = painVizSelect;
painVizEl.value = "scars";

function readPainVizMode(): PainVisualizationMode {
  if (painVizEl.value === "scars") return "scars";
  if (painVizEl.value === "multiplex-v0") return "multiplex-v0";
  return "points";
}

const hudStatus = statusEl;
const layerPicker = layerSelect;
const wordCloudBtn = wordCloudToggle;
const themeBtn = themeToggle;
const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("Missing app root");
// Floating tooltip for multiplex / word-cloud hovers (not in index.html).
const hoverModal = document.createElement("div");
hoverModal.id = "multiplex-hover";
hoverModal.className = "multiplex-hover";
hoverModal.hidden = true;
appRoot.appendChild(hoverModal);

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

// --- Globe + optional debug panel (outside HUD — see index.html) ---
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
globe.setPainVisualizationMode(readPainVizMode());
let wordCloudEnabled = false;
globe.setWordCloudEnabled(wordCloudEnabled);

// --- HUD event handlers ---
function syncThemeToggle(): void {
  const t = document.documentElement.dataset.theme === "blue" ? "blue" : "dark";
  themeBtn.textContent = t === "blue" ? "Dark mode" : "Blue mode";
  themeBtn.setAttribute("aria-pressed", t === "blue" ? "true" : "false");
}

syncThemeToggle();

function syncWordCloudToggle(): void {
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

painVizEl.addEventListener("change", () => {
  globe.setPainVisualizationMode(readPainVizMode());
  hoverModal.hidden = true;
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
      return `${info.metadata.country} · ${info.metadata.layerLabel} · ${info.metadata.metricLabel} ${info.metadata.rawValue.toFixed(1)}${year} · normalized ${info.intensity.toFixed(2)} · source ${source}`;
    }
    const fallbackLabel =
      info.type[0]?.toUpperCase() + info.type.slice(1).toLowerCase();
    return `${fallbackLabel} · normalized ${info.intensity.toFixed(2)} · source user submission`;
  }
  return `<strong>Cluster beacon</strong><br/>${info.count} nearby points<br/>Avg intensity ${info.avgIntensity.toFixed(2)}`;
}

/** HTML for the floating tooltip when hovering an emotional word-cloud sprite. */
function renderWordCloudHover(info: WordCloudHoverInfo): string {
  const msg = info.fullText.length > 220
    ? `${info.fullText.slice(0, 217)}...`
    : info.fullText;
  return `<strong>${info.country}</strong><br/>${info.shortLabel}<br/>${msg}`;
}

canvas.addEventListener("pointermove", (ev) => {
  if (wordCloudEnabled && layerPicker.value === "emotional") {
    const w = globe.pickWordCloudHover(ev.clientX, ev.clientY);
    if (w) {
      hoverModal.hidden = false;
      hoverModal.innerHTML = renderWordCloudHover(w);
      const offsetX = 14;
      const offsetY = 12;
      hoverModal.style.left = `${ev.clientX + offsetX}px`;
      hoverModal.style.top = `${ev.clientY + offsetY}px`;
      return;
    }
  }
  if (readPainVizMode() !== "multiplex-v0") {
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
  const offsetX = 14;
  const offsetY = 12;
  hoverModal.style.left = `${ev.clientX + offsetX}px`;
  hoverModal.style.top = `${ev.clientY + offsetY}px`;
});

canvas.addEventListener("pointerleave", () => {
  hoverModal.hidden = true;
});

function setStatus(msg: string): void {
  hudStatus.textContent = msg;
}

// --- pain-server / mock: populate layer list and load points for current layer ---
async function loadLayersIntoSelect(): Promise<void> {
  const { layers } = await fetchLayers();
  layerPicker.innerHTML = "";
  for (const layer of layers) {
    const opt = document.createElement("option");
    opt.value = layer.id;
    opt.textContent = layer.label;
    layerPicker.appendChild(opt);
  }
  if (layers[0]) {
    globe.setLayerTexture(String(layers[0].id));
  }
}

async function loadPoints(): Promise<void> {
  const layer = layerPicker.value;
  const { points } = await fetchPoints(layer);
  globe.setMarkers(points);
  setStatus(
    `${points.length} point(s) for “${layer}” — scar map rebuilds on load (see console)`,
  );
}

layerPicker.addEventListener("change", () => {
  globe.setLayerTexture(layerPicker.value);
  void loadPoints().catch((e) =>
    setStatus(e instanceof Error ? e.message : String(e)),
  );
});

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  try {
    await loadPoints();
  } catch (e) {
    setStatus(e instanceof Error ? e.message : String(e));
  } finally {
    refreshBtn.disabled = false;
  }
});

testPostBtn.addEventListener("click", async () => {
  testPostBtn.disabled = true;
  try {
    const lat = (Math.random() * 140 - 70).toFixed(2);
    const lng = (Math.random() * 360 - 180).toFixed(2);
    const types = ["environmental", "physical", "emotional", "socioeconomic"];
    const type = types[Math.floor(Math.random() * types.length)]!;
    await submitPain({
      lat: Number(lat),
      lng: Number(lng),
      type,
      intensity: Math.random(),
      datatype: "water",
      text: "Dev test submission",
    });
    await loadPoints();
  } catch (e) {
    setStatus(e instanceof Error ? e.message : String(e));
  } finally {
    testPostBtn.disabled = false;
  }
});

// --- render loop + initial API bootstrap ---
function loop(): void {
  globe.tick();
  requestAnimationFrame(loop);
}

(async () => {
  try {
    await loadLayersIntoSelect();
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
