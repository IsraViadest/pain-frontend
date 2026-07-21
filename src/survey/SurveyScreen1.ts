import { scheduleBubbleFieldLayout } from "./surveyBubbleLayout";
import { METRICS_KIND_WORD, trackToggle } from "../api/metricsApi";
import {
  SURVEY_BLOB_DEFS,
  SURVEY_WORDS,
  assignBlobId,
  ensureSurveyBlobKeyframes,
  hashSurveyString,
  surveyInitialPosition,
  surveyWordRotation,
  surveyWordScale,
  type SurveySessionState,
} from "./surveyData";

type SurveyScreen1Context = {
  state: SurveySessionState;
  onAdvance: () => void;
};

type SurveyScreen1Controller = {
  unmount: () => void;
};

/**
 * Survey screen 1 — word selection: organic word bubbles with blob backgrounds.
 */
export function mountSurveyScreen1(
  host: HTMLElement,
  { state, onAdvance }: SurveyScreen1Context,
): SurveyScreen1Controller {
  ensureSurveyBlobKeyframes();
  const root = document.createElement("div");
  root.className = "survey-screen survey-screen--1";

  const title = document.createElement("h2");
  title.className = "survey-screen__title";
  title.textContent =
    "Select the words that describe your pain (click all that apply).";

  const field = document.createElement("div");
  field.className = "survey-screen__bubble-field";
  field.setAttribute("role", "group");
  field.setAttribute("aria-label", "Pain descriptor words");

  const anchors: HTMLElement[] = [];

  for (const word of SURVEY_WORDS) {
    const seed = surveyInitialPosition(word);
    const blobId = assignBlobId(word);
    const blob = SURVEY_BLOB_DEFS[blobId];

    const anchor = document.createElement("div");
    anchor.className = "survey-bubble-anchor";
    anchor.dataset.word = word;
    anchor.style.left = `${seed.left}%`;
    anchor.style.top = `${seed.top}%`;
    anchor.style.setProperty("--bubble-scale", String(surveyWordScale(word)));
    anchor.style.setProperty(
      "--bubble-rotate",
      `${surveyWordRotation(word)}deg`,
    );
    anchor.style.animationDelay = `${(hashSurveyString(word) % 40) / 10}s`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `survey-bubble survey-bubble--${blobId}`;
    button.dataset.word = word;
    button.setAttribute("aria-pressed", "false");

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
    label.textContent = word;

    button.append(svg, label);
    anchor.appendChild(button);

    button.addEventListener("click", () => {
      const selected = button.classList.toggle("survey-bubble--selected");
      button.setAttribute("aria-pressed", String(selected));
      if (selected) {
        state.selectedWords.add(word);
      } else {
        state.selectedWords.delete(word);
      }
      trackToggle(METRICS_KIND_WORD, word, selected);
    });

    field.appendChild(anchor);
    anchors.push(anchor);
  }

  const advanceBtn = document.createElement("button");
  advanceBtn.type = "button";
  advanceBtn.className = "survey-screen__advance";
  advanceBtn.setAttribute("aria-label", "Continue to next step");
  advanceBtn.textContent = "→";
  advanceBtn.addEventListener("click", onAdvance);

  root.append(title, field, advanceBtn);
  host.appendChild(root);

  const layoutSchedule = scheduleBubbleFieldLayout(field, anchors, () => {
    field.classList.add("survey-screen__bubble-field--ready");
  });

  return {
    unmount: () => {
      layoutSchedule.cancel();
      root.remove();
    },
  };
}
