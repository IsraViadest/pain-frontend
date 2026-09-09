/** created by: Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach */
import { flushInteractionMetrics, stopInteractionMetrics, trackInteraction, type MetricEvent } from "./metricsApi";
import { VisibleDuration } from "./metricsQueue";

type Target = MetricEvent["target"];
type OpenWindow = { duration: VisibleDuration; country?: string };
const CONTROL_TARGETS: readonly Target[] = ["sound", "theme", "about", "sources", "share", "menu", "cycle", "quality"];
const MODALS = [".info-modal--visible", ".consent-modal--visible", ".survey-modal--visible", ".survey-result-modal--visible"];
const WINDOW_ELEMENTS = ".info-modal,.consent-modal,.survey-modal,.survey-result-modal,#country-profile";

/** One semantic observer for fixed chrome. It never collects text, hrefs, form values or coordinates. */
export function installInteractionMetrics(canvas: HTMLCanvasElement): () => void {
  const abort = new AbortController();
  const signal = abort.signal;
  let infoTarget: "about" | "sources" = "about";
  const windows = new Map<Target, OpenWindow>();
  const page = new VisibleDuration();
  page.setVisible(!document.hidden);
  trackInteraction({ type: "page", target: "page", action: "open" });
  const recordWindow = (target: Target, entry: OpenWindow, action: "open" | "close" | "hidden" | "visible"): void => {
    trackInteraction({ type: "window", target, action, country: entry.country,
      ...(action === "open" ? {} : { durationMs: entry.duration.take() }) });
  };

  const syncModals = (): void => {
    const visible = new Map<Target, string | undefined>();
    if (document.querySelector(MODALS[0])) visible.set(infoTarget, undefined);
    if (document.querySelector(MODALS[1])) visible.set("consent", undefined);
    if (document.querySelector(MODALS[2])) visible.set("survey", undefined);
    if (document.querySelector(MODALS[3])) visible.set("result", undefined);
    const profile = document.querySelector<HTMLElement>("#country-profile");
    if (profile && !profile.hidden && /^[A-Z]{3}$/.test(profile.dataset.country ?? "")) {
      visible.set("country", profile.dataset.country);
    }
    for (const [target, entry] of windows) {
      if (visible.has(target) && visible.get(target) === entry.country) continue;
      recordWindow(target, entry, "close");
      windows.delete(target);
    }
    for (const [target, country] of visible) {
      if (windows.has(target)) continue;
      const duration = new VisibleDuration();
      duration.setVisible(!document.hidden);
      const entry = { duration, country };
      windows.set(target, entry);
      recordWindow(target, entry, "open");
    }
  };
  const observer = new MutationObserver((records) => {
    // Ignore text replacement and all per-frame transform/opacity writes on globe labels.
    if (records.some((record) => record.type === "attributes"
      ? record.target instanceof Element && (record.target.matches("#country-profile")
        ? record.attributeName === "hidden" || record.attributeName === "data-country"
        : record.attributeName === "class" && record.target.matches(WINDOW_ELEMENTS))
      : [...record.addedNodes, ...record.removedNodes].some((node) => node instanceof Element &&
        (node.matches(WINDOW_ELEMENTS) || node.querySelector(WINDOW_ELEMENTS))))) syncModals();
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "hidden", "data-country"] });

  document.addEventListener("click", (event) => {
    // Target handlers may replace children or disable the button before this bubble listener runs.
    // The original propagation path still identifies the control that received the activation.
    const path = event.composedPath().filter((node): node is Element => node instanceof Element);
    const screen = path.find(node => node.matches(".survey-screen"));
    if (screen && path.some(node => node.matches("button,.survey-screen__advance-wrapper,.survey-map-pin"))) {
      const step = [1, 2, 3, 4, 5].find((value) => screen.classList.contains(`survey-screen--${value}`));
      // Count activations and blocked advance attempts without identifying an answer button.
      trackInteraction({ type: "survey", target: "survey", action: "click", step, count: 1,
        ...([1, 3, 4].includes(step ?? 0) ? { selectedCount: screen.querySelectorAll('[aria-pressed="true"]').length } : {}) });
      return;
    }
    const button = path.find((node): node is HTMLElement => node instanceof HTMLElement && node.matches("button,a,[role=button]"));
    if (!button) return;
    const target = button.dataset.metricTarget as Target | undefined;
    if (target && CONTROL_TARGETS.includes(target)) {
      if (target === "about" || target === "sources") infoTarget = target;
      const pressed = button.getAttribute("aria-pressed") ?? button.getAttribute("aria-checked") ?? button.getAttribute("aria-expanded");
      trackInteraction({ type: "control", target, action: "click", ...(pressed === null ? {} : { enabled: pressed === "true" }) });
    } else if (button.matches("[data-layer]")) {
      const layer = button.dataset.layer === "all-pain" ? "all-layers" : button.dataset.layer;
      trackInteraction({ type: "control", target: "layer", action: "click", layer: layer as MetricEvent["layer"] });
    } else if (button.matches(".emo-legend__item")) {
      trackInteraction({ type: "emotion", target: "emotion", action: "click", emotion: button.dataset.cat });
    } else if (button.matches(".emo-legend__exclude")) {
      trackInteraction({ type: "emotion", target: "emotion-filter", action: "click", emotion: button.dataset.cat });
    } else if (button.matches(".festival-media__workshop")) {
      trackInteraction({ type: "control", target: "workshop", action: "click" });
    } else if (button.matches(".consent-modal__btn")) {
      trackInteraction({ type: "control", target: "consent", action: "click",
        enabled: button.classList.contains("consent-modal__btn--agree") });
    } else if (path.some(node => node.matches(".info-modal")) && button.matches("a")) {
      trackInteraction({ type: "control", target: infoTarget === "sources" ? "source-link" : "about-link", action: "click" });
    } else if (button.matches(".info-modal__close")) {
      trackInteraction({ type: "control", target: infoTarget, action: "close" });
    } else if (button.matches(".survey-result-modal__close")) {
      trackInteraction({ type: "control", target: "result", action: "close" });
    }
  }, { signal });

  // One event per completed drag/pinch/wheel burst, never one per frame or pointer position.
  const pointers = new Map<number, { x: number; y: number }>();
  let gestureStart = 0;
  let moved = false;
  let pinched = false;
  canvas.addEventListener("pointerdown", (event) => {
    if (!pointers.size) { gestureStart = performance.now(); moved = false; pinched = false; }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size > 1) pinched = true;
  }, { signal, passive: true });
  window.addEventListener("pointermove", (event) => {
    const start = pointers.get(event.pointerId);
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) moved = true;
  }, { signal, passive: true });
  const endPointer = (event: PointerEvent): void => {
    if (!pointers.delete(event.pointerId) || pointers.size) return;
    trackInteraction({ type: "gesture", target: pinched ? "globe-zoom" : moved ? "globe-rotate" : "globe",
      action: moved || pinched || event.type === "pointercancel" ? "end" : "click",
      count: 1, durationMs: performance.now() - gestureStart });
  };
  window.addEventListener("pointerup", endPointer, { signal, passive: true });
  window.addEventListener("pointercancel", endPointer, { signal, passive: true });
  let wheelTimer: ReturnType<typeof setTimeout> | undefined;
  let wheelStart = 0;
  let wheelCount = 0;
  const endWheel = (): void => {
    if (!wheelCount) return;
    trackInteraction({ type: "gesture", target: "globe-zoom", action: "end", count: wheelCount, durationMs: performance.now() - wheelStart });
    wheelCount = 0;
    clearTimeout(wheelTimer);
  };
  canvas.addEventListener("wheel", () => {
    if (!wheelCount) wheelStart = performance.now();
    wheelCount++;
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(endWheel, 300);
  }, { signal, passive: true });

  const visibility = (): void => {
    page.setVisible(!document.hidden);
    endWheel();
    trackInteraction({ type: "page", target: "page", action: document.hidden ? "hidden" : "visible", durationMs: page.take() });
    for (const [target, entry] of windows) {
      entry.duration.setVisible(!document.hidden);
      recordWindow(target, entry, document.hidden ? "hidden" : "visible");
    }
    // Let the active survey step record its final input aggregate before flushing this lifecycle event.
    queueMicrotask(() => flushInteractionMetrics(document.hidden));
  };
  document.addEventListener("visibilitychange", visibility, { signal });
  window.addEventListener("pagehide", () => {
    endWheel();
    page.setVisible(false);
    for (const [target, entry] of windows) {
      entry.duration.setVisible(false);
      recordWindow(target, entry, "hidden");
    }
    trackInteraction({ type: "page", target: "page", action: "close", durationMs: page.take() });
    flushInteractionMetrics(true);
  }, { signal });
  window.addEventListener("pageshow", visibility, { signal });
  window.addEventListener("online", () => flushInteractionMetrics(), { signal });
  // Persist completed segments during long-running projections, not only when a tab closes.
  const checkpoint = setInterval(() => {
    if (document.hidden) return;
    trackInteraction({ type: "page", target: "page", action: "visible", durationMs: page.take() });
    for (const [target, entry] of windows) {
      recordWindow(target, entry, "visible");
    }
  }, 15000);
  syncModals();
  return () => { abort.abort(); observer.disconnect(); clearInterval(checkpoint); endWheel(); stopInteractionMetrics(); };
}
