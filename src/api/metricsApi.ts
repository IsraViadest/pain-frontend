/*
 * File attribution
 * edited by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 * changes: +74 / -60 lines (excluding attribution)
 * baseline: 53edb18a0826 (main before PR #15)
 */
import { apiUrl, useMockApi } from "./config";
import { getPainServerUserId } from "./session";
import { isConsentGiven } from "../survey/consentStorage";
import { MetricsQueue, type MetricEvent } from "./metricsQueue";

export type { MetricEvent } from "./metricsQueue";
export { textMetrics } from "./metricsQueue";

export const METRICS_KIND_LAYER = "layer" as const;
export const METRICS_KIND_WORD = "word" as const;
export const METRICS_KIND_TEMPORALITY = "temporality" as const;
export const METRICS_KIND_RELATION = "relation" as const;
export const METRICS_KIND_CATEGORY = "category" as const;

type MetricsToggleKind =
  | typeof METRICS_KIND_LAYER
  | typeof METRICS_KIND_WORD
  | typeof METRICS_KIND_TEMPORALITY
  | typeof METRICS_KIND_RELATION
  | typeof METRICS_KIND_CATEGORY;

let queue: MetricsQueue | undefined;
let interval: ReturnType<typeof setInterval> | undefined;

function tabId(): string {
  // getRandomValues also works on LAN HTTP; randomUUID requires a secure context.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 15) | 64;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function metricsQueue(): MetricsQueue {
  if (!queue) {
    queue = new MetricsQueue({
      tabId: tabId(), userId: getPainServerUserId, consent: isConsentGiven,
      send: async (batch) => {
        const abort = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 10000);
        try {
          const response = await fetch(apiUrl("/metrics/events"), {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(batch), signal: abort.signal,
          });
          // Error bodies can contain echoed input. Never log them from this boundary.
          return response.ok;
        } finally { clearTimeout(timeout); }
      },
      beacon: (batch) => navigator.sendBeacon(apiUrl("/metrics/events"),
        new Blob([JSON.stringify(batch)], { type: "application/json" })),
    });
    // Retries also cover events captured before /init has supplied the visit id.
    interval = setInterval(() => { void queue?.flush(); }, 5000);
  }
  return queue;
}

export function trackInteraction(event: MetricEvent): void {
  if (useMockApi) return;
  const buffer = metricsQueue();
  buffer.push(event);
  if (buffer.size >= 32) void buffer.flush();
}

export function flushInteractionMetrics(hiding = false): void {
  if (hiding) queue?.flushOnHide();
  else void queue?.flush();
}

export function stopInteractionMetrics(): void {
  clearInterval(interval);
  interval = undefined;
  queue = undefined;
}

/** Compatibility adapter. Survey option identities never enter the analytics event. */
export function trackToggle(
  kind: MetricsToggleKind,
  element: string,
  enabled: boolean,
): void {
  if (kind === "word" || kind === "temporality" || kind === "relation") {
    trackInteraction({ type: "survey", target: "survey-options", action: "change",
      step: kind === "word" ? 1 : kind === "temporality" ? 3 : 4, count: 1 });
  } else if (kind === "layer") {
    const layer = element === "all-layers" || element === "emopain" || element === "envpain" ||
      element === "physpain" || element === "socioecopain" ? element : undefined;
    if (layer) trackInteraction({ type: "control", target: "layer", action: enabled ? "enable" : "disable", layer, enabled });
  } else if (kind === "category") {
    const country = /^([A-Z]{3}):/.exec(element)?.[1];
    if (country) trackInteraction({ type: "country", target: "country", action: enabled ? "open" : "close", country });
    else if (element.startsWith("emotion-filter:")) trackInteraction({ type: "emotion", target: "emotion-filter",
      action: enabled ? "enable" : "disable", emotion: element.slice(15), enabled });
    else if (element === "festival:visit") trackInteraction({ type: "control", target: "festival", action: "click" });
  }
}

/** Historical step hooks retain their meaning with aggregate-only, consent-gated events. */
export function trackSurveyStep(step: 0 | 1 | 2 | 3 | 4 | 5,
  details: Pick<MetricEvent, "selectedCount" | "hasText" | "characters" | "durationMs"> = {}): void {
  trackInteraction({ ...details, type: "survey", target: "survey", step,
    action: step === 0 ? "open" : step === 5 ? "submit" : "next" });
}
