import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SURVEY_FLY_TO_DURATION_MS } from "../survey/surveyData";
import type { CountryPainProfile } from "./data";

type PresentationState =
  | "idle"
  | "preparing"
  | "flying"
  | "building"
  | "dwelling"
  | "paused-interaction"
  | "paused-user"
  | "backgrounded";

interface CountryPresentationOptions {
  appRoot: HTMLElement;
  profiles: ReadonlyMap<string, CountryPainProfile>;
  controls: OrbitControls;
  getCurrentLayer: () => string;
  enterAllLayers: () => Promise<void>;
  restoreLayer: (layerId: string) => void;
  moveTo: (iso3: string, signal: AbortSignal, durationMs: number) => Promise<void>;
  selectCountry: (iso3: string) => void;
  clearCountry: () => void;
  isBuilding: (iso3: string) => boolean;
  isRetreating: () => boolean;
  setMotionPaused: (paused: boolean) => void;
  setPresentationTiming: (active: boolean, timeScale: number) => void;
  setProfileSuppressed: (suppressed: boolean) => void;
  setProfileAutoplay: (autoplay: boolean) => void;
  getAutoSpin: () => boolean;
  setAutoSpin: (enabled: boolean) => void;
}

const PREPARE_MS = 3000;
const REVEAL_DELAY_MS = 1000;
const DWELL_MS = 30000;
const IDLE_WARNING_MS = 165000;
const IDLE_RESUME_MS = 180000;
const FOCUS_RECHECK_MS = 1000;

function readTestTimeScale(): number {
  const raw = Number(new URLSearchParams(window.location.search).get("cpTimeScale") ?? 1);
  return Number.isFinite(raw) ? Math.max(0.005, Math.min(1, raw)) : 1;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(done, ms);
    function done(): void {
      signal.removeEventListener("abort", abort);
      resolve();
    }
    function abort(): void {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(new DOMException("Aborted", "AbortError"));
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

function waitWhile(predicate: () => boolean, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    let frame = 0;
    const abort = (): void => {
      cancelAnimationFrame(frame);
      signal.removeEventListener("abort", abort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const check = (): void => {
      if (signal.aborted) return;
      if (!predicate()) {
        signal.removeEventListener("abort", abort);
        resolve();
        return;
      }
      frame = requestAnimationFrame(check);
    };
    signal.addEventListener("abort", abort, { once: true });
    frame = requestAnimationFrame(check);
  });
}

/** Runs the optional alphabetical country presentation and owns all of its timers. */
export class CountryPresentation {
  private readonly button = document.createElement("button");
  private readonly warning = document.createElement("div");
  private readonly warningButton = document.createElement("button");
  private readonly status = document.createElement("span");
  private readonly countries: CountryPainProfile[];
  private readonly timeScale = readTestTimeScale();
  private readonly reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  private state: PresentationState = "idle";
  private enabled = false;
  private index = 0;
  private previousLayer = "all-layers";
  private previousAutoSpin = true;
  private runController: AbortController | null = null;
  private warningTimer: number | null = null;
  private resumeTimer: number | null = null;

  constructor(private readonly options: CountryPresentationOptions) {
    this.countries = [...options.profiles.values()].sort((a, b) =>
      a.countryName.localeCompare(b.countryName, "en"),
    );
    this.button.type = "button";
    this.button.id = "country-presentation-toggle";
    this.button.className = "country-presentation-toggle";
    this.button.dataset.countryPresentationControl = "true";
    this.button.textContent = "presentation";
    this.button.setAttribute("aria-pressed", "false");
    this.button.addEventListener("click", this.toggle);

    this.warning.className = "country-presentation-warning";
    this.warning.dataset.countryPresentationControl = "true";
    this.warning.hidden = true;
    this.warning.setAttribute("role", "status");
    const warningText = document.createElement("span");
    warningText.textContent = "Presentation resumes in 15 seconds.";
    this.warningButton.type = "button";
    this.warningButton.textContent = "keep paused";
    this.warningButton.addEventListener("click", this.extendPause);
    this.warning.append(warningText, this.warningButton);
    this.status.className = "country-presentation-status";
    this.status.setAttribute("role", "status");
    this.status.setAttribute("aria-live", "polite");
    options.appRoot.append(this.button, this.warning, this.status);

    document.addEventListener("pointerdown", this.onUserActivity, true);
    document.addEventListener("wheel", this.onUserActivity, { capture: true, passive: true });
    document.addEventListener("keydown", this.onUserActivity, true);
    document.addEventListener("touchstart", this.onUserActivity, {
      capture: true,
      passive: true,
    });
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    options.controls.addEventListener("start", this.onControlsStart);
    this.setState(this.reducedMotion.matches ? "paused-user" : "idle");
  }

  private setState(state: PresentationState): void {
    this.state = state;
    this.button.dataset.state = state;
  }

  private toggle = (): void => {
    if (this.enabled) this.stop();
    else void this.start();
  };

  private async start(): Promise<void> {
    if (this.enabled || this.countries.length === 0) return;
    this.enabled = true;
    this.previousLayer = this.options.getCurrentLayer();
    this.previousAutoSpin = this.options.getAutoSpin();
    this.options.setAutoSpin(false);
    this.options.setProfileAutoplay(true);
    this.options.setPresentationTiming(
      true,
      this.reducedMotion.matches ? 0 : this.timeScale,
    );
    this.options.setMotionPaused(false);
    this.button.textContent = "stop presentation";
    this.button.setAttribute("aria-pressed", "true");
    this.status.textContent = "Presentation started.";
    await this.restartCurrent();
  }

  private stop(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.abortRun();
    this.clearIdleTimers();
    this.options.setProfileAutoplay(false);
    this.options.setPresentationTiming(false, 1);
    this.options.setMotionPaused(false);
    this.options.clearCountry();
    this.options.setProfileSuppressed(false);
    this.options.setAutoSpin(this.previousAutoSpin);
    this.options.restoreLayer(this.previousLayer);
    this.button.textContent = "presentation";
    this.button.setAttribute("aria-pressed", "false");
    this.setState("paused-user");
    this.status.textContent = "Presentation stopped.";
  }

  private async restartCurrent(): Promise<void> {
    this.clearIdleTimers();
    this.warning.hidden = true;
    this.abortRun();
    const controller = new AbortController();
    this.runController = controller;
    try {
      await this.options.enterAllLayers();
      if (controller.signal.aborted) return;
      await this.run(controller.signal);
    } catch (error) {
      if (!isAbort(error)) {
        console.error("[countryPresentation] stopped after an error", error);
        this.stop();
      }
    }
  }

  private async run(signal: AbortSignal): Promise<void> {
    while (this.enabled && !signal.aborted) {
      const country = this.countries[this.index]!;
      this.setState("preparing");
      this.options.setProfileSuppressed(true);
      this.options.clearCountry();
      await waitWhile(this.options.isRetreating, signal);
      await delay(PREPARE_MS * this.timeScale, signal);

      this.setState("flying");
      await this.options.moveTo(
        country.iso3,
        signal,
        this.reducedMotion.matches ? 0 : SURVEY_FLY_TO_DURATION_MS * this.timeScale,
      );

      this.setState("building");
      this.options.selectCountry(country.iso3);
      await waitWhile(() => this.options.isBuilding(country.iso3), signal);
      await delay(REVEAL_DELAY_MS * this.timeScale, signal);
      this.options.setProfileSuppressed(false);

      this.setState("dwelling");
      await delay(DWELL_MS * this.timeScale, signal);
      this.index = (this.index + 1) % this.countries.length;
    }
  }

  private pauseForInteraction(): void {
    if (!this.enabled || this.state === "paused-user") return;
    this.abortRun();
    this.options.setMotionPaused(true);
    this.options.setProfileAutoplay(false);
    this.setState("paused-interaction");
    this.status.textContent =
      "Presentation paused after interaction. It will resume after three minutes.";
    this.armIdleTimers();
  }

  /** Let a human country click animate normally while the automated sequence remains paused. */
  allowManualMotion(): void {
    if (this.state !== "paused-interaction") return;
    this.options.setProfileSuppressed(false);
    this.options.setPresentationTiming(false, 1);
    this.options.setMotionPaused(false);
    this.options.setProfileAutoplay(false);
  }

  private onUserActivity = (event: Event): void => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("[data-country-presentation-control]")
    ) {
      return;
    }
    if (!this.enabled) return;
    if (this.state === "paused-interaction") {
      this.armIdleTimers();
      return;
    }
    this.pauseForInteraction();
  };

  private onControlsStart = (): void => {
    this.pauseForInteraction();
  };

  private onVisibilityChange = (): void => {
    if (!this.enabled) return;
    if (document.hidden) {
      this.abortRun();
      this.clearIdleTimers();
      this.options.setMotionPaused(true);
      this.options.setProfileAutoplay(false);
      this.setState("backgrounded");
      this.status.textContent = "Presentation paused while the page is hidden.";
      return;
    }
    if (this.state === "backgrounded") {
      this.setState("paused-interaction");
      this.status.textContent =
        "Presentation paused after returning. It will resume after three minutes.";
      this.armIdleTimers();
    }
  };

  private armIdleTimers(): void {
    this.clearIdleTimers();
    this.warning.hidden = true;
    this.warningTimer = window.setTimeout(() => {
      if (this.state === "paused-interaction") this.warning.hidden = false;
    }, IDLE_WARNING_MS * this.timeScale);
    this.resumeTimer = window.setTimeout(
      this.resumeAfterIdle,
      IDLE_RESUME_MS * this.timeScale,
    );
  }

  private resumeAfterIdle = (): void => {
    if (this.state !== "paused-interaction") return;
    if (
      this.button.contains(document.activeElement) ||
      this.warning.contains(document.activeElement)
    ) {
      this.warning.hidden = true;
      this.resumeTimer = window.setTimeout(
        this.resumeAfterIdle,
        Math.max(50, FOCUS_RECHECK_MS * this.timeScale),
      );
      return;
    }
    this.warning.hidden = true;
    this.options.setPresentationTiming(
      true,
      this.reducedMotion.matches ? 0 : this.timeScale,
    );
    this.options.setMotionPaused(false);
    this.options.setProfileAutoplay(true);
    this.status.textContent = "Presentation resumed.";
    void this.restartCurrent();
  };

  private extendPause = (): void => {
    this.armIdleTimers();
  };

  private clearIdleTimers(): void {
    if (this.warningTimer !== null) window.clearTimeout(this.warningTimer);
    if (this.resumeTimer !== null) window.clearTimeout(this.resumeTimer);
    this.warningTimer = null;
    this.resumeTimer = null;
    this.warning.hidden = true;
  }

  private abortRun(): void {
    this.runController?.abort();
    this.runController = null;
  }

  destroy(): void {
    this.enabled = false;
    this.abortRun();
    this.clearIdleTimers();
    this.options.controls.removeEventListener("start", this.onControlsStart);
    document.removeEventListener("pointerdown", this.onUserActivity, true);
    document.removeEventListener("wheel", this.onUserActivity, true);
    document.removeEventListener("keydown", this.onUserActivity, true);
    document.removeEventListener("touchstart", this.onUserActivity, true);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.button.remove();
    this.warning.remove();
    this.status.remove();
  }
}
