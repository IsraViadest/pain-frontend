import {
  SURVEY_BLOB_DEFS,
  SURVEY_TEMPORALITY_LAYOUT,
  SURVEY_TEMPORALITY_OPTIONS,
  assignBlobId,
  ensureSurveyBlobKeyframes,
  hashSurveyString,
  surveyWordRotation,
  surveyWordScale,
  type SurveySessionState,
} from "./surveyData";
import { METRICS_KIND_TEMPORALITY, trackToggle } from "../api/metricsApi";

type SurveyScreen3Context = {
  state: SurveySessionState;
  onBack: () => void;
  onAdvance: () => void;
};

type SurveyScreen3Controller = {
  unmount: () => void;
};

function toggleTemporality(state: SurveySessionState, option: string): boolean {
  const index = state.temporality.indexOf(option);
  if (index >= 0) {
    state.temporality.splice(index, 1);
    return false;
  }
  state.temporality.push(option);
  return true;
}

/**
 * Survey screen 3 — multi-select temporality blobs (how long the pain has lasted).
 */
export function mountSurveyScreen3(
  host: HTMLElement,
  { state, onBack, onAdvance }: SurveyScreen3Context,
): SurveyScreen3Controller {
  ensureSurveyBlobKeyframes();

  const cleanups: (() => void)[] = [];
  const addListener = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void => {
    target.addEventListener(type, listener as EventListener, options);
    cleanups.push(() => {
      target.removeEventListener(type, listener as EventListener, options);
    });
  };

  const root = document.createElement("div");
  root.className = "survey-screen survey-screen--3";

  const title = document.createElement("h2");
  title.className = "survey-screen__title";
  title.innerHTML =
    'How long have you felt this pain?<br><span class="survey-screen__title-hint">(click all that apply)</span>';

  const field = document.createElement("div");
  field.className = "survey-screen__temporality-field";
  field.setAttribute("role", "group");
  field.setAttribute("aria-label", "Pain duration options");

  for (const option of SURVEY_TEMPORALITY_OPTIONS) {
    const layout = SURVEY_TEMPORALITY_LAYOUT[option];
    const blobId = assignBlobId(option);
    const blob = SURVEY_BLOB_DEFS[blobId];
    const isSelected = state.temporality.includes(option);

    const anchor = document.createElement("div");
    anchor.className = "survey-bubble-anchor";
    anchor.dataset.option = option;
    anchor.style.left = `${layout.left}%`;
    anchor.style.top = `${layout.top}%`;
    anchor.style.setProperty("--bubble-scale", String(surveyWordScale(option)));
    anchor.style.setProperty(
      "--bubble-rotate",
      `${surveyWordRotation(option)}deg`,
    );
    anchor.style.animationDelay = `${(hashSurveyString(option) % 40) / 10}s`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `survey-bubble survey-bubble--${blobId}`;
    if (isSelected) {
      button.classList.add("survey-bubble--selected");
    }
    button.dataset.option = option;
    button.setAttribute("aria-pressed", String(isSelected));

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", blob.viewBox);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("survey-bubble__svg");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", blob.paths[1]);
    path.classList.add("survey-bubble__path", `survey-bubble__path--${blobId}`);
    svg.appendChild(path);

    const label = document.createElement("span");
    label.className = "survey-bubble__label";
    label.textContent = option;

    button.append(svg, label);
    anchor.appendChild(button);

    addListener(button, "click", () => {
      const selected = toggleTemporality(state, option);
      button.classList.toggle("survey-bubble--selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      trackToggle(METRICS_KIND_TEMPORALITY, option, selected);
    });

    field.appendChild(anchor);
  }

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "survey-screen__back";
  backBtn.setAttribute("aria-label", "Back to map placement");
  backBtn.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 10H4M9 5L4 10l5 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const advanceBtn = document.createElement("button");
  advanceBtn.type = "button";
  advanceBtn.className = "survey-screen__advance";
  advanceBtn.setAttribute("aria-label", "Continue to next step");
  advanceBtn.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 10h12M11 5l5 5-5 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  root.append(title, field, backBtn, advanceBtn);
  host.appendChild(root);

  addListener(backBtn, "click", onBack);
  addListener(advanceBtn, "click", onAdvance);

  return {
    unmount: () => {
      for (const cleanup of cleanups) cleanup();
      root.remove();
    },
  };
}
