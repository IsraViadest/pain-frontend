import { scheduleBubbleFieldLayout } from "./surveyBubbleLayout";
import { METRICS_KIND_RELATION, trackToggle } from "../api/metricsApi";
import {
  SURVEY_BLOB_DEFS,
  SURVEY_RELATIONS_OPTIONS,
  assignBlobId,
  ensureSurveyBlobKeyframes,
  hashSurveyString,
  surveyInitialPosition,
  surveyWordRotation,
  surveyWordScale,
  type SurveySessionState,
} from "./surveyData";

type SurveyScreen4Context = {
  state: SurveySessionState;
  onBack: () => void;
  onAdvance: () => void;
};

type SurveyScreen4Controller = {
  unmount: () => void;
};

function toggleRelation(state: SurveySessionState, relation: string): boolean {
  const index = state.relations.indexOf(relation);
  if (index >= 0) {
    state.relations.splice(index, 1);
    return false;
  }
  state.relations.push(relation);
  return true;
}

/**
 * Survey screen 4 — multi-select relation blobs (who the user carries pain with).
 */
export function mountSurveyScreen4(
  host: HTMLElement,
  { state, onBack, onAdvance }: SurveyScreen4Context,
): SurveyScreen4Controller {
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
  root.className = "survey-screen survey-screen--4";

  const title = document.createElement("h2");
  title.className = "survey-screen__title";
  title.textContent =
    "Who do you carry this pain with? (click all that apply)";

  const field = document.createElement("div");
  field.className = "survey-screen__bubble-field";
  field.setAttribute("role", "group");
  field.setAttribute("aria-label", "Pain relation options");

  const anchors: HTMLElement[] = [];

  for (const relation of SURVEY_RELATIONS_OPTIONS) {
    const seed = surveyInitialPosition(relation);
    const blobId = assignBlobId(relation);
    const blob = SURVEY_BLOB_DEFS[blobId];
    const isSelected = state.relations.includes(relation);

    const anchor = document.createElement("div");
    anchor.className = "survey-bubble-anchor";
    anchor.dataset.relation = relation;
    anchor.style.left = `${seed.left}%`;
    anchor.style.top = `${seed.top}%`;
    anchor.style.setProperty("--bubble-scale", String(surveyWordScale(relation)));
    anchor.style.setProperty(
      "--bubble-rotate",
      `${surveyWordRotation(relation)}deg`,
    );
    anchor.style.animationDelay = `${(hashSurveyString(relation) % 40) / 10}s`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `survey-bubble survey-bubble--${blobId}`;
    if (isSelected) {
      button.classList.add("survey-bubble--selected");
    }
    button.dataset.relation = relation;
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
    label.textContent = relation;

    button.append(svg, label);
    anchor.appendChild(button);

    addListener(button, "click", () => {
      const selected = toggleRelation(state, relation);
      button.classList.toggle("survey-bubble--selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      trackToggle(METRICS_KIND_RELATION, relation, selected);
    });

    field.appendChild(anchor);
    anchors.push(anchor);
  }

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "survey-screen__back";
  backBtn.setAttribute("aria-label", "Back to temporality selection");
  backBtn.textContent = "←";

  const advanceBtn = document.createElement("button");
  advanceBtn.type = "button";
  advanceBtn.className = "survey-screen__advance";
  advanceBtn.setAttribute("aria-label", "Continue to next step");
  advanceBtn.textContent = "→";

  root.append(title, field, backBtn, advanceBtn);
  host.appendChild(root);

  addListener(backBtn, "click", onBack);
  addListener(advanceBtn, "click", onAdvance);

  const layoutSchedule = scheduleBubbleFieldLayout(field, anchors, () => {
    field.classList.add("survey-screen__bubble-field--ready");
  });

  return {
    unmount: () => {
      layoutSchedule.cancel();
      for (const cleanup of cleanups) cleanup();
      root.remove();
    },
  };
}
