import {
  trackSurveyStep,
  trackToggle,
  trackVizMode,
} from "../api/metricsApi";
import { PAIN_VIZ_MODE } from "../globe/GlobeView";
import { submitSurvey } from "../survey/surveyApi";
import type { SurveySubmissionPayload } from "../survey/surveyData";

/** Hardcoded payload for pain-server `POST /survey` smoke tests. */
function testSurveyPayload(): SurveySubmissionPayload {
  return {
    wordBubbles: ["grief", "smog"],
    wordBody: [{ word: "grief", lat: 48.2, lng: 16.37 }],
    temporality: ["days"],
    relations: ["the ocean"],
    painDescription: "Test submission from dummy button",
  };
}

/** POST the hardcoded survey payload and log the response (no fly-to or modal). */
async function onTestSurveyPayloadClick(): Promise<void> {
  const res = await submitSurvey(testSurveyPayload());
  if (res == null) {
    console.warn("[surveyTestPanel] Survey test: submitSurvey returned null");
    return;
  }
  console.log("[surveyTestPanel] Survey test response:", res);
}

/** Fire one event to each metrics endpoint and log confirmation. */
function onTestMetricsPayloadClick(): void {
  trackToggle("layer", "envpain", true);
  trackVizMode(PAIN_VIZ_MODE.scars);
  trackSurveyStep(1);
  console.log("[surveyTestPanel] Metrics test fired");
}

/**
 * Mount a temporary bottom-left panel with survey/metrics POST smoke-test buttons.
 * Dev-only: call from `main.ts` when `import.meta.env.DEV` is true.
 */
export function mountSurveyTestPanel(host: HTMLElement): void {
  const panel = document.createElement("div");
  panel.setAttribute("aria-label", "Temporary database test panel");
  Object.assign(panel.style, {
    position: "fixed",
    left: "8px",
    bottom: "8px",
    zIndex: "20",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "8px 10px",
    border: "1px dashed #888",
    borderRadius: "4px",
    background: "rgba(0, 0, 0, 0.75)",
    color: "#eee",
    fontFamily: "monospace",
    fontSize: "11px",
    maxWidth: "200px",
  });

  const label = document.createElement("div");
  label.textContent = "TEMP DB test (remove)";
  label.style.fontWeight = "bold";
  label.style.marginBottom = "2px";

  const surveyBtn = document.createElement("button");
  surveyBtn.type = "button";
  surveyBtn.textContent = "Test Survey Payload";
  // TEMP: remove once Mike confirms database setup
  surveyBtn.addEventListener("click", () => {
    void onTestSurveyPayloadClick();
  });

  const metricsBtn = document.createElement("button");
  metricsBtn.type = "button";
  metricsBtn.textContent = "Test Metrics Payload";
  // TEMP: remove once Mike confirms database setup
  metricsBtn.addEventListener("click", onTestMetricsPayloadClick);

  for (const btn of [surveyBtn, metricsBtn]) {
    Object.assign(btn.style, {
      padding: "4px 8px",
      fontSize: "11px",
      cursor: "pointer",
      textAlign: "left",
    });
  }

  panel.append(label, surveyBtn, metricsBtn);
  host.appendChild(panel);
}
