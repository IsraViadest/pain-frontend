import type { PainVisualizationMode } from "../globe/GlobeView";
import { apiUrl, useMockApi } from "./config";
import { getPainServerUserId } from "./session";

type MetricsToggleKind =
  | "layer"
  | "word"
  | "temporality"
  | "relation"
  | "category";

type MetricsSurveyStep = 0 | 1 | 2 | 3 | 4 | 5;

type MetricsToggleBody = {
  userId: string;
  kind: MetricsToggleKind;
  element: string;
  enabled: boolean;
};

type MetricsVizModeBody = {
  userId: string;
  mode: PainVisualizationMode;
};

type MetricsSurveyStepBody = {
  userId: string;
  step: MetricsSurveyStep;
};

function postMetrics(path: string, body: object): void {
  if (useMockApi) return;
  const userId = getPainServerUserId();
  if (userId.length === 0) {
    console.warn(`[metricsApi] Skip ${path}: empty userId`);
    return;
  }

  void fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...body }),
  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[metricsApi] POST ${path} failed: ${msg}`);
  });
}

/** POST `/metrics/toggle` — fire-and-forget; mock-mode no-op; never throws. */
export function trackToggle(
  kind: MetricsToggleKind,
  element: string,
  enabled: boolean,
): void {
  const body: Omit<MetricsToggleBody, "userId"> = { kind, element, enabled };
  postMetrics("/metrics/toggle", body);
}

/** POST `/metrics/vizmode` — fire-and-forget; mock-mode no-op; never throws. */
export function trackVizMode(mode: PainVisualizationMode): void {
  const body: Omit<MetricsVizModeBody, "userId"> = { mode };
  postMetrics("/metrics/vizmode", body);
}

/** POST `/metrics/surveystep` — fire-and-forget; mock-mode no-op; never throws. */
export function trackSurveyStep(step: MetricsSurveyStep): void {
  const body: Omit<MetricsSurveyStepBody, "userId"> = { step };
  postMetrics("/metrics/surveystep", body);
}

