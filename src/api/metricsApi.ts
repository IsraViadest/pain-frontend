import type { PainVisualizationMode } from "../globe/GlobeView";
import type {
  SurveyRelationOption,
  SurveyTemporalityOption,
  SurveyWordOption,
} from "../survey/surveyData";
import { apiUrl, useMockApi } from "./config";
import { getPainServerUserId } from "./session";

type MetricsToggleKind =
  | "layer"
  | "word"
  | "temporality"
  | "relation"
  | "category";

type MetricsSurveyStep = 0 | 1 | 2 | 3 | 4 | 5;

/** Layer ids from pain-server GET /init (`id` field). */
type MetricsLayerId = "emopain" | "envpain" | "physpain" | "socioecopain";

const METRICS_LAYER_IDS: readonly MetricsLayerId[] = [
  "emopain",
  "envpain",
  "physpain",
  "socioecopain",
];

/** Production layer ids for `/metrics/toggle` (`kind: "layer"`). */
export { METRICS_LAYER_IDS };

/** True when `id` is a known production layer id for `/metrics/toggle`. */
export function isMetricsLayerId(id: string): id is MetricsLayerId {
  return (METRICS_LAYER_IDS as readonly string[]).includes(id);
}
type MetricsToggleElement =
  | MetricsLayerId
  | SurveyWordOption
  | SurveyTemporalityOption
  | SurveyRelationOption;

type MetricsToggleBody = {
  userId: string;
  kind: MetricsToggleKind;
  element: MetricsToggleElement;
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

/** POST `/metrics/toggle` — fire-and-forget; mock-mode no-op; never throws. */
export function trackToggle(
  kind: MetricsToggleKind,
  element: MetricsToggleElement,
  enabled: boolean,
): void {
  const body: Omit<MetricsToggleBody, "userId"> = { kind, element, enabled };
  postMetrics("/toggle", body);
}

/** POST `/metrics/vizmode` — fire-and-forget; mock-mode no-op; never throws. */
export function trackVizMode(mode: PainVisualizationMode): void {
  const body: Omit<MetricsVizModeBody, "userId"> = { mode };
  postMetrics("/vizmode", body);
}

/** POST `/metrics/surveystep` — fire-and-forget; mock-mode no-op; never throws. */
export function trackSurveyStep(step: MetricsSurveyStep): void {
  const body: Omit<MetricsSurveyStepBody, "userId"> = { step };
  postMetrics("/surveystep", body);
}
