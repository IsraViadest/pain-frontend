/** created by: Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 * Only these semantic codes and aggregate numbers may cross the analytics boundary. */
const METRIC_TYPES = ["control", "country", "emotion", "survey", "window", "gesture", "page"] as const;
const METRIC_TARGETS = ["layer", "all-layers", "theme", "sound", "about", "sources", "share", "consent", "survey", "survey-options", "survey-text", "survey-body", "country", "emotion", "emotion-filter", "globe", "page", "festival", "workshop", "result", "cycle", "quality", "menu", "source-link", "about-link", "globe-rotate", "globe-zoom"] as const;
const METRIC_ACTIONS = ["click", "open", "close", "change", "enable", "disable", "next", "back", "submit", "start", "end", "visible", "hidden", "input"] as const;
const LAYERS = ["emopain", "envpain", "physpain", "socioecopain", "all-layers"] as const;
const EMOTIONS = ["01_pain", "02_hurt", "03_eco_anxiety", "04_uncertainty", "05_grief", "06_anger", "07_hardship", "08_displacement", "09_trauma", "10_loneliness", "11_depression", "12_fear", "13_helplessness", "14_shame"] as const;

export type MetricEvent = {
  type: typeof METRIC_TYPES[number]; target: typeof METRIC_TARGETS[number];
  action: typeof METRIC_ACTIONS[number]; country?: string; emotion?: string;
  enabled?: boolean; layer?: typeof LAYERS[number]; step?: number; count?: number;
  selectedCount?: number; hasText?: boolean; characters?: number; durationMs?: number;
};
type SequencedMetricEvent = MetricEvent & { seq: number; atMs: number };
type MetricBatch = { userId: string; tabId: string; consent: boolean; events: SequencedMetricEvent[] };
const MAX_METRIC_QUEUE = 256;
const MAX_METRIC_BATCH = 32;

function needsSurveyConsent(event: Pick<MetricEvent, "type" | "target">): boolean {
  return event.type === "survey" || event.target.startsWith("survey") || event.target === "result";
}

/** Copy an allowlist, never arbitrary properties, text, answer ids, or DOM attributes. */
function sanitizeMetric(event: MetricEvent, consent: boolean): MetricEvent | null {
  if (!METRIC_TYPES.includes(event.type) || !METRIC_TARGETS.includes(event.target) ||
      !METRIC_ACTIONS.includes(event.action) || (needsSurveyConsent(event) && !consent)) return null;
  const clean: MetricEvent = { type: event.type, target: event.target, action: event.action };
  const survey = needsSurveyConsent(event);
  if (!survey) {
    if (typeof event.country === "string" && /^[A-Z]{3}$/.test(event.country)) clean.country = event.country;
    if (EMOTIONS.some((emotion) => emotion === event.emotion)) clean.emotion = event.emotion;
    if (LAYERS.some((layer) => layer === event.layer)) clean.layer = event.layer;
    if (typeof event.enabled === "boolean") clean.enabled = event.enabled;
  }
  for (const [key, max] of [["step", 5], ["count", 10000], ["selectedCount", 10000], ["characters", 100000], ["durationMs", 86400000]] as const) {
    if (!survey && key !== "count" && key !== "durationMs") continue;
    const value = event[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) clean[key] = Math.min(max, Math.round(value));
  }
  if (survey && typeof event.hasText === "boolean") clean.hasText = event.hasText;
  return clean;
}

/** In-memory only: bounded retention, one request at a time, stable ids on every retry. */
export class MetricsQueue {
  private events: SequencedMetricEvent[] = [];
  private seq = 0;
  private sending = false;
  private retryAt = 0;
  private failures = 0;
  dropped = 0;

  constructor(private readonly options: {
    tabId: string; userId: () => string; consent: () => boolean;
    send: (batch: MetricBatch) => Promise<boolean>;
    beacon: (batch: MetricBatch) => boolean;
    now?: () => number;
  }) {}

  get size(): number { return this.events.length; }

  push(event: MetricEvent): void {
    const clean = sanitizeMetric(event, this.options.consent());
    if (!clean) return;
    // Retain the oldest unacknowledged events so a retry never changes its identifiers.
    if (this.events.length >= MAX_METRIC_QUEUE) { this.dropped++; return; }
    this.events.push({ ...clean, seq: ++this.seq, atMs: Date.now() });
  }

  private batch(): MetricBatch | null {
    const consent = this.options.consent();
    if (!consent) this.events = this.events.filter((event) => !needsSurveyConsent(event));
    const userId = this.options.userId();
    if (!/^[A-Za-z0-9]{16}$/.test(userId) || !this.events.length) return null;
    return { userId, tabId: this.options.tabId, consent, events: this.events.slice(0, MAX_METRIC_BATCH) };
  }

  async flush(): Promise<void> {
    const now = this.options.now?.() ?? Date.now();
    if (this.sending || now < this.retryAt) return;
    const batch = this.batch();
    if (!batch) return;
    this.sending = true;
    try {
      if (await this.options.send(batch)) {
        const accepted = new Set(batch.events.map((event) => event.seq));
        this.events = this.events.filter((event) => !accepted.has(event.seq));
        this.failures = 0;
        this.retryAt = 0;
      } else {
        this.retryAt = now + Math.min(60000, 5000 * 2 ** Math.min(this.failures++, 4));
      }
    } catch {
      this.retryAt = now + Math.min(60000, 5000 * 2 ** Math.min(this.failures++, 4));
    } finally {
      this.sending = false;
    }
  }

  /** A beacon has no acknowledgement. Keep events for retry if this page returns from bfcache. */
  flushOnHide(): void {
    const batch = this.batch();
    if (!batch) return;
    // Stay below the shared 64 KiB keepalive quota, including another in-flight request.
    let bytes = 0;
    for (let offset = 0; offset < this.events.length; offset += MAX_METRIC_BATCH) {
      const part = { ...batch, events: this.events.slice(offset, offset + MAX_METRIC_BATCH) };
      bytes += new TextEncoder().encode(JSON.stringify(part)).byteLength;
      if (bytes > 48 * 1024 || !this.options.beacon(part)) break;
    }
  }
}

/** Visible time excludes background tabs and can be sampled at transitions without an interval. */
export class VisibleDuration {
  private total = 0;
  private since: number | null = null;
  constructor(private readonly now: () => number = () => performance.now()) {}
  setVisible(visible: boolean): void {
    const now = this.now();
    if (this.since !== null) this.total += now - this.since;
    this.since = visible ? now : null;
  }
  read(): number {
    return Math.round(this.total + (this.since === null ? 0 : this.now() - this.since));
  }
  /** Drain a duration segment, retaining fractional milliseconds for the next checkpoint. */
  take(): number {
    const now = this.now();
    const elapsed = this.total + (this.since === null ? 0 : now - this.since);
    const whole = Math.floor(elapsed);
    this.total = elapsed - whole;
    if (this.since !== null) this.since = now;
    return whole;
  }
}

export function textMetrics(text: string): Pick<MetricEvent, "hasText" | "characters"> {
  // Unicode code points, not UTF-16 units. The source string never enters the queue.
  return { hasText: text.length > 0, characters: Array.from(text).length };
}
