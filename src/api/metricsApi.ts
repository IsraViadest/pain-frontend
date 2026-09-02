import { apiUrl, useMockApi } from "./config";
import { getPainServerUserId } from "./session";

export const METRICS_KIND_LAYER = "layer" as const;
export const METRICS_KIND_WORD = "word" as const;
export const METRICS_KIND_TEMPORALITY = "temporality" as const;
export const METRICS_KIND_RELATION = "relation" as const;
// Defined but not exported yet — no call sites. Export once subcategory tracking is implemented.
const METRICS_KIND_CATEGORY = "category" as const;

type MetricsToggleKind =
  | typeof METRICS_KIND_LAYER
  | typeof METRICS_KIND_WORD
  | typeof METRICS_KIND_TEMPORALITY
  | typeof METRICS_KIND_RELATION
  | typeof METRICS_KIND_CATEGORY;

type MetricsSurveyStep = 0 | 1 | 2 | 3 | 4 | 5;

type MetricsToggleBody = {
  userId: string;
  kind: MetricsToggleKind;
  element: string;
  enabled: boolean;
};

type MetricsSurveyStepBody = {
  userId: string;
  step: MetricsSurveyStep;
};

type MetricsPostBody =
  | Omit<MetricsToggleBody, "userId">
  | Omit<MetricsSurveyStepBody, "userId">;

const METRICS_PATH_TOGGLE = "/toggle";
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
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(
          `[metricsApi] POST ${metricsPath} → ${res.status}: ${text}`,
        );
      }
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[metricsApi] POST ${metricsPath} failed: ${msg}`);
    });
}

/**
 * POST `/metrics/toggle` — fire-and-forget; mock-mode no-op; never throws.
 *
 * @param kind — toggle category ({@link METRICS_KIND_LAYER}, {@link METRICS_KIND_WORD}, etc.).
 * @param element — not an arbitrary string: layer ids from GET `/init`, survey words from
 *   `SURVEY_WORDS`, temporality from `SURVEY_TEMPORALITY_OPTIONS`, relations from
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

/** POST `/metrics/surveystep` — fire-and-forget; mock-mode no-op; never throws. */
export function trackSurveyStep(step: MetricsSurveyStep): void {
  const body: Omit<MetricsSurveyStepBody, "userId"> = { step };
  postMetrics(METRICS_PATH_SURVEYSTEP, body);
}
