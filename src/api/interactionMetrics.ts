import { flushInteractionMetrics, stopInteractionMetrics, trackInteraction, type MetricEvent } from "./metricsApi";
import { VisibleDuration } from "./metricsQueue";

type Target = MetricEvent["target"];
const CONTROL_TARGETS: readonly Target[] = ["sound", "theme", "about", "sources", "share", "menu", "cycle", "quality"];
const MODALS = [".info-modal--visible", ".consent-modal--visible", ".survey-modal--visible", ".survey-result-modal--visible"];

/** One semantic observer for fixed chrome. It never collects text, hrefs, form values or coordinates. */
export function installInteractionMetrics(canvas: HTMLCanvasElement): () => void {
  const abort = new AbortController();
  const signal = abort.signal;
  let infoTarget: "about" | "sources" = "about";
  const windows = new Map<Target, VisibleDuration>();
  const page = new VisibleDuration();
  page.setVisible(!document.hidden);
  trackInteraction({ type: "page", target: "page", action: "open" });

  const syncModals = (): void => {
    const visible = new Set<Target>();
    if (document.querySelector(MODALS[0])) visible.add(infoTarget);
    if (document.querySelector(MODALS[1])) visible.add("consent");
    if (document.querySelector(MODALS[2])) visible.add("survey");
    if (document.querySelector(MODALS[3])) visible.add("result");
    for (const target of visible) {
      if (windows.has(target)) continue;
      const duration = new VisibleDuration();
      duration.setVisible(!document.hidden);
      windows.set(target, duration);
      trackInteraction({ type: "window", target, action: "open" });
    }
    for (const [target, duration] of windows) {
      if (visible.has(target)) continue;
      trackInteraction({ type: "window", target, action: "close", durationMs: duration.read() });
      windows.delete(target);
    }
  };
  const observer = new MutationObserver((records) => {
    // Ignore text replacement and all per-frame transform/opacity writes on globe labels.
    if (records.some((record) => record.type === "attributes"
      ? record.target instanceof Element && record.target.matches(".info-modal,.consent-modal,.survey-modal,.survey-result-modal")
      : [...record.addedNodes, ...record.removedNodes].some((node) => node instanceof Element &&
        (node.matches(".info-modal,.consent-modal,.survey-modal,.survey-result-modal") ||
         node.querySelector(".info-modal,.consent-modal,.survey-modal,.survey-result-modal"))))) syncModals();
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });

  document.addEventListener("click", (event) => {
    const element = event.target instanceof Element ? event.target : null;
    if (!element) return;
    const screen = element.closest(".survey-screen");
    if (screen && element.closest("button,.survey-screen__advance-wrapper,.survey-map-pin")) {
      const step = [1, 2, 3, 4, 5].find((value) => screen.classList.contains(`survey-screen--${value}`));
      // Count activations and blocked advance attempts without identifying an answer button.
      trackInteraction({ type: "survey", target: "survey", action: "click", step, count: 1,
        ...([1, 3, 4].includes(step ?? 0) ? { selectedCount: screen.querySelectorAll('[aria-pressed="true"]').length } : {}) });
      return;
    }
    const button = element.closest<HTMLElement>("button,a,[role=button]");
    if (!button || button.matches(":disabled,[aria-disabled=true]")) return;
    const target = button.dataset.metricTarget as Target | undefined;
    if (target && CONTROL_TARGETS.includes(target)) {
      if (target === "about" || target === "sources") infoTarget = target;
      const pressed = button.getAttribute("aria-pressed") ?? button.getAttribute("aria-expanded");
      trackInteraction({ type: "control", target, action: "click", ...(pressed === null ? {} : { enabled: pressed === "true" }) });
    } else if (button.matches("[data-layer]")) {
      const layer = button.dataset.layer === "all-pain" ? "all-layers" : button.dataset.layer;
      trackInteraction({ type: "control", target: "layer", action: "click", layer: layer as MetricEvent["layer"] });
    } else if (button.matches(".emo-legend__item")) {
      trackInteraction({ type: "emotion", target: "emotion", action: "click", emotion: button.dataset.cat });
    } else if (button.matches(".festival-media__workshop")) {
      trackInteraction({ type: "control", target: "workshop", action: "click" });
    } else if (button.matches(".consent-modal__btn")) {
      trackInteraction({ type: "control", target: "consent", action: "click",
        enabled: button.classList.contains("consent-modal__btn--agree") });
    } else if (button.closest(".info-modal") && button.matches("a")) {
      trackInteraction({ type: "control", target: infoTarget === "sources" ? "source-link" : "about-link", action: "click" });
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
      action: moved || pinched ? "end" : "click", count: 1, durationMs: performance.now() - gestureStart });
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
    trackInteraction({ type: "page", target: "page", action: document.hidden ? "hidden" : "visible", durationMs: page.read() });
    for (const [target, duration] of windows) {
      duration.setVisible(!document.hidden);
      trackInteraction({ type: "window", target, action: document.hidden ? "hidden" : "visible", durationMs: duration.read() });
    }
    // Let the active survey step record its final input aggregate before flushing this lifecycle event.
    queueMicrotask(() => flushInteractionMetrics(document.hidden));
  };
  document.addEventListener("visibilitychange", visibility, { signal });
  window.addEventListener("pagehide", () => {
    endWheel();
    page.setVisible(false);
    for (const [target, duration] of windows) {
      duration.setVisible(false);
      trackInteraction({ type: "window", target, action: "hidden", durationMs: duration.read() });
    }
    trackInteraction({ type: "page", target: "page", action: "close", durationMs: page.read() });
    flushInteractionMetrics(true);
  }, { signal });
  window.addEventListener("pageshow", () => { page.setVisible(!document.hidden); flushInteractionMetrics(); }, { signal });
  window.addEventListener("online", () => flushInteractionMetrics(), { signal });
  syncModals();
  return () => { abort.abort(); observer.disconnect(); endWheel(); stopInteractionMetrics(); };
}
