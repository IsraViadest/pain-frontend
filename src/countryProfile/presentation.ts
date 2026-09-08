import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SURVEY_FLY_TO_DURATION_MS } from "../survey/surveyData";
import type { CountryPainProfile } from "./data";

type PresentationState =
  | "idle"
  | "preparing"
  | "flying"
  | "building"
  | "dwelling"
  | "stopping"
  | "paused-interaction"
  | "paused-user"
  | "backgrounded";

interface CountryPresentationOptions {
  appRoot: HTMLElement;
  controlHost?: HTMLElement;
  refinement?: boolean;
  profiles: ReadonlyMap<string, CountryPainProfile>;
  controls: OrbitControls;
  getSelectedIso3: () => string | null;
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
  previewCountry?: (iso3: string | null) => void;
  previewDuringFlight?: boolean;
  revealWithNetwork?: boolean;
  prepareMs?: number;
  flightMs?: number;
  dwellMs?: number;
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
  private readonly buttonStatus = document.createElement("span");
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
  private completionController: AbortController | null = null;
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
    if (options.refinement) {
      this.button.classList.add("country-presentation-toggle--refined");
      this.button.textContent = "country cycle ";
      this.button.setAttribute("aria-label", "Country cycle");
      this.buttonStatus.className = "country-presentation-toggle__state";
      this.buttonStatus.setAttribute("aria-hidden", "true");
      this.button.append(this.buttonStatus);
      options.controlHost?.classList.add("ui-title__toggles--refined");
    }
    this.button.setAttribute("aria-pressed", "false");
    this.button.addEventListener("click", this.toggle);

    this.warning.className = "country-presentation-warning";
    this.warning.dataset.countryPresentationControl = "true";
    this.warning.hidden = true;
    this.warning.setAttribute("role", "status");
    const warningText = document.createElement("span");
    warningText.textContent = "Presentation resumes in 15 seconds.";
    this.warningButton.type = "button";
    this.warningButton.textContent = options.refinement ? "pause 3 more minutes" : "keep paused";
    this.warningButton.addEventListener("click", this.extendPause);
    this.warning.append(warningText, this.warningButton);
    this.status.className = "country-presentation-status";
    this.status.setAttribute("role", "status");
    this.status.setAttribute("aria-live", "polite");
    (options.controlHost ?? options.appRoot).append(this.button);
    options.appRoot.append(this.warning, this.status);

    document.addEventListener("pointerdown", this.onUserActivity, true);
    document.addEventListener("wheel", this.onUserActivity, { capture: true, passive: true });
    document.addEventListener("keydown", this.onUserActivity, true);
    document.addEventListener("touchstart", this.onUserActivity, {
      capture: true,
      passive: true,
    });
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    options.controls.addEventListener("start", this.onControlsStart);
    this.reducedMotion.addEventListener("change", this.onReducedMotionChange);
    this.setState(this.reducedMotion.matches ? "paused-user" : "idle");
  }

  private setState(state: PresentationState): void {
    this.state = state;
    this.button.dataset.state = state;
    if (this.options.refinement) {
      const paused = state === "paused-interaction" || state === "backgrounded";
      this.buttonStatus.textContent = !this.enabled ? "off" : paused ? "paused" : "running";
      this.button.title = this.enabled ? "Stop country cycle" : "Start country cycle";
    }
  }

  private toggle = (): void => {
    if (this.enabled) this.stop();
    else void this.start();
  };

  private async start(): Promise<void> {
    if (this.enabled || this.countries.length === 0) return;
    const finishingStop = this.completionController !== null;
    this.cancelCompletion();
    this.enabled = true;
    if (!finishingStop) {
      this.previousLayer = this.options.getCurrentLayer();
      this.previousAutoSpin = this.options.getAutoSpin();
    }
    if (this.options.refinement) {
      const selected = this.options.getSelectedIso3();
      const index = this.countries.findIndex((country) => country.iso3 === selected);
      if (index >= 0) this.index = index;
    }
    this.options.setAutoSpin(false);
    this.options.setProfileAutoplay(true);
    this.options.setPresentationTiming(
      true,
      this.reducedMotion.matches ? 0 : this.timeScale,
    );
    this.options.setMotionPaused(false);
    if (!this.options.refinement) this.button.textContent = "stop presentation";
    this.button.setAttribute("aria-pressed", "true");
    this.status.textContent = "Presentation started.";
    await this.restartCurrent();
  }

  private stop(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.abortRun();
    this.cancelCompletion();
    this.clearIdleTimers();
    this.setState("stopping");
    this.options.setProfileAutoplay(false);
    this.options.setMotionPaused(false);
    this.options.previewCountry?.(null);
    this.options.clearCountry();
    this.options.setProfileSuppressed(false);
    this.options.setAutoSpin(this.previousAutoSpin);
    if (!this.options.refinement) this.button.textContent = "presentation";
    this.button.setAttribute("aria-pressed", "false");
    this.status.textContent = "Presentation stopped.";
    void this.finishMotion(true);
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
      this.options.previewCountry?.(null);
      this.options.setProfileSuppressed(true);
      this.options.clearCountry();
      await waitWhile(this.options.isRetreating, signal);
      await delay((this.options.prepareMs ?? (this.options.refinement ? 1000 : PREPARE_MS)) *
        this.timeScale, signal);

      this.setState("flying");
      if (this.options.refinement && this.options.previewDuringFlight !== false) {
        this.options.previewCountry?.(country.iso3);
      }
      await this.options.moveTo(
        country.iso3,
        signal,
        this.reducedMotion.matches ? 0 :
          (this.options.flightMs ?? SURVEY_FLY_TO_DURATION_MS) * this.timeScale,
      );

      this.setState("building");
      this.options.selectCountry(country.iso3);
      if (this.options.revealWithNetwork) {
        this.options.previewCountry?.(null);
        this.options.setProfileSuppressed(false);
      }
      await waitWhile(() => this.options.isBuilding(country.iso3), signal);
      if (!this.options.revealWithNetwork) {
        await delay((this.options.refinement ? 500 : REVEAL_DELAY_MS) * this.timeScale, signal);
        this.options.previewCountry?.(null);
        this.options.setProfileSuppressed(false);
      }

      this.setState("dwelling");
      await delay((this.options.dwellMs ?? DWELL_MS) * this.timeScale, signal);
      this.index = (this.index + 1) % this.countries.length;
    }
  }

  private pauseForInteraction(): void {
    if (!this.enabled || this.state === "backgrounded") return;
    if (this.state === "paused-interaction") {
      if (!this.completionController) this.armIdleTimers();
      return;
    }
    if (this.state === "flying" || this.state === "preparing") {
      this.options.previewCountry?.(null);
    }
    this.abortRun();
    this.clearIdleTimers();
    this.options.setProfileAutoplay(false);
    this.setState("paused-interaction");
    this.status.textContent =
      "Presentation paused after interaction. It will resume after three minutes.";
    void this.finishMotion(false);
  }

  /** Completion survives cancellation of the tour, but never a newer gesture or hidden tab. */
  private async finishMotion(stopping: boolean): Promise<void> {
    this.cancelCompletion();
    const controller = new AbortController();
    this.completionController = controller;
    try {
      // Manual selection callbacks run before their shared selection writer. Read after it commits.
      await delay(0, controller.signal);
      const iso3 = this.options.getSelectedIso3();
      await waitWhile(
        () => this.options.isRetreating() || (iso3 !== null && this.options.isBuilding(iso3)),
        controller.signal,
      );
      if (controller.signal.aborted || document.hidden) return;
      this.completionController = null;
      if (stopping) {
        this.options.setPresentationTiming(false, 1);
        this.options.restoreLayer(this.previousLayer);
        this.setState("paused-user");
      } else if (this.enabled && this.state === "paused-interaction") {
        if (this.options.getSelectedIso3() === iso3) {
          this.options.previewCountry?.(null);
          this.options.setProfileSuppressed(false);
        }
        this.armIdleTimers();
      }
    } catch (error) {
      if (!isAbort(error)) console.error("[countryPresentation] completion failed", error);
    }
  }

  private cancelCompletion(): void {
    this.completionController?.abort();
    this.completionController = null;
  }

  /** Let a human country click animate normally while the automated sequence remains paused. */
  allowManualMotion(): void {
    if (!this.enabled && this.completionController) {
      this.cancelCompletion();
      this.options.setPresentationTiming(false, 1);
      this.setState("paused-user");
    }
    if (this.state !== "paused-interaction") return;
    this.options.previewCountry?.(null);
    this.clearIdleTimers();
    this.options.setProfileSuppressed(false);
    this.options.setPresentationTiming(false, 1);
    this.options.setMotionPaused(false);
    this.options.setProfileAutoplay(false);
    void this.finishMotion(false);
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
      if (!this.completionController) this.armIdleTimers();
      return;
    }
    this.pauseForInteraction();
  };

  private onControlsStart = (): void => {
    this.pauseForInteraction();
  };

  private onVisibilityChange = (): void => {
    if (!this.enabled && this.state !== "stopping" && this.state !== "backgrounded") return;
    if (document.hidden) {
      this.options.previewCountry?.(null);
      this.abortRun();
      this.cancelCompletion();
      this.clearIdleTimers();
      this.options.setMotionPaused(true);
      this.options.setProfileAutoplay(false);
      this.setState("backgrounded");
      this.status.textContent = "Presentation paused while the page is hidden.";
      return;
    }
    if (this.state === "backgrounded") {
      this.options.setMotionPaused(false);
      this.setState(this.enabled ? "paused-interaction" : "stopping");
      this.status.textContent =
        "Presentation paused after returning. It will resume after three minutes.";
      void this.finishMotion(!this.enabled);
    }
  };

  private onReducedMotionChange = (): void => {
    if (!this.enabled) return;
    this.options.setPresentationTiming(true, this.reducedMotion.matches ? 0 : this.timeScale);
    if (!document.hidden) this.pauseForInteraction();
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
    if (document.querySelector("dialog[open]")) {
      this.armIdleTimers();
      return;
    }
    this.cancelCompletion();
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
    if (!this.completionController) this.armIdleTimers();
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
    this.cancelCompletion();
    this.clearIdleTimers();
    this.options.controls.removeEventListener("start", this.onControlsStart);
    this.reducedMotion.removeEventListener("change", this.onReducedMotionChange);
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
