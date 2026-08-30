import { scheduleBubbleFieldLayout } from "./surveyBubbleLayout";
import { createSurveyAdvanceGate } from "./surveyAdvanceGate";
import { isConsentGiven } from "./consentStorage";
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
  title.innerHTML =
    'Select the words that describe your pain<br><span class="survey-screen__title-hint">(click all that apply)</span>';

  const field = document.createElement("div");
  field.className = "survey-screen__bubble-field";
  field.setAttribute("role", "group");
  field.setAttribute("aria-label", "Pain descriptor words");

  const advanceGate = createSurveyAdvanceGate(
    "Please select at least one word",
    onAdvance,
  );

  const syncAdvanceEnabled = (): void => {
    advanceGate.setEnabled(state.selectedWords.size >= 1);
  };

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
      if (isConsentGiven()) {
        trackToggle(METRICS_KIND_WORD, word, selected);
      }
      syncAdvanceEnabled();
    });

    field.appendChild(anchor);
    anchors.push(anchor);
  }

  syncAdvanceEnabled();

  root.append(title, field, advanceGate.validationMsg, advanceGate.wrapper);
  host.appendChild(root);

  const layoutSchedule = scheduleBubbleFieldLayout(field, anchors, () => {
    field.classList.add("survey-screen__bubble-field--ready");
  });

  return {
    unmount: () => {
      layoutSchedule.cancel();
      advanceGate.dispose();
      root.remove();
    },
  };
}
