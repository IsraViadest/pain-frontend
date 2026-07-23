import "./ui.css";
import type { MapLayer } from "../types/api";
import { resolveLayerBlobSvg } from "../api/layers";
import { createBlobButton, setActive } from "./blobButton";
import {
  hideInfoModal,
  INFO_MODAL_ABOUT,
  INFO_MODAL_DATA_SOURCES,
  showInfoModal,
} from "./infoModal";

/** Handlers wired from main.ts for globe / survey actions. */
type ProductionChromeCallbacks = {
  /** User selected a layer blob button. */
  onLayerChange: (layerId: string) => void;
  /** User clicked the viz mode cycle button. */
  onVizCycle: () => void;
  /** User clicked share your pain. */
  onSharePain: () => void;
};

/** API for syncing chrome state after programmatic layer or viz changes. */
export type ProductionChrome = {
  /** Highlight one layer blob; deactivates all others. */
  setActiveLayer: (layerId: string) => void;
  /** Update the viz cycle button label (e.g. current mode name). */
  setVizModeLabel: (label: string) => void;
};

function requireChild(host: HTMLElement, id: string): HTMLElement {
  const el = host.querySelector<HTMLElement>(`#${id}`);
  if (!el) {
    throw new Error(`[productionChrome] Missing #${id} mount point`);
  }
  return el;
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
 * @param callbacks — layer change, viz cycle, and share-pain handlers from main.ts.
 */
export async function mountProductionChrome(
  appRoot: HTMLElement,
  layers: MapLayer[],
  callbacks: ProductionChromeCallbacks,
): Promise<ProductionChrome> {
  const titleHost = requireChild(appRoot, "ui-title");
  const titleControlsHost = requireChild(appRoot, "ui-title-controls");
  const layerStackHost = requireChild(appRoot, "ui-layer-stack");
  const topRightHost = requireChild(appRoot, "ui-top-right");
  const hamburgerHost = requireChild(appRoot, "ui-hamburger");
  const sharePainHost = requireChild(appRoot, "ui-share-pain");
  const bottomLeftHost = requireChild(appRoot, "ui-bottom-left");

  const heading = document.createElement("h1");
  heading.className = "ui-title__heading";
  heading.textContent = "P.A.I.N.";

  const subtitle = document.createElement("p");
  subtitle.className = "ui-title__subtitle";
  subtitle.textContent = "Personal And Interconnected with Nature";

  titleHost.append(heading, subtitle);

  const hamburgerBtn = await createHamburgerButton();
  const closeMobileMenu = (): void => {
    appRoot.classList.remove("mobile-menu-open");
    hamburgerBtn.setAttribute("aria-expanded", "false");
  };

  hamburgerBtn.addEventListener("click", () => {
    const open = appRoot.classList.toggle("mobile-menu-open");
    hamburgerBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  hamburgerHost.appendChild(hamburgerBtn);

  const layerButtons = new Map<string, HTMLButtonElement>();
  let activeLayerId = layers[0]?.id ?? "";

  const applyActiveLayer = (layerId: string): void => {
    activeLayerId = layerId;
    for (const [id, btn] of layerButtons) {
      setActive(btn, id === layerId);
    }
  };

  for (const layer of layers) {
    const btn = await createBlobButton({
      svgName: resolveLayerBlobSvg(layer.id),
      label: layer.label,
      variant: "layer",
      onClick: () => {
        applyActiveLayer(layer.id);
        callbacks.onLayerChange(layer.id);
        closeMobileMenu();
      },
    });
    layerButtons.set(layer.id, btn);
    layerStackHost.appendChild(btn);
  }

  if (activeLayerId) {
    applyActiveLayer(activeLayerId);
  }

  const themeToggle = appRoot.querySelector<HTMLButtonElement>("#theme-toggle");
  if (!themeToggle) {
    throw new Error("[productionChrome] Missing #theme-toggle");
  }
  themeToggle.hidden = false;

  const vizCycleBtn = document.createElement("button");
  vizCycleBtn.type = "button";
  vizCycleBtn.className = "ui-viz-cycle";
  vizCycleBtn.addEventListener("click", () => {
    callbacks.onVizCycle();
  });

  const controlsHost = window.matchMedia("(max-width: 768px)").matches
    ? titleControlsHost
    : topRightHost;
  controlsHost.append(themeToggle, vizCycleBtn);

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

  return {
    setActiveLayer(layerId: string): void {
      applyActiveLayer(layerId);
    },
    setVizModeLabel(label: string): void {
      vizCycleBtn.textContent = label;
    },
  };
}
