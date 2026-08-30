import "./ui.css";
import type { MapLayer } from "../types/api";
import { resolveLayerBlobSvg } from "../api/layers";
import {
  isSoundEnabled,
  setSoundEnabled,
} from "../sound/backgroundMusic";
import { createBlobButton, setActive } from "./blobButton";
import {
  hideInfoModal,
  INFO_MODAL_ABOUT,
  INFO_MODAL_DATA_SOURCES,
  showInfoModal,
} from "./infoModal";
import { hideLegend, showLegend } from "./legend";

/** Handlers wired from main.ts for globe / survey actions. */
type ProductionChromeCallbacks = {
  /** User selected a layer blob button. */
  onLayerChange: (layerId: string) => void;
  /** User clicked “all layers” — fetch and render every layer together. */
  onAllLayers: () => void;
  /** User clicked share your pain. */
  onSharePain: () => void;
};

/** API for syncing chrome state after programmatic layer / all-layers changes. */
export type ProductionChrome = {
  /** Highlight one layer blob; deactivates all others. */
  setActiveLayer: (layerId: string) => void;
  /**
   * When true, clears active state on all layer blobs (all-layers mode).
   * When false, restores active highlight for the current layer id.
   */
  setAllLayersActive: (active: boolean) => void;
  /**
   * Enable or dim share / about / data-sources / hamburger while a result
   * overlay is showing. Layer blobs stay clickable.
   */
  setUiEnabled: (enabled: boolean) => void;
};

function requireChild(host: HTMLElement, id: string): HTMLElement {
  const el = host.querySelector<HTMLElement>(`#${id}`);
  if (!el) {
    throw new Error(`[productionChrome] Missing #${id} mount point`);
  }
  return el;
}

/** Known production layer ids → SVG under `public/blobs/` (includes `new/` assets). */
const PRODUCTION_LAYER_BLOB_SVG: Record<string, string> = {
  emopain: "new/emo_pain.svg",
  envpain: "new/env_pain.svg",
  physpain: "new/phys_pain.svg",
  socioecopain: "new/socioeco_pain.svg",
};

/** All-layers blob (not a GET /init layer id). */
const ALL_PAIN_BLOB_SVG = "new/all_pain.svg";

/**
 * Layer blob for production chrome: hackathon SVGs for known ids;
 * {@link resolveLayerBlobSvg} fallback for unknown layers.
 */
function resolveChromeLayerBlobSvg(layerId: string): string {
  return PRODUCTION_LAYER_BLOB_SVG[layerId.trim()] ?? resolveLayerBlobSvg(layerId);
}

/** Same `/blobs/` URL pattern as blobButton — for assets that skip fill/gradient. */
function blobAssetUrl(svgName: string): string {
  const file = svgName.endsWith(".svg") ? svgName : `${svgName}.svg`;
  const base = import.meta.env.BASE_URL;
  return `${base}blobs/${file}`;
}

/**
 * Fetch menu_btn.svg and build a stroke-only hamburger control (no fill swap).
 */
async function createHamburgerButton(): Promise<HTMLButtonElement> {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ui-hamburger";
  button.setAttribute("aria-label", "Toggle menu");
  button.setAttribute("aria-expanded", "false");

  const res = await fetch(blobAssetUrl("menu_btn.svg"));
  if (!res.ok) {
    throw new Error(
      `[productionChrome] Failed to load menu_btn.svg: HTTP ${res.status}`,
    );
  }

  const svgText = await res.text();
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) {
    throw new Error("[productionChrome] Invalid menu_btn.svg");
  }

  button.appendChild(document.importNode(svg, true));
  return button;
}

/**
 * Mount production UI chrome into the fixed overlay slots in index.html.
 *
 * Fetches blob SVGs asynchronously for layer, share, about, and data-sources buttons.
 *
 * @param appRoot — `#app` element.
 * @param layers — layer list from GET /init (all layers shown regardless of `geospatial`).
 * @param callbacks — layer change, all-layers, and share-pain handlers from main.ts.
 */
export async function mountProductionChrome(
  appRoot: HTMLElement,
  layers: MapLayer[],
  callbacks: ProductionChromeCallbacks,
): Promise<ProductionChrome> {
  const titleHost = requireChild(appRoot, "ui-title");
  const layerStackHost = requireChild(appRoot, "ui-layer-stack");
  const hamburgerHost = requireChild(appRoot, "ui-hamburger");
  const sharePainHost = requireChild(appRoot, "ui-share-pain");
  const bottomLeftHost = requireChild(appRoot, "ui-bottom-left");

  const heading = document.createElement("h1");
  heading.className = "ui-title__heading";
  heading.textContent = "P.A.I.N.";

  const subtitle = document.createElement("p");
  subtitle.className = "ui-title__subtitle";
  subtitle.textContent = "Personal And Interconnected with Nature";

  const soundToggleBtn = document.createElement("button");
  soundToggleBtn.type = "button";
  soundToggleBtn.className = "ui-title__sound-toggle";

  const syncSoundToggle = (): void => {
    const enabled = isSoundEnabled();
    soundToggleBtn.replaceChildren();
    if (enabled) {
      soundToggleBtn.append("sound ");
      const onWord = document.createElement("span");
      onWord.style.fontWeight = "700";
      onWord.textContent = "on";
      soundToggleBtn.append(onWord, " / off");
    } else {
      soundToggleBtn.append("sound on / ");
      const offWord = document.createElement("span");
      offWord.style.fontWeight = "700";
      offWord.textContent = "off";
      soundToggleBtn.append(offWord);
    }
    soundToggleBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
  };

  syncSoundToggle();
  soundToggleBtn.addEventListener("click", () => {
    setSoundEnabled(!isSoundEnabled());
    syncSoundToggle();
  });
  document.addEventListener("backgroundMusicStateChanged", syncSoundToggle);

  titleHost.append(heading, subtitle, soundToggleBtn);

  const hamburgerBtn = await createHamburgerButton();
  let allLayersMode = false;

  const closeMobileMenu = (): void => {
    const menuWasOpen = appRoot.classList.contains("mobile-menu-open");
    appRoot.classList.remove("mobile-menu-open");
    hamburgerBtn.setAttribute("aria-expanded", "false");
    if (!menuWasOpen) return;
    if (allLayersMode) {
      hideLegend();
    } else {
      showLegend(activeLayerId);
    }
  };

  hamburgerBtn.addEventListener("click", () => {
    const open = appRoot.classList.toggle("mobile-menu-open");
    hamburgerBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      hideLegend();
    } else if (allLayersMode) {
      hideLegend();
    } else {
      showLegend(activeLayerId);
    }
  });
  hamburgerHost.appendChild(hamburgerBtn);

  const layerButtons = new Map<string, HTMLButtonElement>();
  let activeLayerId = layers[0]?.id ?? "";

  const allPainBtn = await createBlobButton({
    svgName: ALL_PAIN_BLOB_SVG,
    label: "all the pain",
    variant: "layer",
    skipActiveGradient: true,
    activeFill: "#D9D9D9",
    onClick: () => {
      callbacks.onAllLayers();
      closeMobileMenu();
    },
  });
  allPainBtn.dataset.layer = "all-pain";
  layerStackHost.appendChild(allPainBtn);

  const applyActiveLayer = (layerId: string): void => {
    activeLayerId = layerId;
    for (const [id, btn] of layerButtons) {
      setActive(btn, id === layerId);
    }
  };

  const applyAllLayersActive = (active: boolean): void => {
    allLayersMode = active;
    setActive(allPainBtn, active);
    if (active) {
      for (const btn of layerButtons.values()) {
        setActive(btn, false);
      }
    } else if (activeLayerId) {
      applyActiveLayer(activeLayerId);
    }
  };

  for (const layer of layers) {
    const btn = await createBlobButton({
      svgName: resolveChromeLayerBlobSvg(layer.id),
      label: layer.label,
      variant: "layer",
      skipActiveGradient: layer.id === "physpain" || layer.id === "envpain",
      activeFill: layer.id === "envpain" ? "#CBB0B9" : undefined,
      onClick: () => {
        applyAllLayersActive(false);
        applyActiveLayer(layer.id);
        callbacks.onLayerChange(layer.id);
        closeMobileMenu();
      },
    });
    btn.dataset.layer = layer.id;
    layerButtons.set(layer.id, btn);
    layerStackHost.appendChild(btn);
  }

  if (activeLayerId) {
    applyActiveLayer(activeLayerId);
  }

  const sharePainBtn = await createBlobButton({
    svgName: "share_pain.svg",
    label: "share your pain",
    variant: "share",
    onClick: () => {
      callbacks.onSharePain();
    },
  });
  sharePainHost.appendChild(sharePainBtn);

  const aboutBtn = await createBlobButton({
    svgName: "about.svg",
    label: "about",
    variant: "info",
    onClick: () => {
      showInfoModal(appRoot, {
        ...INFO_MODAL_ABOUT,
        onClose: () => hideInfoModal(),
      });
    },
  });

  const dataSourcesBtn = await createBlobButton({
    svgName: "data_sources.svg",
    label: "data sources",
    variant: "info",
    onClick: () => {
      showInfoModal(appRoot, {
        ...INFO_MODAL_DATA_SOURCES,
        onClose: () => hideInfoModal(),
      });
    },
  });

  bottomLeftHost.append(aboutBtn, dataSourcesBtn);

  const chromeActionButtons = [
    sharePainBtn,
    aboutBtn,
    dataSourcesBtn,
    hamburgerBtn,
  ];

  return {
    setActiveLayer(layerId: string): void {
      applyActiveLayer(layerId);
    },
    setAllLayersActive(active: boolean): void {
      applyAllLayersActive(active);
    },
    setUiEnabled(enabled: boolean): void {
      for (const btn of chromeActionButtons) {
        btn.disabled = !enabled;
        if (enabled) {
          btn.style.opacity = "";
          btn.style.pointerEvents = "";
        } else {
          // Dimmed overlay chrome while the post-submit result card is open.
          btn.style.opacity = "0.4";
          btn.style.pointerEvents = "none";
        }
      }
    },
  };
}
