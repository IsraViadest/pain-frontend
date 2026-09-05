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
let currentContent: SVGSVGElement | undefined;
const generatedContentByLayer = new Map<string, SVGSVGElement>();
let swapTimeoutId: ReturnType<typeof setTimeout> | null = null;
let resizeBound = false;
let chromeBounds: ResizeObserver | undefined;
let profileChanges: MutationObserver | undefined;
let observedProfile: HTMLElement | null = null;

function legendAssetUrl(fileName: string): string {
  const base = import.meta.env.BASE_URL;
  return `${base}legend/${fileName}`;
}

function getLegendHost(): HTMLElement | null {
  return document.getElementById("ui-legend");
}

/**
 * Desktop: center `#ui-legend` under `.ui-title__heading` (“P.A.I.N.”). Mobile: clear inline left.
 */
function positionLegendUnderTitle(): void {
  const host = getLegendHost();
  if (!host) return;
  currentContent?.dispatchEvent(new Event("resize"));
  const picker = document.getElementById("ui-layer-stack");
  const title = document.getElementById("ui-title");
  const share = document.getElementById("ui-share-pain");
  const profile = document.getElementById("country-profile");
  if (profile !== observedProfile) {
    if (observedProfile) chromeBounds?.unobserve(observedProfile);
    profileChanges?.disconnect();
    observedProfile = profile;
    if (profile) {
      chromeBounds?.observe(profile);
      profileChanges ??= new MutationObserver(positionLegendUnderTitle);
      profileChanges.observe(profile, { attributes: true, attributeFilter: ["style", "hidden"] });
    }
  }
  const compact = innerWidth <= MOBILE_MAX_WIDTH_PX || innerHeight <= 500;
  const about = document.getElementById("ui-bottom-left");
  if (about && share) about.style.maxWidth = compact
    ? `${Math.max(48, share.getBoundingClientRect().left - 28)}px` : "";
  if (picker && title && share) {
    const top = title.getBoundingClientRect().bottom + 12;
    let bottom = share.getBoundingClientRect().top - 12;
    const card = profile?.getBoundingClientRect();
    const pickerLeft = innerWidth - 20 - picker.getBoundingClientRect().width;
    if (card && card.width > 0 && pickerLeft < card.right + 8 && innerWidth - 20 > card.left - 8) {
      bottom = Math.min(bottom, card.top - 12);
    }
    const naturalHeight = picker.scrollHeight;
    const centeredTop = innerHeight / 2 - 40 - naturalHeight / 2;
    const constrained = compact && (innerHeight <= 500 || centeredTop < top || centeredTop + naturalHeight > bottom);
    const available = Math.max(0, bottom - top);
    picker.toggleAttribute("data-height-constrained", constrained);
    picker.style.top = constrained ? `${top}px` : "";
    picker.style.maxHeight = constrained ? `${available}px` : "";
    if (constrained) picker.style.setProperty("--picker-available-height", `${available}px`);
    else picker.style.removeProperty("--picker-available-height");
  }
  if (compact) {
    host.style.left = "";
    return;
  }
  const headingEl = document.querySelector<HTMLElement>(".ui-title__heading");
  if (!headingEl) return;
  // Title block is at left: 20px; heading.offsetLeft is relative to #ui-title.
  host.style.left = `${TITLE_INSET_LEFT_PX + headingEl.offsetLeft + headingEl.offsetWidth / 2 - host.offsetWidth / 2}px`;
}

function ensureLegendResizeListener(): void {
  if (resizeBound) return;
  resizeBound = true;
  window.addEventListener("resize", () => {
    positionLegendUnderTitle();
  });
  chromeBounds = new ResizeObserver(positionLegendUnderTitle);
  for (const id of ["ui-title", "ui-share-pain"]) {
    const element = document.getElementById(id);
    if (element) chromeBounds.observe(element);
  }
}

/** Position after paint (and again when the SVG finishes loading). */
function afterLegendShown(): void {
  ensureLegendResizeListener();
  positionLegendUnderTitle();
  if (imgEl?.isConnected && !imgEl.complete) {
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
  ensureLegendResizeListener();
  clearSwapTimeout();
  currentFileName = null;
  currentContent = undefined;
  const host = getLegendHost();
  host?.classList.remove("legend--visible");
  host?.removeAttribute("data-layer");
  if (host) host.style.left = "";
  positionLegendUnderTitle();
}

/**
 * Show the legend for `layerId`, or hide it when the layer has no SVG
 * (emopain and unknown ids). Supplied SVG content is remembered per trimmed layer id.
 * Omit content to reuse it, or pass null to clear it and restore the legacy image.
 *
 * When already visible and switching to another legend layer, waits for the
 * 400ms slide-out before swapping the image and sliding back in.
 */
export function showLegend(layerId: string, content?: SVGSVGElement | null): void {
  const layer = layerId.trim();
  if (content === null) generatedContentByLayer.delete(layer);
  else if (content !== undefined) generatedContentByLayer.set(layer, content);
  content = generatedContentByLayer.get(layer);
  const host = getLegendHost();
  if (!host) return;

  const fileName = LEGEND_SVG_BY_LAYER[layer] ?? null;
  if (!fileName && !content) {
    hideLegend();
    return;
  }

  clearSwapTimeout();

  if (!content && !imgEl) {
    imgEl = document.createElement("img");
    imgEl.className = "ui-legend__img";
    imgEl.alt = "";
  }

  if (imgEl) imgEl.alt = `${layer} legend`;
  const nextSrc = fileName ? legendAssetUrl(fileName) : "";
  const alreadyVisible = host.classList.contains("legend--visible");
  const switchingLegend = alreadyVisible &&
    (currentFileName !== fileName || currentContent !== content);
  currentFileName = fileName;
  currentContent = content;
  const show = (): void => {
    if (content) {
      content.classList.add("ui-legend__img");
      host.replaceChildren(content);
    } else if (imgEl) {
      imgEl.src = nextSrc;
      host.replaceChildren(imgEl);
    }
    host.dataset.layer = layer;
    host.classList.add("legend--visible");
    afterLegendShown();
  };

  if (switchingLegend) {
    host.classList.remove("legend--visible");
    void host.offsetHeight;
    swapTimeoutId = setTimeout(() => {
      swapTimeoutId = null;
      show();
    }, LEGEND_SWAP_RETRIGGER_MS);
    return;
  }

  show();
}
