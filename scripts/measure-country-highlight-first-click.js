/* Existing eval.mjs expression. Fresh v18 page, cam=20,78,2.35; testReadHint=1 is a runtime trial.
 * Observe actual first-click canvas readbacks and long tasks. No fixture warmup hides cold costs.
 */
(async () => {
  const reads = [], tasks = [], frames = [];
  const canvasPrototype = HTMLCanvasElement.prototype, contextPrototype = CanvasRenderingContext2D.prototype;
  const contextDescriptor = Object.getOwnPropertyDescriptor(canvasPrototype, "getContext");
  const readDescriptor = Object.getOwnPropertyDescriptor(contextPrototype, "getImageData");
  const originalContext = canvasPrototype.getContext, originalRead = contextPrototype.getImageData;
  let observer, started;
  const hint = new URL(location.href).searchParams.get("testReadHint") ?? "default";
  try {
    if (hint !== "default") canvasPrototype.getContext = function (kind, options) {
      return kind === "2d" && this.width === 2048 && this.height === 1024
        ? originalContext.call(this, kind, { ...options, willReadFrequently: hint !== "gpu" })
        : Reflect.apply(originalContext, this, arguments);
    };
    contextPrototype.getImageData = function (...args) {
      const before = performance.now();
      const result = Reflect.apply(originalRead, this, args);
      if (this.canvas.width === 2048 && this.canvas.height === 1024 && reads.length < 32) {
        reads.push({ afterClickMs: before - started, durationMs: performance.now() - before,
          bytes: result.data.byteLength, readHint: this.getContextAttributes().willReadFrequently });
      }
      return result;
    };
    observer = new PerformanceObserver((list) => {
      for (const task of list.getEntries()) if (tasks.length < 16) {
        tasks.push({ afterClickMs: task.startTime - started, durationMs: task.duration });
      }
    });
    observer.observe({ type: "longtask" });
    const label = document.querySelector('.emo-label[data-iso3="IND"]');
    if (!label || getComputedStyle(label).visibility !== "visible") throw Error("India is not visible");
    const r = label.getBoundingClientRect(), c = document.querySelector("#globe");
    const options = { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
    started = performance.now();
    document.dispatchEvent(new PointerEvent("pointerdown", options));
    c.dispatchEvent(new MouseEvent("click", options));
    await new Promise((resolve) => {
      let previous;
      const frame = (time) => {
        if (previous !== undefined) frames.push(time - previous);
        previous = time;
        if (time - started >= 3500) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (document.querySelector(".country-profile__country").textContent !== "India") {
      throw Error("The click did not select India");
    }
    frames.sort((a, b) => a - b);
    return { passed: true, hint, withinLongTaskGate: tasks.length === 0, reads, tasks,
      medianFrameMs: frames[Math.floor(frames.length / 2)], p95FrameMs: frames[Math.ceil(frames.length * .95) - 1],
      maxFrameMs: frames.at(-1) };
  } catch (error) { return { passed: false, error: String(error.stack ?? error), reads, tasks }; }
  finally {
    observer?.disconnect();
    Object.defineProperty(canvasPrototype, "getContext", contextDescriptor);
    Object.defineProperty(contextPrototype, "getImageData", readDescriptor);
  }
})()
