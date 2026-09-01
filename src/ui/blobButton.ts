/**
 * Blob-shaped UI buttons — fetches SVG assets and swaps path fill between gray and gradient.
 */

import { playButtonSound } from "../sound/buttonSound";

const BLOB_GRADIENT_STOPS: ReadonlyArray<{ offset: string; color: string }> = [
  { offset: "0%", color: "#103CCB" },
  { offset: "25%", color: "#774B7F" },
  { offset: "50%", color: "#B7372D" },
  { offset: "75%", color: "#C66300" },
  { offset: "100%", color: "#BC9772" },
];

const INACTIVE_FILL = "#D9D9D9";

/** Visual mode for a blob button. */
type BlobButtonVariant = "layer" | "share" | "info";

type CreateBlobButtonOptions = {
  /** Filename under `public/blobs/` (e.g. `emotional.svg` or `emotional`). */
  svgName: string;
  /** Optional label rendered below the blob (Hypodermic in CSS). */
  label?: string;
  variant: BlobButtonVariant;
  onClick?: () => void;
  /**
   * When true, active state keeps native SVG fill ({@link activeFill}) instead of gradient.
   * For multi-path assets (e.g. physpain gray + red dots).
   */
  skipActiveGradient?: boolean;
  /** Fill when active and {@link skipActiveGradient} is set. */
  activeFill?: string;
  /** Optional click sound URL (e.g. {@link SOUND_BUTTON_BLOB} from `buttonSound.ts`). */
  soundFile?: string;
};

type BlobButtonState = {
  variant: BlobButtonVariant;
  path: SVGPathElement;
  gradientId: string;
  active: boolean;
  skipActiveGradient: boolean;
  activeFill: string;
};

const blobButtonState = new WeakMap<HTMLElement, BlobButtonState>();

function blobAssetUrl(svgName: string): string {
  const file = svgName.endsWith(".svg") ? svgName : `${svgName}.svg`;
  const base = import.meta.env.BASE_URL;
  return `${base}blobs/${file}`;
}

function uniqueGradientId(): string {
  return `blob-grad-${Math.random().toString(36).slice(2, 10)}`;
}

function injectGradient(svg: SVGSVGElement, gradientId: string): void {
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.insertBefore(defs, svg.firstChild);
  }

  const gradient = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "linearGradient",
  );
  gradient.id = gradientId;
  gradient.setAttribute("x1", "0%");
  gradient.setAttribute("y1", "0%");
  gradient.setAttribute("x2", "100%");
  gradient.setAttribute("y2", "0%");

  for (const stop of BLOB_GRADIENT_STOPS) {
    const stopEl = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "stop",
    );
    stopEl.setAttribute("offset", stop.offset);
    stopEl.setAttribute("stop-color", stop.color);
    gradient.appendChild(stopEl);
  }

  defs.appendChild(gradient);
}

function prepareBlobPath(path: SVGPathElement): void {
  path.setAttribute("fill", INACTIVE_FILL);
  path.removeAttribute("stroke");
}

function applyBlobFill(state: BlobButtonState): void {
  const { path, gradientId, variant, active, skipActiveGradient, activeFill } =
    state;
  const useGradient =
    variant === "share" ||
    (variant === "layer" && active && !skipActiveGradient);
  if (useGradient) {
    path.setAttribute("fill", `url(#${gradientId})`);
  } else if (variant === "layer" && active && skipActiveGradient) {
    path.setAttribute("fill", activeFill);
  } else {
    path.setAttribute("fill", INACTIVE_FILL);
  }
}

function syncBlobButtonClasses(el: HTMLElement, state: BlobButtonState): void {
  el.classList.toggle("blob-button--active", state.variant === "layer" && state.active);
  el.classList.toggle("blob-button--inactive", state.variant !== "share" && !state.active);
  el.classList.toggle("blob-button--share", state.variant === "share");
}

/**
 * Fetch a blob SVG, inject a left-to-right gradient def, and build a clickable button.
 *
 * @param options — asset name, optional label, variant, optional {@link CreateBlobButtonOptions.soundFile}, and click handler.
 * @returns A `<button class="blob-button">` with inline SVG (fill manipulated on the path).
 */
export async function createBlobButton(
  options: CreateBlobButtonOptions,
): Promise<HTMLButtonElement> {
  const { svgName, label, variant, onClick, skipActiveGradient, activeFill, soundFile } =
    options;

  const button = document.createElement("button");
  button.type = "button";
  button.className = `blob-button blob-button--${variant}`;

  const res = await fetch(blobAssetUrl(svgName));
  if (!res.ok) {
    throw new Error(`[blobButton] Failed to load ${svgName}: HTTP ${res.status}`);
  }

  const svgText = await res.text();
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  const path = doc.querySelector("path");
  if (!svg || !path) {
    throw new Error(`[blobButton] Invalid blob SVG: ${svgName}`);
  }

  const gradientId = uniqueGradientId();
  injectGradient(svg, gradientId);
  prepareBlobPath(path);

  svg.classList.add("blob-button__svg");
  svg.setAttribute("aria-hidden", "true");
  button.appendChild(svg);

  if (label) {
    const labelEl = document.createElement("span");
    labelEl.className = "blob-button__label";
    labelEl.textContent = label;
    button.appendChild(labelEl);
  }

  const state: BlobButtonState = {
    variant,
    path,
    gradientId,
    active: false,
    skipActiveGradient: skipActiveGradient === true,
    activeFill: activeFill ?? "#3F3F3F",
  };
  blobButtonState.set(button, state);
  applyBlobFill(state);
  syncBlobButtonClasses(button, state);

  if (soundFile || onClick) {
    button.addEventListener("click", () => {
      if (soundFile) {
        playButtonSound(soundFile);
      }
      onClick?.();
    });
  }

  return button;
}

/**
 * Toggle the active gradient state on a layer-variant blob button.
 *
 * No-op for `share` and `info` variants.
 *
 * @param el — element returned from {@link createBlobButton}.
 * @param active — `true` for gradient fill at 70% wrapper opacity; `false` for gray at 50%.
 */
export function setActive(el: HTMLElement, active: boolean): void {
  const state = blobButtonState.get(el);
  if (!state || state.variant !== "layer") return;
  state.active = active;
  applyBlobFill(state);
  syncBlobButtonClasses(el, state);
}
