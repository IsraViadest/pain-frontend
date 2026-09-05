/*
 * Browser expression for the existing artifacts/emo-views/eval.mjs runner.
 * Run separately from the frame-pacing gate. Query: perfLayer, perfMs (default 6000).
 * CPU: aggregate synchronous rAF callback wall time, including instrumentation overhead.
 * GPU: sampled draw-call sums, excluding clears/transfers; queries may perturb tile scheduling.
 */
(async () => {
  const restorers = [];
  const ownedQueries = new Set();
  const pending = [];
  const frames = new Map();
  const nativeRaf = window.requestAnimationFrame;
  const nativeCancelRaf = window.cancelAnimationFrame;
  const ownRafs = new Set();
  const timers = new Set();
  let gl, extension, openQuery, currentFrame;
  let recording = false;
  let disjoint = false;
  let gpuError = null;
  let callbackError = null;
  let issuedQueries = 0;
  let completedQueries = 0;
  let outsideRafDraws = 0;
  let result;
  const queryLimit = 512;
  const everyFrames = 30;
  const sleep = (ms) => new Promise((resolve) => {
    const timer = setTimeout(() => { timers.delete(timer); resolve(); }, ms);
    timers.add(timer);
  });
  const errorText = (error) => error instanceof Error ? error.stack : String(error);
  const summarize = (values) => {
    if (!values.length) return { medianMs: null, p95Ms: null, minMs: null, maxMs: null, totalMs: null };
    const sorted = values.slice().sort((a, b) => a - b);
    const round = (value) => Number(value.toFixed(4));
    return {
      medianMs: round(sorted[Math.ceil(sorted.length * 0.5) - 1]),
      p95Ms: round(sorted[Math.ceil(sorted.length * 0.95) - 1]),
      minMs: round(sorted[0]), maxMs: round(sorted[sorted.length - 1]),
      totalMs: round(values.reduce((sum, value) => sum + value, 0)),
    };
  };
  function patch(target, name, replacement) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, {
      configurable: descriptor?.configurable ?? true,
      enumerable: descriptor?.enumerable ?? false,
      writable: true, value: replacement,
    });
    restorers.push(() => {
      if (descriptor) Object.defineProperty(target, name, descriptor);
      else if (!delete target[name]) throw new Error("Could not restore " + name);
    });
  }
  function nextFrame() {
    return new Promise((resolve, reject) => {
      let timer;
      const id = Reflect.apply(nativeRaf, window, [() => {
        ownRafs.delete(id);
        clearTimeout(timer);
        timers.delete(timer);
        resolve();
      }]);
      ownRafs.add(id);
      timer = setTimeout(() => {
        timers.delete(timer);
        Reflect.apply(nativeCancelRaf, window, [id]);
        ownRafs.delete(id);
        reject(new Error("No animation frame during probe warmup"));
      }, 1000);
      timers.add(timer);
    });
  }
  function noteGpuError(error) {
    gpuError ??= errorText(error);
  }
  try {
    const controls = new URL(location.href).searchParams;
    const sampleMs = Number(controls.get("perfMs") ?? 6000);
    if (!Number.isFinite(sampleMs) || sampleMs < 1000 || sampleMs > 60000) {
      throw new RangeError("perfMs must be between 1000 and 60000 milliseconds");
    }
    const layer = controls.get("perfLayer");
    if (layer) {
      const key = layer === "all-layers" ? "all-pain" : layer;
      const button = [...document.querySelectorAll("button[data-layer]")]
        .find((candidate) => candidate.dataset.layer === key);
      if (!button || button.disabled) throw new Error("Performance layer unavailable: " + layer);
      button.click();
    }
    await sleep(1800);
    if (document.visibilityState !== "visible") throw new Error("Performance probe requires a visible page");
    const canvas = document.querySelector("canvas");
    gl = canvas?.getContext("webgl2");
    if (!gl || gl.isContextLost()) throw new Error("Live WebGL2 context unavailable");
    extension = gl.getExtension("EXT_disjoint_timer_query_webgl2");

    patch(window, "requestAnimationFrame", function (callback) {
      if (typeof callback !== "function") return Reflect.apply(nativeRaf, window, [callback]);
      return Reflect.apply(nativeRaf, window, [function (timestamp) {
        if (!recording) return Reflect.apply(callback, this, [timestamp]);
        const entered = performance.now();
        let frame = frames.get(timestamp);
        if (!frame) {
          frame = { timestamp, index: frames.size, cpuMs: 0, wrapperMs: 0, callbacks: 0,
            draws: 0, issued: 0, completed: 0, gpuNs: 0, truncated: false, blocked: false };
          frame.sampled = frame.index % everyFrames === Math.floor(everyFrames / 2);
          frames.set(timestamp, frame);
        }
        const previous = currentFrame;
        currentFrame = frame;
        const callbackStarted = performance.now();
        try {
          return Reflect.apply(callback, this, [timestamp]);
        } catch (error) {
          callbackError ??= errorText(error);
          throw error;
        } finally {
          const callbackEnded = performance.now();
          currentFrame = previous;
          frame.callbacks++;
          const exiting = performance.now();
          frame.cpuMs += exiting - entered;
          frame.wrapperMs += callbackStarted - entered + exiting - callbackEnded;
        }
      }]);
    });

    const drawMethods = ["drawArrays", "drawElements", "drawRangeElements",
      "drawArraysInstanced", "drawElementsInstanced"].filter((name) => typeof gl[name] === "function");
    for (const name of drawMethods) {
      const original = gl[name];
      patch(gl, name, function (...args) {
        if (!recording) return Reflect.apply(original, this, args);
        const frame = currentFrame;
        if (!frame) {
          outsideRafDraws++;
          return Reflect.apply(original, this, args);
        }
        frame.draws++;
        let query = null;
        if (extension && frame.sampled && !disjoint && !gpuError) {
          if (issuedQueries >= queryLimit) frame.truncated = true;
          else {
            try {
              disjoint ||= Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT));
              const busy = openQuery || [extension.TIME_ELAPSED_EXT, gl.ANY_SAMPLES_PASSED,
                gl.ANY_SAMPLES_PASSED_CONSERVATIVE, gl.TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN]
                .some((target) => gl.getQuery(target, gl.CURRENT_QUERY));
              if (busy) frame.blocked = true;
              else if (!disjoint) {
                query = gl.createQuery();
                if (!query) throw new Error("GPU query allocation failed");
                ownedQueries.add(query);
                issuedQueries++;
                gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
                if (gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) !== query) {
                  throw new Error("GPU timer query did not begin");
                }
                openQuery = query;
                frame.issued++;
              }
            } catch (error) {
              noteGpuError(error);
            }
          }
        }
        try {
          return Reflect.apply(original, this, args);
        } finally {
          if (query && openQuery === query) {
            try {
              gl.endQuery(extension.TIME_ELAPSED_EXT);
              if (gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) === query) {
                throw new Error("GPU timer query did not end");
              }
              pending.push({ query, frame, done: false });
            } catch (error) {
              noteGpuError(error);
            } finally {
              try {
                if (gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) !== query) openQuery = null;
              } catch (error) { noteGpuError(error); }
            }
          }
        }
      });
    }
    // Let already-queued application callbacks register through the wrapper first.
    await nextFrame();
    await nextFrame();
    const started = performance.now();
    recording = true;
    await sleep(sampleMs);
    recording = false;
    const actualSampleMs = performance.now() - started;

    const pollStarted = performance.now();
    const pollDeadline = pollStarted + 1000;
    while (pending.some((entry) => !entry.done) && performance.now() < pollDeadline) {
      if (gl.isContextLost()) { noteGpuError("WebGL context lost"); break; }
      disjoint ||= Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT));
      if (disjoint) break;
      for (const entry of pending) {
        if (performance.now() >= pollDeadline) break;
        if (entry.done || !gl.getQueryParameter(entry.query, gl.QUERY_RESULT_AVAILABLE)) continue;
        const elapsed = Number(gl.getQueryParameter(entry.query, gl.QUERY_RESULT));
        if (!Number.isFinite(elapsed) || elapsed < 0) throw new Error("Invalid GPU elapsed result");
        entry.frame.gpuNs += elapsed;
        entry.frame.completed++;
        completedQueries++;
        entry.done = true;
        gl.deleteQuery(entry.query);
        ownedQueries.delete(entry.query);
      }
      if (pending.some((entry) => !entry.done)) await sleep(Math.max(0, Math.min(10, pollDeadline - performance.now())));
    }
    if (extension) disjoint ||= Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT));
    const timedOutQueries = pending.filter((entry) => !entry.done).length;
    const complete = [...frames.values()].slice(1, -1);
    const cpuFrames = complete.filter((frame) => !frame.sampled);
    const sampledFrames = complete.filter((frame) => frame.sampled);
    const gpuFrames = sampledFrames.filter((frame) => frame.draws > 0 && !frame.truncated && !frame.blocked &&
      frame.draws === frame.issued && frame.issued === frame.completed);
    const blockedFrames = sampledFrames.filter((frame) => frame.blocked).length;
    const gpuValid = Boolean(extension) && !disjoint && !gpuError && !timedOutQueries &&
      !blockedFrames && !gl.isContextLost() && gpuFrames.length > 0;
    const errors = [];
    if (!cpuFrames.length) errors.push("No complete CPU callback frames");
    if (callbackError) errors.push("Animation callback failed: " + callbackError);
    if (!extension) errors.push("GPU timer extension unavailable");
    else if (!gpuValid) errors.push(gpuError ?? (disjoint ? "GPU clock was disjoint" :
      timedOutQueries ? "GPU query completion timed out" : blockedFrames ? "External active queries prevented sampling" :
      "No complete GPU draw-call frame samples"));
    if (document.visibilityState !== "visible") errors.push("Page became hidden during measurement");
    result = {
      passed: errors.length === 0,
      ...(errors.length ? { errors } : {}),
      preset: controls.get("cpPreset"), layer: layer ?? "current", sampleMs,
      actualSampleMs: Number(actualSampleMs.toFixed(2)), settleMs: 1800,
      viewport: [innerWidth, innerHeight], drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      separateFromFramePacingGate: true,
      cpu: {
        scope: "Sum of synchronous rAF callback wall time per timestamp, not processor utilization or full browser frame time.",
        ...summarize(cpuFrames.map((frame) => frame.cpuMs)),
        frameCount: cpuFrames.length, callbackCount: cpuFrames.reduce((sum, frame) => sum + frame.callbacks, 0),
        excludesGpuDesignatedFrames: true, excludedGpuFrameCount: sampledFrames.length,
        overhead: "Includes rAF wrapper clocks/bookkeeping and draw hooks; excludes asynchronous tasks and paint outside callbacks.",
        approximateRafWrapper: summarize(cpuFrames.map((frame) => frame.wrapperMs)),
      },
      gpu: {
        supported: Boolean(extension), valid: gpuValid,
        scope: "GPU draw-call sum inside wrapped rAF callbacks; excludes clear/transfer work. Per-draw queries may perturb tile scheduling; not full uninstrumented frame time.",
        drawMethods, sampleEveryFrames: everyFrames, queryLimit,
        issuedQueries, completedQueries, timedOutQueries, disjoint,
        sampledFrameCount: sampledFrames.length, validFrameCount: gpuValid ? gpuFrames.length : 0,
        budgetTruncatedFrames: sampledFrames.filter((frame) => frame.truncated).length,
        externalQueryBlockedFrames: blockedFrames,
        drawCallSum: summarize(gpuValid ? gpuFrames.map((frame) => frame.gpuNs / 1e6) : []),
        pollBudgetMs: 1000, pollElapsedMs: Number((performance.now() - pollStarted).toFixed(2)),
      },
      edgeFramesExcluded: Math.min(2, frames.size), drawsOutsideWrappedRaf: outsideRafDraws,
    };
  } catch (error) {
    result = { passed: false, error: errorText(error),
      gpu: { supported: Boolean(extension), valid: false, issuedQueries, completedQueries, disjoint } };
  } finally {
    recording = false;
    currentFrame = null;
    const cleanupErrors = [];
    if (openQuery && gl && extension) {
      try {
        if (gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) === openQuery) gl.endQuery(extension.TIME_ELAPSED_EXT);
      } catch (error) { cleanupErrors.push(errorText(error)); }
    }
    for (const query of ownedQueries) {
      try { gl.deleteQuery(query); } catch (error) { cleanupErrors.push(errorText(error)); }
    }
    for (const restore of restorers.reverse()) {
      try { restore(); } catch (error) { cleanupErrors.push(errorText(error)); }
    }
    for (const id of ownRafs) Reflect.apply(nativeCancelRaf, window, [id]);
    for (const timer of timers) clearTimeout(timer);
    ownedQueries.clear();
    frames.clear();
    pending.length = restorers.length = 0;
    result.cleanupRestored = cleanupErrors.length === 0;
    if (cleanupErrors.length) { result.passed = false; result.cleanupErrors = cleanupErrors; }
  }
  return result;
})()
