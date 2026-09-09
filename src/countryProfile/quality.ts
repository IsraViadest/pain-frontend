type CountryQualityLevel = "light" | "standard" | "rich";
type CountryQualityRequest = CountryQualityLevel | "auto";

const PROFILES = {
  light: { capacity: 16_384, detail: "split1", surfaceDetail: 1, samples: 16, fraction: 0.25, budgetBytes: 64 * 1024 ** 2 },
  standard: { capacity: 32_768, detail: "split1", surfaceDetail: 2, samples: 16, fraction: 0.5, budgetBytes: 128 * 1024 ** 2 },
  rich: { capacity: 65_536, detail: "split2", surfaceDetail: 2, samples: 32, fraction: 0.5, budgetBytes: 128 * 1024 ** 2 },
} as const;

/** Frame pacing chooses bounded detail; it never advances or resets the country presentation. */
export class CountryRenderQuality {
  readonly request: CountryQualityRequest;
  level: CountryQualityLevel;
  target: CountryQualityLevel;
  p95Ms = 0;
  medianMs = 0;
  nominalFrameMs = 0;
  private lastFrame: number | null = null;
  private warmUntil = 0;
  private cooldownUntil = 0;
  private healthyWindows = 0;
  private slowWindows = 0;
  private readonly samples: number[] = [];

  constructor(request: string, private readonly highQuality = false) {
    if (!["auto", "light", "standard", "rich"].includes(request)) {
      throw new Error(`Unknown cpQuality: ${request}`);
    }
    this.request = request as CountryQualityRequest;
    this.level = this.target = request === "auto" ? "light" : request as CountryQualityLevel;
  }

  get settings() { return PROFILES[this.target]; }
  get activeBudgetBytes(): number {
    // HQ adds map detail even if automatic frame pacing keeps geometry at Light.
    return Math.max(PROFILES[this.level].budgetBytes, this.highQuality ? 128 * 1024 ** 2 : 0);
  }

  /** Apply means request new render settings; report also covers a completed pool transition. */
  tick(now: number, busy: boolean, ready: boolean, hidden = false): "apply" | "report" | null {
    if (hidden || this.lastFrame === null || now - this.lastFrame > 250) {
      this.lastFrame = hidden ? null : now;
      this.warmUntil = now + 3000;
      this.samples.length = 0;
      this.healthyWindows = this.slowWindows = 0;
      return null;
    }
    const elapsed = now - this.lastFrame;
    this.lastFrame = now;
    if (!ready) {
      this.samples.length = 0;
      return null;
    }
    if (this.level !== this.target) {
      this.level = this.target;
      this.samples.length = 0;
      this.warmUntil = now + 1000;
      return "report";
    }
    if (elapsed <= 0 || now < this.warmUntil) return null;
    this.samples.push(elapsed);
    if (this.samples.length < 120) return null;
    this.samples.sort((a, b) => a - b);
    this.medianMs = this.samples[59];
    this.p95Ms = this.samples[113];
    this.samples.length = 0;
    // Frame cadence is useful for adaptation, but is not a GPU execution-time measurement.
    if (!this.nominalFrameMs) {
      const observed = Math.min(1000 / 60, this.medianMs);
      this.nominalFrameMs = [240, 165, 144, 120, 90, 60].map((hz) => 1000 / hz)
        .reduce((best, interval) => Math.abs(interval - observed) < Math.abs(best - observed) ? interval : best);
    }
    const healthy = this.p95Ms <= Math.min(17.7, this.nominalFrameMs * 1.25 + 0.5);
    const slow = this.p95Ms > Math.min(17.7, this.nominalFrameMs * 1.5 + 1);
    this.healthyWindows = healthy ? this.healthyWindows + 1 : 0;
    this.slowWindows = slow ? this.slowWindows + 1 : 0;
    if (this.request !== "auto" || busy) return "report";
    if (this.level === "light" && this.healthyWindows >= 3 && now >= this.cooldownUntil) {
      this.target = "standard";
    } else if (this.level === "standard" && this.slowWindows >= 2) {
      this.target = "light";
    } else return "report";
    this.cooldownUntil = now + 60_000;
    this.healthyWindows = this.slowWindows = 0;
    return "apply";
  }
}
