/**
 * Layer legend overlay — slides in from the left for phys / env / socio layers.
 */

const LEGEND_SVG_BY_LAYER: Record<string, string> = {
  physpain: "physical_legend.svg",
  envpain: "environmental_legend.svg",
  socioecopain: "socioeco_legend.svg",
};

/** Matches `#ui-legend` CSS `transition: transform 0.4s ease`. */
const LEGEND_SWAP_RETRIGGER_MS = 400;

/** Same as `#ui-title { left: 20px }` — used to center the legend under the title. */
const TITLE_INSET_LEFT_PX = 20;

/** Matches the mobile chrome breakpoint in `ui.css`. */
const MOBILE_MAX_WIDTH_PX = 768;

let imgEl: HTMLImageElement | null = null;
let currentFileName: string | null = null;
let swapTimeoutId: ReturnType<typeof setTimeout> | null = null;
let resizeBound = false;

function legendAssetUrl(fileName: string): string {
  const base = import.meta.env.BASE_URL;
  return `${base}legend/${fileName}`;
}

function getLegendHost(): HTMLElement | null {
  return document.getElementById("ui-legend");
}

/**
 * Desktop: center `#ui-legend` under `#ui-title`. Mobile: clear inline left.
 */
function positionLegendUnderTitle(): void {
  const host = getLegendHost();
  if (!host) return;
  if (window.innerWidth <= MOBILE_MAX_WIDTH_PX) {
    host.style.left = "";
    return;
  }
  const titleEl = document.getElementById("ui-title");
  if (!titleEl) return;
  host.style.left = `${TITLE_INSET_LEFT_PX + titleEl.offsetWidth / 2 - host.offsetWidth / 2}px`;
}

function ensureLegendResizeListener(): void {
  if (resizeBound) return;
  resizeBound = true;
  window.addEventListener("resize", () => {
    positionLegendUnderTitle();
  });
}

/** Position after paint (and again when the SVG finishes loading). */
function afterLegendShown(): void {
  ensureLegendResizeListener();
  positionLegendUnderTitle();
  if (imgEl && !imgEl.complete) {
    imgEl.addEventListener("load", () => {
      positionLegendUnderTitle();
    }, { once: true });
  }
}

function clearSwapTimeout(): void {
  if (swapTimeoutId !== null) {
    clearTimeout(swapTimeoutId);
    swapTimeoutId = null;
  }
}

/** Slide the legend off-screen (emopain, all-layers, unknown ids). */
export function hideLegend(): void {
  clearSwapTimeout();
  currentFileName = null;
  const host = getLegendHost();
  host?.classList.remove("legend--visible");
  host?.removeAttribute("data-layer");
  if (host) host.style.left = "";
}

/**
 * Show the legend for `layerId`, or hide it when the layer has no SVG
 * (emopain and unknown ids).
 *
 * When already visible and switching to another legend layer, waits for the
 * 400ms slide-out before swapping the image and sliding back in.
 */
export function showLegend(layerId: string): void {
  const host = getLegendHost();
  if (!host) return;

  const fileName = LEGEND_SVG_BY_LAYER[layerId.trim()];
  if (!fileName) {
    hideLegend();
    return;
  }

  clearSwapTimeout();

  if (!imgEl) {
    imgEl = document.createElement("img");
    imgEl.className = "ui-legend__img";
    imgEl.alt = "";
    host.appendChild(imgEl);
  }

  imgEl.alt = `${layerId} legend`;
  const nextSrc = legendAssetUrl(fileName);
  const alreadyVisible = host.classList.contains("legend--visible");
  const switchingLegend = alreadyVisible && currentFileName !== fileName;

  if (switchingLegend) {
    host.classList.remove("legend--visible");
    void host.offsetHeight;
    currentFileName = fileName;
    swapTimeoutId = setTimeout(() => {
      swapTimeoutId = null;
      if (!imgEl) return;
      imgEl.src = nextSrc;
      host.dataset.layer = layerId.trim();
      host.classList.add("legend--visible");
      afterLegendShown();
    }, LEGEND_SWAP_RETRIGGER_MS);
    return;
  }

  imgEl.src = nextSrc;
  currentFileName = fileName;
  host.dataset.layer = layerId.trim();
  host.classList.add("legend--visible");
  afterLegendShown();
}
