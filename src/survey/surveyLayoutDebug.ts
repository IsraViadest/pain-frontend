/**
 * Opt-in blob layout tuning HUD (`?surveyDebug=1`).
 * Mounted from main.ts; lives outside the survey modal.
 */
import {
  SURVEY_BUBBLE_GAP_PX,
  SURVEY_FIELD_INSET_FRAC,
  SURVEY_INIT_CELL_OFFSET_FRAC,
  SURVEY_LAYOUT_MAX_ITERATIONS,
} from "./surveyData";
import { rerunBubbleFieldLayout } from "./surveyBubbleLayout";
import { resetSurveyLayoutOverrides, surveyLayoutOverrides } from "./surveyLayoutOverrides";

type SliderSpec = {
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  decimals: number;
  get: () => number;
  setOverride: (value: number) => void;
};

function shouldShowSurveyLayoutDebug(): boolean {
  try {
    const v = new URLSearchParams(window.location.search).get("surveyDebug");
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

function formatSliderValue(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

/**
 * Mount layout debug panel when `?surveyDebug=1`; otherwise returns null.
 * @returns Cleanup when mounted, null when debug mode is off.
 */
export function mountSurveyLayoutDebug(): (() => void) | null {
  if (!shouldShowSurveyLayoutDebug()) return null;

  const panel = document.createElement("aside");
  panel.className = "survey-layout-debug";
  panel.setAttribute("aria-label", "Survey blob layout debug");

  const title = document.createElement("h2");
  title.className = "survey-layout-debug__title";
  title.textContent = "Blob layout";

  const sliders: SliderSpec[] = [
    {
      label: "SURVEY_BUBBLE_GAP_PX",
      min: 0,
      max: 80,
      step: 1,
      defaultValue: SURVEY_BUBBLE_GAP_PX,
      decimals: 0,
      get: () => surveyLayoutOverrides.bubbleGapPx ?? SURVEY_BUBBLE_GAP_PX,
      setOverride: (value) => {
        surveyLayoutOverrides.bubbleGapPx = value;
      },
    },
    {
      label: "SURVEY_LAYOUT_MAX_ITERATIONS",
      min: 10,
      max: 300,
      step: 10,
      defaultValue: SURVEY_LAYOUT_MAX_ITERATIONS,
      decimals: 0,
      get: () =>
        surveyLayoutOverrides.layoutMaxIterations ?? SURVEY_LAYOUT_MAX_ITERATIONS,
      setOverride: (value) => {
        surveyLayoutOverrides.layoutMaxIterations = value;
      },
    },
    {
      label: "SURVEY_FIELD_INSET_FRAC",
      min: 0,
      max: 0.2,
      step: 0.01,
      defaultValue: SURVEY_FIELD_INSET_FRAC,
      decimals: 2,
      get: () => surveyLayoutOverrides.fieldInsetFrac ?? SURVEY_FIELD_INSET_FRAC,
      setOverride: (value) => {
        surveyLayoutOverrides.fieldInsetFrac = value;
      },
    },
    {
      label: "SURVEY_INIT_CELL_OFFSET_FRAC",
      min: 0,
      max: 0.5,
      step: 0.01,
      defaultValue: SURVEY_INIT_CELL_OFFSET_FRAC,
      decimals: 2,
      get: () =>
        surveyLayoutOverrides.initCellOffsetFrac ?? SURVEY_INIT_CELL_OFFSET_FRAC,
      setOverride: (value) => {
        surveyLayoutOverrides.initCellOffsetFrac = value;
      },
    },
  ];

  for (const spec of sliders) {
    const row = document.createElement("label");
    row.className = "survey-layout-debug__row";

    const name = document.createElement("span");
    name.className = "survey-layout-debug__label";
    name.textContent = spec.label;

    const valueEl = document.createElement("span");
    valueEl.className = "survey-layout-debug__value";
    valueEl.textContent = formatSliderValue(spec.get(), spec.decimals);

    const input = document.createElement("input");
    input.type = "range";
    input.className = "survey-layout-debug__slider";
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.value = String(spec.get());

    input.addEventListener("input", () => {
      const value = Number(input.value);
      spec.setOverride(value);
      valueEl.textContent = formatSliderValue(value, spec.decimals);
    });

    row.append(name, valueEl, input);
    panel.appendChild(row);
  }

  const rerunBtn = document.createElement("button");
  rerunBtn.type = "button";
  rerunBtn.className = "survey-layout-debug__rerun";
  rerunBtn.textContent = "Re-run layout";
  rerunBtn.addEventListener("click", () => {
    rerunBubbleFieldLayout();
  });

  panel.prepend(title);
  panel.appendChild(rerunBtn);
  document.body.appendChild(panel);

  return () => {
    panel.remove();
    resetSurveyLayoutOverrides();
  };
}
