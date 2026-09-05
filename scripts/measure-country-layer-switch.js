/* Existing eval.mjs expression. Use v18-a_composed (hatch), preferably cpQuality=standard.
 * Measures programmatic click dispatch, complete matching render submission, the following
 * probe rAF opportunity, and intersecting long tasks. This is not compositor/physical input-to-paint.
 */
(async () => {
  const restorers = [];
  const programs = new Map();
  const frames = new Map();
  const rows = [];
  const longTasks = [];
  const dataRequests = [];
  const errors = [];
  const timers = new Set();
  const nativeRaf = window.requestAnimationFrame;
  const nativeCancelRaf = window.cancelAnimationFrame;
  let gl, observer, monitorId, currentFrame = null, waiter = null;
  let collecting = false, stopped = false, warmFrames = 0, warmResolve;
  let outsideRafDraws = 0, lastCompleted = null;
  const round = (value) => Number(value.toFixed(3));
  const fail = (condition, message) => { if (!condition) throw new Error(message); };
  const noteError = (error) => {
    if (errors.length < 8) errors.push(error instanceof Error ? error.stack : String(error));
  };
  const sleep = (ms) => new Promise((resolve) => {
    const id = setTimeout(() => { timers.delete(id); resolve(); }, ms);
    timers.add(id);
  });
  function patch(target, name, value) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, { configurable: true, writable: true,
      enumerable: descriptor?.enumerable ?? false, value });
    restorers.push(() => descriptor ? Object.defineProperty(target, name, descriptor) : delete target[name]);
  }
  const expected = {
    "all-layers": { volume: true, socioeconomic: true, scar: 1 },
    envpain: { volume: true, socioeconomic: false, scar: 0 },
    physpain: { volume: false, socioeconomic: false, scar: 1 },
    socioecopain: { volume: false, socioeconomic: true, scar: 0 },
  };
  function matches(frame, layer) {
    const wanted = expected[layer];
    return frame.draws > 0 && frame.pointDraws > 0 &&
      (frame.volumeDraws > 0) === wanted.volume && (frame.socioDraws > 0) === wanted.socioeconomic &&
      frame.scarStates.size === 1 && frame.scarStates.has(wanted.scar);
  }
  function features(frame) {
    return frame && { draws: frame.draws, volumeDraws: frame.volumeDraws,
      socioeconomicDraws: frame.socioDraws, pointDraws: frame.pointDraws,
      uSamples: [...frame.samples], uSocioMinimum: [...frame.minimums], uScarActive: [...frame.scarStates] };
  }
  function acceptEntries(entries) {
    for (const entry of entries) {
      if (entry.entryType === "longtask") {
        if (longTasks.length < 512) longTasks.push({ start: entry.startTime, duration: entry.duration });
        else noteError("Long-task record bound exceeded");
      } else if (/\/init(?:\/|[?#]|$)/.test(entry.name)) {
        if (dataRequests.length < 128) dataRequests.push({ start: entry.startTime, duration: entry.duration });
        else noteError("Data-request record bound exceeded");
      }
    }
  }
  function monitor(timestamp) {
    if (stopped) return;
    const opportunity = performance.now();
    if (++warmFrames === 2) { collecting = true; warmResolve(); }
    for (const [key, frame] of frames) {
      if (key >= timestamp) continue;
      frames.delete(key);
      if (!frame.draws) continue;
      lastCompleted = frame;
      if (waiter && frame.firstDraw >= waiter.started && matches(frame, waiter.layer)) {
        const done = waiter;
        waiter = null;
        clearTimeout(done.timer);
        timers.delete(done.timer);
        done.resolve({ frame, opportunity, opportunityTimestamp: timestamp });
      }
    }
    monitorId = Reflect.apply(nativeRaf, window, [monitor]);
  }
  function waitForRendered(layer, started) {
    return new Promise((resolve, reject) => {
      const pending = { layer, started, resolve, timer: null };
      pending.timer = setTimeout(() => {
        timers.delete(pending.timer);
        if (waiter === pending) waiter = null;
        reject(new Error("No complete matching GPU submission for " + layer +
          "; last frame " + JSON.stringify(features(lastCompleted))));
      }, 15000);
      timers.add(pending.timer);
      waiter = pending;
    });
  }
  const onError = (event) => noteError(event.error ?? event.message);
  const onRejection = (event) => noteError(event.reason);
  try {
    fail(document.visibilityState === "visible", "Layer-switch measurement requires a visible page");
    const canvas = document.querySelector("canvas");
    gl = canvas?.getContext("webgl2");
    fail(gl && !gl.isContextLost(), "Live WebGL2 context unavailable");
    fail(PerformanceObserver.supportedEntryTypes.includes("longtask"), "Long-task observation unavailable");
    const originalError = console.error;
    patch(console, "error", function (...args) {
      noteError(args.map(String).join(" "));
      return Reflect.apply(originalError, this, args);
    });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    observer = new PerformanceObserver((list) => acceptEntries(list.getEntries()));
    observer.observe({ entryTypes: ["longtask", "resource"] });
    patch(window, "requestAnimationFrame", function (callback) {
      if (typeof callback !== "function") return Reflect.apply(nativeRaf, window, [callback]);
      return Reflect.apply(nativeRaf, window, [function (timestamp) {
        if (!collecting) return Reflect.apply(callback, this, [timestamp]);
        let frame = frames.get(timestamp);
        if (!frame) {
          frame = { timestamp, firstDraw: Infinity, lastDraw: 0, callbackEnd: 0, draws: 0,
            volumeDraws: 0, socioDraws: 0, pointDraws: 0, samples: new Set(), minimums: new Set(), scarStates: new Set() };
          frames.set(timestamp, frame);
        }
        const previous = currentFrame;
        currentFrame = frame;
        try { return Reflect.apply(callback, this, [timestamp]); }
        finally { frame.callbackEnd = performance.now(); currentFrame = previous; }
      }]);
    });
    for (const name of ["drawArrays", "drawElements", "drawRangeElements", "drawArraysInstanced", "drawElementsInstanced"]) {
      const original = gl[name];
      if (typeof original !== "function") continue;
      patch(gl, name, function (...args) {
        const frame = collecting ? currentFrame : null;
        if (collecting && !frame) outsideRafDraws++;
        if (frame) {
          frame.firstDraw = Math.min(frame.firstDraw, performance.now());
          frame.draws++;
          try {
            const program = gl.getParameter(gl.CURRENT_PROGRAM);
            let info = programs.get(program);
            if (program && !info) {
              info = { samples: gl.getUniformLocation(program, "uSamples"),
                minimum: gl.getUniformLocation(program, "uSocioMinimum"),
                scar: gl.getUniformLocation(program, "uScarActive") };
              programs.set(program, info);
            }
            if (info?.samples !== null && info?.samples !== undefined) {
              frame.volumeDraws++;
              frame.samples.add(Number(gl.getUniform(program, info.samples)));
            }
            if (info?.minimum !== null && info?.minimum !== undefined) {
              frame.socioDraws++;
              frame.minimums.add(Number(gl.getUniform(program, info.minimum)));
            }
            if (args[0] === gl.POINTS && info?.scar !== null && info?.scar !== undefined) {
              frame.pointDraws++;
              frame.scarStates.add(Number(gl.getUniform(program, info.scar)));
            }
          } catch (error) { noteError(error); }
        }
        try { return Reflect.apply(original, this, args); }
        finally { if (frame) frame.lastDraw = performance.now(); }
      });
    }
    const warm = new Promise((resolve) => { warmResolve = resolve; });
    monitorId = Reflect.apply(nativeRaf, window, [monitor]);
    await Promise.race([warm, sleep(1500).then(() => { throw new Error("No rAF warmup"); })]);
    const initial = await waitForRendered("all-layers", performance.now());
    fail(!errors.length && gl.getError() === gl.NO_ERROR, "Initial renderer errors: " + errors.join("; "));
    const query = new URL(location.href).searchParams;
    let previousLayer = "all-layers";
    for (let iteration = 1; iteration <= 2; iteration++) {
      for (const layer of ["envpain", "physpain", "socioecopain", "all-layers"]) {
        const key = layer === "all-layers" ? "all-pain" : layer;
        const button = [...document.querySelectorAll("button[data-layer]")].find((element) => element.dataset.layer === key);
        fail(button && !button.disabled, "Layer button unavailable: " + layer);
        const started = performance.now();
        const completion = waitForRendered(layer, started);
        const dispatchStarted = performance.now();
        button.click();
        const dispatchEnded = performance.now();
        const matched = await completion;
        fail(!errors.length && !gl.isContextLost() && gl.getError() === gl.NO_ERROR,
          "Renderer error during layer switch: " + errors.join("; "));
        // Let observer delivery and normal post-submission work finish before the next switch.
        await sleep(350);
        const observationEnd = performance.now();
        acceptEntries(observer.takeRecords());
        const tasks = longTasks.filter((entry) => entry.start < observationEnd && entry.start + entry.duration > started);
        const requests = dataRequests.filter((entry) => entry.start >= started && entry.start < observationEnd);
        rows.push({ round: iteration, pass: iteration === 1 ? "first-traversal" : "repeat-traversal",
          from: previousLayer, to: layer,
          dispatchMs: round(dispatchEnded - dispatchStarted),
          firstMatchingSubmissionMs: round(matched.frame.lastDraw - started),
          matchingRafCallbackEndMs: round(matched.frame.callbackEnd - started),
          nextRafOpportunityMs: round(matched.opportunity - started),
          submissionToNextRafMs: round(matched.opportunity - matched.frame.lastDraw),
          features: features(matched.frame),
          longTasks: { count: tasks.length, maxDurationMs: round(tasks.reduce((max, task) => Math.max(max, task.duration), 0)),
            overlapMs: round(tasks.reduce((sum, task) => sum + Math.max(0,
              Math.min(observationEnd, task.start + task.duration) - Math.max(started, task.start)), 0)),
            observationEndMs: round(observationEnd - started) },
          normalInitRequests: requests.length,
          quality: document.querySelector("#app")?.dataset.cpQuality ?? null });
        previousLayer = layer;
      }
    }
    fail(outsideRafDraws === 0, "Draws occurred outside wrapped rAF callbacks; frame classification is incomplete");
    fail(!errors.length, "Application or instrumentation errors: " + errors.join("; "));
    return { passed: true, preset: query.get("cpPreset"), qualityRequest: query.get("cpQuality"), rows,
      baselineFeatures: features(initial.frame), outsideRafDraws,
      timingScope: "Programmatic DOM click wall time, complete matching draw submission, then the probe callback in the following rAF. Includes instrumentation overhead; not compositor presentation or physical input-to-paint.",
      cacheScope: "First traversal versus repeat within an already loaded page. No cache eviction; startup may have warmed data and shader caches.",
      completionEvidence: "Actual drawn GPU programs/uniforms, including required absences across the complete rAF timestamp. UI indicators and assigned layer flags are not completion evidence." };
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error), rows, errors,
      lastCompletedFeatures: features(lastCompleted), outsideRafDraws };
  } finally {
    stopped = true;
    collecting = false;
    currentFrame = null;
    observer?.disconnect();
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    if (monitorId !== undefined) Reflect.apply(nativeCancelRaf, window, [monitorId]);
    for (const timer of timers) clearTimeout(timer);
    for (const restore of restorers.reverse()) restore();
    programs.clear(); frames.clear();
  }
})()
