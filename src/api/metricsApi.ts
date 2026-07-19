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

type MetricsPostBody =
  | Omit<MetricsToggleBody, "userId">
  | Omit<MetricsVizModeBody, "userId">
  | Omit<MetricsSurveyStepBody, "userId">;

const METRICS_PATH_TOGGLE = "/toggle";
const METRICS_PATH_VIZMODE = "/vizmode";
const METRICS_PATH_SURVEYSTEP = "/surveystep";

/** POST under `/metrics` — `path` is the suffix only (e.g. `/toggle`). */
function postMetrics(path: string, body: MetricsPostBody): void {
  const metricsPath = `/metrics${path}`;
  if (useMockApi) return;
  const userId = getPainServerUserId();
  if (userId.length === 0) {
    console.warn(`[metricsApi] Skip ${metricsPath}: empty userId`);
    return;
  }

  void fetch(apiUrl(metricsPath), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...body }),
  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[metricsApi] POST ${metricsPath} failed: ${msg}`);
  });
}

/**
 * POST `/metrics/toggle` — fire-and-forget; mock-mode no-op; never throws.
 *
 * @param kind — toggle category (`layer`, `word`, `temporality`, `relation`, `category`).
 * @param element — not an arbitrary string: layer ids from GET `/init`, survey words from
 *   `SURVEY_WORD_CATEGORIES`, temporality from `SURVEY_TEMPORALITY_OPTIONS`, relations from
 *   `SURVEY_RELATIONS_OPTIONS`.
 * @param enabled — whether the element is toggled on or off.
 */
export function trackToggle(
  kind: MetricsToggleKind,
  element: string,
  enabled: boolean,
): void {
  const body: Omit<MetricsToggleBody, "userId"> = { kind, element, enabled };
  postMetrics(METRICS_PATH_TOGGLE, body);
}

/** POST `/metrics/vizmode` — fire-and-forget; mock-mode no-op; never throws. */
export function trackVizMode(mode: PainVisualizationMode): void {
  const body: Omit<MetricsVizModeBody, "userId"> = { mode };
  postMetrics(METRICS_PATH_VIZMODE, body);
}

/** POST `/metrics/surveystep` — fire-and-forget; mock-mode no-op; never throws. */
export function trackSurveyStep(step: MetricsSurveyStep): void {
  const body: Omit<MetricsSurveyStepBody, "userId"> = { step };
  postMetrics(METRICS_PATH_SURVEYSTEP, body);
}
