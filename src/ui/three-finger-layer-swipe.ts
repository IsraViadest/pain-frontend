/** created by: Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach */
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** Windows must release system three/four-finger gestures before the page can receive them. */
export function installThreeFingerLayerSwipe(
  canvas: HTMLCanvasElement, controls: Pick<OrbitControls, "enabled">,
  onSwipe: (direction: 1 | -1) => void,
): () => void {
  const abort = new AbortController();
  const options = { capture: true, passive: false, signal: abort.signal };
  const points = new Map<number, { x: number; y: number }>();
  const origins = new Map<number, { x: number; y: number }>();
  let active = false, canceled = false, fired = false, blockClick = false;
  let previousEnabled = true, startX = 0, startY = 0;
  const center = () => {
    let x = 0, y = 0;
    for (const point of points.values()) { x += point.x; y += point.y; }
    return { x: x / points.size, y: y / points.size };
  };
  const recognize = () => {
    if (!active || canceled || fired || points.size !== 3) return;
    const point = center(), dx = point.x - startX, dy = point.y - startY;
    if (Math.abs(dy) >= 48 && Math.abs(dy) >= Math.abs(dx) * 1.25) {
      // A resting palm or two stationary fingertips must not turn a one-finger drag into a swipe.
      for (const [id, current] of points) {
        if ((current.y - origins.get(id)!.y) * Math.sign(dy) < 24) return;
      }
      fired = true;
      onSwipe(dy > 0 ? 1 : -1);
    }
  };
  const reset = () => {
    if (active) controls.enabled = previousEnabled;
    points.clear(); origins.clear(); active = false; canceled = false; fired = false;
  };
  // A real new pointer sequence releases the compatibility-click guard, including on buttons.
  window.addEventListener("pointerdown", () => { if (!points.size) blockClick = false; }, options);
  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch" || (!active && !controls.enabled)) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size === 3 && !active) {
      const point = center(); startX = point.x; startY = point.y;
      for (const [id, current] of points) origins.set(id, current);
      previousEnabled = controls.enabled; controls.enabled = false;
      active = true; blockClick = true;
    } else if (points.size > 3) canceled = true;
    if (active) event.preventDefault();
    // Pointer events still reach OrbitControls for cleanup and the existing metrics collector.
  }, options);
  window.addEventListener("pointermove", (event) => {
    if (!points.has(event.pointerId)) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (active) { event.preventDefault(); recognize(); }
  }, options);
  const end = (event: PointerEvent) => {
    if (!points.has(event.pointerId)) return;
    if (event.type === "pointercancel") canceled = true;
    else { points.set(event.pointerId, { x: event.clientX, y: event.clientY }); recognize(); }
    points.delete(event.pointerId);
    if (!points.size) reset();
  };
  window.addEventListener("pointerup", end, options);
  window.addEventListener("pointercancel", end, options);
  window.addEventListener("blur", reset, { signal: abort.signal });
  window.addEventListener("click", (event) => {
    if (!blockClick || event.detail === 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
  }, options);
  return () => { reset(); abort.abort(); };
}
