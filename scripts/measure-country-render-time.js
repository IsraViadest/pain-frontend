/*
 * Browser expression for artifacts/emo-views/eval.mjs. Run separately from pacing gates.
 * Query: perfScenario=rest|selected|building, optional perfLayer, sampleMs=8000.
 * GPU queries enclose complete draw-containing rAF callbacks, including their clears/uploads.
 * These are callback command intervals, not compositor presentation or uninstrumented frames.
 * Queries/polling can perturb scheduling; results are read only after availability, never by finish().
 */
(async () => {
  const nativeRaf = window.requestAnimationFrame;
  const nativeCancelRaf = window.cancelAnimationFrame;
  const restorers = [];
  const ownedQueries = new Set();
  const pending = new Map();
  const ownRafs = new Set();
  const timers = new Set();
  const frames = new Map();
  const maxPending = 64;
  let gl, extension, pollTimer, activeCallback, activeQuery;
  let recording = false, disjoint = false, hidden = false;
  let gpuError = null, callbackError = null;
  let observedDraws = 0, outsideDraws = 0, issuedQueries = 0, completedQueries = 0;
  let deletedQueries = 0, peakPending = 0, pollCalls = 0, pollCpuMs = 0;
  let result;
  const errorText = (error) => error instanceof Error ? error.message : String(error);
  const round = (value) => Number(value.toFixed(4));
  const summarize = (values) => {
    const sorted = values.slice().sort((a, b) => a - b);
    return { count: values.length,
      medianMs: sorted.length ? round(sorted[Math.ceil(sorted.length * 0.5) - 1]) : null,
      p95Ms: sorted.length ? round(sorted[Math.ceil(sorted.length * 0.95) - 1]) : null,
      maxMs: sorted.length ? round(sorted[sorted.length - 1]) : null };
  };
  const sleep = (ms) => new Promise((resolve) => {
    const id = setTimeout(() => { timers.delete(id); resolve(); }, ms);
    timers.add(id);
  });
  function patch(target, name, replacement) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    const original = target[name];
    Object.defineProperty(target, name, { configurable: true, writable: true,
      enumerable: descriptor?.enumerable ?? false, value: replacement });
    restorers.push(() => {
      if (descriptor) Object.defineProperty(target, name, descriptor);
      else if (!delete target[name]) throw new Error("Cannot restore " + name);
      if (target[name] !== original) throw new Error("Restoration mismatch: " + name);
    });
  }
  function nextFrame() {
    return new Promise((resolve, reject) => {
      let timer;
      const id = Reflect.apply(nativeRaf, window, [() => {
        ownRafs.delete(id); clearTimeout(timer); timers.delete(timer); resolve();
      }]);
      ownRafs.add(id);
      timer = setTimeout(() => {
        timers.delete(timer); ownRafs.delete(id);
        Reflect.apply(nativeCancelRaf, window, [id]);
        reject(new Error("No animation frame within one second"));
      }, 1000);
      timers.add(timer);
    });
  }
  function deleteQuery(query) {
    gl.deleteQuery(query);
    ownedQueries.delete(query);
    pending.delete(query);
    deletedQueries++;
  }
  function poll() {
    if (!extension || gpuError) return;
    const started = performance.now();
    try {
      if (gl.isContextLost()) throw new Error("WebGL context lost");
      disjoint ||= Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT));
      for (const [query, entry] of pending) {
        if (disjoint) { deleteQuery(query); continue; }
        if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) continue;
        const ns = Number(gl.getQueryParameter(query, gl.QUERY_RESULT));
        if (!Number.isFinite(ns) || ns < 0) throw new Error("Invalid GPU elapsed result");
        entry.gpuMs = ns / 1e6;
        completedQueries++;
        deleteQuery(query);
      }
    } catch (error) { gpuError ??= errorText(error); }
    pollCalls++;
    pollCpuMs += performance.now() - started;
  }
  function beginQuery(entry) {
    if (!extension) { entry.skipped = "unsupported"; return; }
    if (disjoint || gpuError) { entry.skipped = "invalid"; return; }
    if (pending.size >= maxPending) { entry.skipped = "pendingLimit"; return; }
    if (activeQuery || gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) {
      entry.skipped = "activeQuery"; return;
    }
    const query = gl.createQuery();
    if (!query) throw new Error("GPU query allocation failed");
    ownedQueries.add(query);
    gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
    if (gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) !== query) {
      throw new Error("GPU elapsed query did not begin");
    }
    activeQuery = query;
    entry.query = query;
    issuedQueries++;
    peakPending = Math.max(peakPending, pending.size + 1);
  }
  const onVisibility = () => { if (recording && document.visibilityState !== "visible") hidden = true; };
  try {
    const controls = new URL(location.href).searchParams;
    const scenario = controls.get("perfScenario") ?? "rest";
    if (!["rest", "selected", "building"].includes(scenario)) throw new Error("Unknown perfScenario");
    const sampleMs = Number(controls.get("sampleMs") ?? 8000);
    if (!Number.isFinite(sampleMs) || sampleMs < 1000 || sampleMs > 60000) {
      throw new Error("sampleMs must be between 1000 and 60000 milliseconds");
    }
    const layer = controls.get("perfLayer");
    if (layer) {
      const key = layer === "all-layers" ? "all-pain" : layer;
      const button = [...document.querySelectorAll("button[data-layer]")]
        .find((candidate) => candidate.dataset.layer === key);
      if (!button || button.disabled) throw new Error("Layer unavailable: " + layer);
      button.click();
    }
    await sleep(1800);
    if (document.visibilityState !== "visible") throw new Error("Probe requires a visible page");
    const canvas = document.querySelector("canvas");
    gl = canvas?.getContext("webgl2");
    if (!gl || gl.isContextLost()) throw new Error("Live WebGL2 context unavailable");
    extension = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    const countryName = () => document.querySelector("#country-profile .country-profile__country")?.textContent?.trim() ?? null;
    function selectIndia() {
      const label = document.querySelector('.emo-label[data-iso3="IND"]');
      const rect = label?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0 || rect.right <= 0 || rect.bottom <= 0 ||
          rect.left >= innerWidth || rect.top >= innerHeight || getComputedStyle(label).visibility === "hidden" ||
          getComputedStyle(label).opacity === "0") {
        throw new Error("India label is not visible; use the existing camera controls to expose India");
      }
      const clientX = rect.left + rect.width / 2, clientY = rect.top + rect.height / 2;
      document.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, clientX, clientY, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0,
      }));
      canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX, clientY, button: 0 }));
    }
    if (scenario === "selected") {
      selectIndia();
      await sleep(2000);
      if (countryName() !== "India") throw new Error("Selected profile is not exactly India");
    }

    patch(window, "requestAnimationFrame", function (callback) {
      if (typeof callback !== "function") return Reflect.apply(nativeRaf, window, [callback]);
      return Reflect.apply(nativeRaf, window, [function (timestamp) {
        if (!recording) return Reflect.apply(callback, this, [timestamp]);
        const entered = performance.now();
        let frame = frames.get(timestamp);
        if (!frame) { frame = { timestamp, callbacks: [] }; frames.set(timestamp, frame); }
        const entry = { cpuMs: 0, overheadMs: 0, draws: 0, gpuMs: null, complete: false, skipped: null };
        frame.callbacks.push(entry);
        const previous = activeCallback;
        activeCallback = entry;
        try { beginQuery(entry); } catch (error) { gpuError ??= errorText(error); }
        const callbackStarted = performance.now();
        try { return Reflect.apply(callback, this, [timestamp]); }
        catch (error) { callbackError ??= errorText(error); throw error; }
        finally {
          const callbackEnded = performance.now();
          entry.cpuMs = callbackEnded - callbackStarted;
          entry.complete = true;
          activeCallback = previous;
          if (entry.query && activeQuery === entry.query) {
            try {
              gl.endQuery(extension.TIME_ELAPSED_EXT);
              if (gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) === entry.query) {
                throw new Error("GPU elapsed query did not end");
              }
              activeQuery = null;
              if (entry.draws) pending.set(entry.query, entry);
              else deleteQuery(entry.query);
            } catch (error) { gpuError ??= errorText(error); }
          }
          entry.overheadMs = callbackStarted - entered + performance.now() - callbackEnded;
        }
      }]);
    });
    const drawMethods = ["drawArrays", "drawElements", "drawRangeElements", "drawArraysInstanced", "drawElementsInstanced"];
    for (const name of drawMethods) {
      const original = gl[name];
      patch(gl, name, function (...args) {
        if (recording) {
          observedDraws++;
          if (activeCallback) activeCallback.draws++;
          else outsideDraws++;
        }
        return Reflect.apply(original, this, args);
      });
    }
    document.addEventListener("visibilitychange", onVisibility);
    // Previously queued callbacks must reschedule through the wrapper before recording.
    await nextFrame();
    await nextFrame();
    pollTimer = setInterval(poll, 20);
    const started = performance.now();
    recording = true;
    if (scenario === "building") selectIndia();
    await sleep(Math.max(0, sampleMs - (performance.now() - started)));
    recording = false;
    const actualSampleMs = performance.now() - started;
    clearInterval(pollTimer);
    const pollStarted = performance.now();
    do {
      poll();
      if (!pending.size || disjoint || gpuError) break;
      await sleep(Math.min(10, Math.max(0, 1000 - (performance.now() - pollStarted))));
    } while (performance.now() - pollStarted < 1000);

    const allFrames = [...frames.values()];
    const completeFrames = allFrames.slice(1, -1);
    const renderFrames = completeFrames.filter((frame) => frame.callbacks.some((entry) => entry.draws));
    const entries = renderFrames.flatMap((frame) => frame.callbacks.filter((entry) => entry.draws));
    const allEntries = allFrames.flatMap((frame) => frame.callbacks);
    const wrappedDraws = allEntries.reduce((sum, entry) => sum + entry.draws, 0);
    const callbackCoverage = observedDraws > 0 && outsideDraws === 0 && wrappedDraws === observedDraws &&
      allEntries.every((entry) => entry.complete);
    const gpuCompleteFrames = renderFrames.filter((frame) => frame.callbacks
      .filter((entry) => entry.draws).every((entry) => entry.gpuMs !== null));
    const gpuValid = Boolean(extension) && !disjoint && !gpuError && !pending.size && callbackCoverage &&
      entries.length > 0 && gpuCompleteFrames.length === renderFrames.length;
    const errors = [];
    if (!entries.length) errors.push("No complete draw-containing callbacks");
    if (!callbackCoverage) errors.push("Rendering callback coverage incomplete");
    if (!gpuValid) errors.push(gpuError ?? (disjoint ? "GPU clock was disjoint" :
      !extension ? "GPU elapsed extension unavailable" : "GPU callback coverage incomplete"));
    if (callbackError) errors.push("Application callback failed: " + callbackError);
    if (hidden || document.visibilityState !== "visible") errors.push("Page was hidden during measurement");
    if (scenario !== "rest" && countryName() !== "India") errors.push("Final profile is not exactly India");
    const sumRender = (frame, key) => frame.callbacks.filter((entry) => entry.draws)
      .reduce((sum, entry) => sum + entry[key], 0);
    result = {
      passed: errors.length === 0, ...(errors.length ? { errors } : {}),
      preset: controls.get("cpPreset"), scenario, layer: layer ?? "current", sampleMs,
      actualSampleMs: round(actualSampleMs), selectedCountry: countryName(),
      viewport: [innerWidth, innerHeight], drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      cpu: { scope: "Synchronous wall time of complete draw-containing rAF callbacks; includes draw-hook overhead, excludes asynchronous tasks and browser paint.",
        callbacks: summarize(entries.map((entry) => entry.cpuMs)),
        sumPerRafTimestamp: summarize(renderFrames.map((frame) => sumRender(frame, "cpuMs"))),
        separateWrapperAndQueryOverhead: summarize(entries.map((entry) => entry.overheadMs)) },
      gpu: { supported: Boolean(extension), valid: gpuValid, disjoint,
        scope: "Elapsed GPU command interval around each complete draw-containing callback, including clears/transfers submitted inside it. Timestamp sums exclude gaps between callbacks and rendering outside this context; not whole browser frame time.",
        callbacks: summarize(gpuValid ? entries.map((entry) => entry.gpuMs) : []),
        sumPerRafTimestamp: summarize(gpuValid ? renderFrames.map((frame) => sumRender(frame, "gpuMs")) : []),
        issuedQueries, completedQueries, pendingQueries: pending.size, maxPending, peakPending,
        skippedRenderCallbacks: entries.filter((entry) => entry.skipped).length,
        validTimestampCount: gpuValid ? gpuCompleteFrames.length : 0,
        pollCalls, pollCpuMs: round(pollCpuMs), finalPollMs: round(performance.now() - pollStarted) },
      coverage: { complete: callbackCoverage, drawMethods, observedDraws, wrappedDraws,
        drawsOutsideWrappedRaf: outsideDraws, totalCallbacks: allEntries.length,
        renderCallbacks: entries.length, renderTimestamps: renderFrames.length,
        maxRenderCallbacksPerTimestamp: renderFrames.reduce((max, frame) => Math.max(max,
          frame.callbacks.filter((entry) => entry.draws).length), 0),
        edgeTimestampsExcluded: Math.min(2, allFrames.length) },
      frameIntervals: { scope: "Intervals between observed rAF timestamps, separately measured; not rendering duration or compositor presentation.",
        ...summarize(completeFrames.slice(1).map((frame, index) => frame.timestamp - completeFrames[index].timestamp)) },
      caveat: "Elapsed queries and availability polling can perturb CPU/GPU scheduling. CPU wall time may include driver backpressure or GPU waits; CPU and GPU values are not additive. Does not call finish() or read results before availability. Does not measure compositor timing or trusted physical input.",
    };
  } catch (error) { result = { passed: false, error: errorText(error) }; }
  finally {
    recording = false;
    clearInterval(pollTimer);
    document.removeEventListener("visibilitychange", onVisibility);
    const cleanupErrors = [];
    if (activeQuery && gl && extension) {
      try {
        if (gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) === activeQuery) gl.endQuery(extension.TIME_ELAPSED_EXT);
      } catch (error) { cleanupErrors.push(errorText(error)); }
    }
    for (const query of ownedQueries) {
      try { deleteQuery(query); } catch (error) { cleanupErrors.push(errorText(error)); }
    }
    for (const restore of restorers.reverse()) {
      try { restore(); } catch (error) { cleanupErrors.push(errorText(error)); }
    }
    for (const id of ownRafs) Reflect.apply(nativeCancelRaf, window, [id]);
    for (const id of timers) clearTimeout(id);
    result.cleanup = { restored: cleanupErrors.length === 0, remainingQueries: ownedQueries.size, deletedQueries };
    if (cleanupErrors.length) { result.passed = false; result.cleanupErrors = cleanupErrors; }
    frames.clear(); pending.clear();
  }
  return result;
})()
