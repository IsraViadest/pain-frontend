import { SURVEY_FADE_MS } from "./surveyData";

let overlayEl: HTMLElement | null = null;

function ensureOverlay(host: HTMLElement): HTMLElement {
  if (overlayEl) return overlayEl;

  overlayEl = document.createElement("div");
  overlayEl.className = "survey-loading-overlay";
  overlayEl.setAttribute("aria-hidden", "true");

  const text = document.createElement("p");
  text.className = "survey-loading-overlay__text";
  text.textContent = "sentimental ecological analysis";

  overlayEl.appendChild(text);
  host.appendChild(overlayEl);
  return overlayEl;
}

/** Full-screen loading scrim over the globe after survey submit. */
export function showSurveyLoadingOverlay(host: HTMLElement): void {
  const overlay = ensureOverlay(host);
  overlay.setAttribute("aria-hidden", "false");
  overlay.classList.add("survey-loading-overlay--visible");
}

/** Fade out and hide the post-submit loading overlay. */
export function hideSurveyLoadingOverlay(): Promise<void> {
  if (!overlayEl) return Promise.resolve();

  overlayEl.classList.remove("survey-loading-overlay--visible");
  overlayEl.setAttribute("aria-hidden", "true");

  return new Promise((resolve) => {
    window.setTimeout(resolve, SURVEY_FADE_MS);
  });
}
