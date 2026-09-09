import type { SurveySessionState } from "./surveyData";
import { textMetrics, trackInteraction } from "../api/metricsApi";
import {
  playButtonSound,
  SOUND_BUTTON_SUBMIT,
  SOUND_BUTTON_SURVEY_ARROW,
} from "../sound/buttonSound";

type SurveyScreen5Context = {
  state: SurveySessionState;
  onBack: () => void;
  onSubmit: () => void;
};

type SurveyScreen5Controller = {
  unmount: () => void;
};

/**
 * Survey screen 5 — free-text pain description and submit (final step).
 */
export function mountSurveyScreen5(
  host: HTMLElement,
  { state, onBack, onSubmit }: SurveyScreen5Context,
): SurveyScreen5Controller {
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
  root.className = "survey-screen survey-screen--5";

  const title = document.createElement("h2");
  title.className = "survey-screen__title";
  title.textContent = "Describe your pain experience.";

  const painText = document.createElement("textarea");
  painText.className = "survey-screen__pain-text";
  painText.placeholder = "I feel…";
  painText.value = state.painText;
  painText.setAttribute("aria-label", "Describe your pain experience");

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "survey-screen__back";
  backBtn.setAttribute("aria-label", "Back to relations selection");
  backBtn.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 10H4M9 5L4 10l5 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "survey-screen__advance";
  submitBtn.setAttribute("aria-label", "Submit survey");
  submitBtn.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 10h12M11 5l5 5-5 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  root.append(title, painText, backBtn, submitBtn);
  host.appendChild(root);

  let inputTimer: ReturnType<typeof setTimeout> | undefined;
  let inputCount = 0;
  const recordTextActivity = (): void => {
    if (!inputCount) return;
    trackInteraction({ type: "survey", target: "survey-text", action: "input", step: 5,
      count: inputCount, ...textMetrics(state.painText) });
    inputCount = 0;
    clearTimeout(inputTimer);
  };
  addListener(painText, "input", () => {
    state.painText = painText.value;
    inputCount++;
    clearTimeout(inputTimer);
    inputTimer = setTimeout(recordTextActivity, 500);
  });
  addListener(painText, "blur", recordTextActivity);
  const onVisibility = (): void => { if (document.hidden) recordTextActivity(); };
  document.addEventListener("visibilitychange", onVisibility);
  cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));

  addListener(backBtn, "click", () => {
    playButtonSound(SOUND_BUTTON_SURVEY_ARROW);
    onBack();
  });

  addListener(submitBtn, "click", () => {
    playButtonSound(SOUND_BUTTON_SUBMIT);
    state.painText = painText.value;
    recordTextActivity();
    onSubmit();
  });

  return {
    unmount: () => {
      recordTextActivity();
      for (const cleanup of cleanups) cleanup();
      root.remove();
    },
  };
}
