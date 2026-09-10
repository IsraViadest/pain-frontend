/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/*
 * Browser expression for artifacts/emo-views/eval.mjs, on either the frozen evening bundle
 * or Vite. Start on a visible, loaded page with no country selected or autoplay active.
 * Run alone: eight complete application rAF timestamps per layer, after settling.
 * Native submissions include offscreen/depth work. Counts are not visible-pixel counts,
 * GPU time, or Three.js object identities. No application-module imports are needed.
 */
(async () => {
  const layers = ["emopain", "physpain", "envpain", "socioecopain", "all-pain"];
  const sourceExpectedDraws = { emopain: 4, physpain: 4, envpain: 6, socioecopain: 4, "all-pain": 10 };
  const restorers = [], rows = [], errors = [];
  const programs = new Map(), targets = new Map(), vaos = new Map(), frames = new Map();
  const timers = new Set(), ownRafs = new Set();
  const nativeRaf = window.requestAnimationFrame, nativeCancelRaf = window.cancelAnimationFrame;
  let gl, initialButton, currentFrame = null, recording = false, afterTimestamp = Infinity;
  let outsideRafDraws = 0, outsideRafClears = 0;
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const noteError = (error) => { if (errors.length < 8) errors.push(String(error.stack ?? error)); };
  const errorEvent = (event) => noteError(event.error ?? event.message ?? event.reason);
  const range = (values) => ({ min: Math.min(...values), max: Math.max(...values) });
  const idFor = (map, value) => { if (!map.has(value)) map.set(value, map.size + 1); return map.get(value); };
  function patch(target, name, value) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, { configurable: true, writable: true,
      enumerable: descriptor?.enumerable ?? false, value });
    restorers.push(() => descriptor ? Object.defineProperty(target, name, descriptor) : delete target[name]);
  }
  function sleep(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => { timers.delete(timer); resolve(); }, ms);
      timers.add(timer);
    });
  }
  function nextFrame() {
    return new Promise((resolve, reject) => {
      const id = Reflect.apply(nativeRaf, window, [(timestamp) => {
        ownRafs.delete(id); clearTimeout(timer); timers.delete(timer); resolve(timestamp);
      }]);
      ownRafs.add(id);
      const timer = setTimeout(() => {
        timers.delete(timer); ownRafs.delete(id); Reflect.apply(nativeCancelRaf, window, [id]);
        reject(new Error("No animation frame within 1500 ms"));
      }, 1500);
      timers.add(timer);
    });
  }
  function idleState() {
    const profile = document.querySelector("#country-profile");
    const autoplay = document.querySelector('.country-presentation-toggle[aria-pressed="true"]');
    return { profilePresent: !!profile, hidden: profile?.hidden ?? null,
      country: profile?.dataset.country ?? null, stage: profile?.dataset.stage ?? null,
      layer: profile?.dataset.layer ?? null, autoplay: !!autoplay };
  }
  function checkIdle() {
    const state = idleState();
    check(state.profilePresent && state.hidden && !state.country && state.stage !== "heading" && !state.autoplay,
      "Requires loaded country profile, no selection and no autoplay: " + JSON.stringify(state));
    check(document.visibilityState === "visible" && !gl.isContextLost(), "Page hidden or WebGL context lost");
    check(!errors.length, "Application/instrumentation error: " + errors.join("; "));
  }
  function quality() {
    const data = document.querySelector("#app")?.dataset;
    return Object.fromEntries(["cpQuality", "cpQualityTarget", "cpDetailBytes", "cpDetailBudget",
      "cpBudgetExceeded"].map((key) => [key, data?.[key] ?? null]));
  }
  function programInfo(program) {
    check(program, "Draw without a current WebGL program");
    if (programs.has(program)) return programs.get(program);
    check(programs.size < 128, "Program inventory bound exceeded");
    const names = ["uVolume", "uSamples", "uTemperature", "uCo2", "uField", "uSceneDepth",
      "uAppearance", "uBaseRadius", "uColor", "uLevels", "uLandOnly", "uScarMap",
      "uScarActive", "uPointScale", "uDetailMode", "uSocioMinimum", "uGlowIntensity",
      "linewidth", "resolution"];
    const locations = Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)])
      .filter(([, location]) => location !== null));
    const has = (name) => Object.hasOwn(locations, name);
    // Three.js also compiles thick lines as triangles, so primitive mode alone is insufficient.
    const source = (gl.getAttachedShaders(program) ?? []).map((shader) => gl.getShaderSource(shader) ?? "").join("\n");
    let effect = "unclassified";
    if (has("uVolume")) effect = "atmosphere-composite";
    else if (has("uSamples") && has("uTemperature") && has("uCo2")) effect = "atmosphere-integration";
    else if (has("uField") && has("uSceneDepth")) effect = source.includes("opticalPath") &&
      source.includes("vSurfaceNormal") ? "atmosphere-mantle" : "atmosphere-surface";
    else if (has("uPointScale") && has("uScarActive")) effect = "stipple";
    else if (has("uLevels") && has("uScarMap")) effect = "scar-contours";
    else if (has("uSocioMinimum")) effect = "socioeconomic-pattern";
    else if (has("linewidth") && has("resolution") && gl.getAttribLocation(program, "instanceStart") >= 0)
      effect = "thick-lines-unresolved-owner";
    else if (has("uGlowIntensity")) effect = "atmosphere-rim-glow";
    const info = { id: programs.size + 1, effect, locations };
    programs.set(program, info);
    return info;
  }
  function recordDraw(method, args) {
    if (!recording) return;
    if (!currentFrame) { outsideRafDraws++; return; }
    if (currentFrame.timestamp <= afterTimestamp) return;
    const frame = currentFrame;
    check(frame.draws.length < 256, "Draw inventory bound exceeded in one rAF timestamp");
    const count = args[method === "drawRangeElements" ? 3 : method.startsWith("drawArrays") ? 2 : 1];
    const instances = method === "drawArraysInstanced" ? args[3] : method === "drawElementsInstanced" ? args[4] : 1;
    const mode = args[0], program = gl.getParameter(gl.CURRENT_PROGRAM), info = programInfo(program);
    const framebuffer = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
    const primitive = ["POINTS", "LINES", "LINE_LOOP", "LINE_STRIP", "TRIANGLES", "TRIANGLE_STRIP",
      "TRIANGLE_FAN"].find((name) => gl[name] === mode) ?? String(mode);
    const perInstance = mode === gl.POINTS ? count : mode === gl.LINES ? Math.floor(count / 2) :
      mode === gl.LINE_STRIP ? Math.max(0, count - 1) : mode === gl.LINE_LOOP ? (count > 1 ? count : 0) :
      mode === gl.TRIANGLES ? Math.floor(count / 3) : Math.max(0, count - 2);
    const uniforms = Object.fromEntries(Object.entries(info.locations).map(([name, location]) => {
      const value = gl.getUniform(program, location);
      return [name, ArrayBuffer.isView(value) ? Array.from(value) : value];
    }));
    const colorWrite = Array.from(gl.getParameter(gl.COLOR_WRITEMASK));
    const pass = { program: info.id, effect: info.effect === "unclassified" && primitive.startsWith("LINE")
      ? "native-lines-unresolved-owner" : info.effect, target: framebuffer ? "offscreen" : "screen",
      framebuffer: framebuffer ? idFor(targets, framebuffer) : null,
      viewport: Array.from(gl.getParameter(gl.VIEWPORT)), primitive, method,
      colorWrite, depthOnly: colorWrite.every((value) => !value) && gl.getParameter(gl.DEPTH_WRITEMASK) &&
        gl.isEnabled(gl.DEPTH_TEST), depthWrite: gl.getParameter(gl.DEPTH_WRITEMASK), uniforms };
    frame.draws.push({ pass, count, instances, primitives: perInstance * instances });
    if (count > 0 && instances > 0 && !framebuffer && info.effect === "stipple") {
      const key = JSON.stringify([idFor(vaos, gl.getParameter(gl.VERTEX_ARRAY_BINDING)), method, args]);
      frame.stippleKeys.set(key, (frame.stippleKeys.get(key) ?? 0) + 1);
    }
  }
  function summarize(layer, observed, before, after) {
    const passes = new Map();
    const metrics = observed.map((frame, index) => {
      const nonempty = frame.draws.filter((draw) => draw.count > 0 && draw.instances > 0);
      for (const draw of frame.draws) {
        const key = JSON.stringify(draw.pass);
        if (!passes.has(key)) passes.set(key, { ...draw.pass, drawsPerFrame: Array(observed.length).fill(0),
          calls: 0, nonemptyCalls: 0, submittedVertices: 0, submittedPrimitives: 0 });
        const pass = passes.get(key);
        pass.calls++; pass.drawsPerFrame[index]++;
        pass.nonemptyCalls += Number(draw.count > 0 && draw.instances > 0);
        pass.submittedVertices += draw.count * draw.instances;
        pass.submittedPrimitives += draw.primitives;
      }
      return { calls: frame.draws.length, nonempty: nonempty.length,
        screen: nonempty.filter((draw) => draw.pass.target === "screen").length,
        offscreen: nonempty.filter((draw) => draw.pass.target === "offscreen").length,
        depthOnly: nonempty.filter((draw) => draw.pass.depthOnly).length,
        atmosphere: nonempty.filter((draw) => draw.pass.effect.startsWith("atmosphere-")).length,
        drawingCallbacks: frame.drawingCallbacks, fullScreenColorDepthClears: frame.screenClears,
        duplicateStipple: [...frame.stippleKeys.values()].some((count) => count > 1) };
    });
    const atmosphereExpected = layer === "envpain" || layer === "all-pain";
    const assertions = {
      eightCompleteFrames: observed.length === 8,
      nonemptyEveryFrame: metrics.every((frame) => frame.nonempty > 0 && frame.screen > 0),
      atmosphereLayerIsolation: metrics.every((frame) => atmosphereExpected ? frame.atmosphere > 0 : frame.atmosphere === 0),
      oneDrawingCallbackPerFrame: metrics.every((frame) => frame.drawingCallbacks === 1),
      oneMainClearPerFrame: metrics.every((frame) => frame.fullScreenColorDepthClears === 1),
      noRepeatedStippleSubmission: metrics.every((frame) => !frame.duplicateStipple),
      qualitySettled: (!before.cpQualityTarget || before.cpQuality === before.cpQualityTarget) &&
        (!after.cpQualityTarget || after.cpQuality === after.cpQualityTarget) && before.cpQuality === after.cpQuality,
    };
    return { layer, passed: Object.values(assertions).every(Boolean), assertions, frames: observed.length,
      sourceExpectedNonemptyPerFrame: sourceExpectedDraws[layer],
      observedPerFrame: Object.fromEntries(["calls", "nonempty", "screen", "offscreen", "depthOnly",
        "atmosphere", "drawingCallbacks", "fullScreenColorDepthClears"].map((key) => [key, range(metrics.map((frame) => frame[key]))])),
      quality: { before, after }, idle: idleState(),
      passes: [...passes.values()].map(({ drawsPerFrame, ...pass }) => ({ ...pass, callsPerFrame: range(drawsPerFrame) })) };
  }
  try {
    gl = document.querySelector("canvas")?.getContext("webgl2");
    check(gl, "Live WebGL2 canvas unavailable");
    checkIdle();
    const buttons = layers.map((layer) => document.querySelector(`button[data-layer="${layer}"]`));
    check(buttons.every((button) => button && !button.disabled), "All five layer buttons must be available");
    initialButton = buttons.find((button) => button.classList.contains("blob-button--active"));
    check(initialButton, "Cannot identify active layer for restoration");
    window.addEventListener("error", errorEvent);
    window.addEventListener("unhandledrejection", errorEvent);
    patch(window, "requestAnimationFrame", function (callback) {
      if (typeof callback !== "function") return Reflect.apply(nativeRaf, window, [callback]);
      return Reflect.apply(nativeRaf, window, [function (timestamp) {
        if (!recording) return Reflect.apply(callback, this, [timestamp]);
        let frame = frames.get(timestamp);
        if (!frame) {
          frame = { timestamp, draws: [], drawingCallbacks: 0, screenClears: 0, stippleKeys: new Map() };
          if (timestamp > afterTimestamp) frames.set(timestamp, frame);
        }
        const previous = currentFrame, initialDraws = frame.draws.length;
        currentFrame = frame;
        try { return Reflect.apply(callback, this, [timestamp]); }
        finally { if (frame.draws.length > initialDraws) frame.drawingCallbacks++; currentFrame = previous; }
      }]);
    });
    for (const method of ["drawArrays", "drawElements", "drawRangeElements", "drawArraysInstanced", "drawElementsInstanced"]) {
      const original = gl[method];
      patch(gl, method, function (...args) {
        try { recordDraw(method, args); } catch (error) { noteError(error); }
        return Reflect.apply(original, this, args);
      });
    }
    const originalClear = gl.clear;
    patch(gl, "clear", function (mask) {
      if (recording) {
        if (!currentFrame) outsideRafClears++;
        else if (currentFrame.timestamp > afterTimestamp && !gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) &&
          (mask & gl.COLOR_BUFFER_BIT) && (mask & gl.DEPTH_BUFFER_BIT) && !gl.isEnabled(gl.SCISSOR_TEST))
          currentFrame.screenClears++;
      }
      return Reflect.apply(originalClear, this, [mask]);
    });
    // Fail explicitly if an extension bypasses the five core draw entry points.
    const multiDraw = gl.getExtension("WEBGL_multi_draw");
    if (multiDraw) for (const method of ["multiDrawArraysWEBGL", "multiDrawElementsWEBGL",
      "multiDrawArraysInstancedWEBGL", "multiDrawElementsInstancedWEBGL"]) {
      const original = multiDraw[method];
      patch(multiDraw, method, function (...args) {
        if (recording) noteError(new Error("Unsupported multi-draw extension submission: " + method));
        return Reflect.apply(original, this, args);
      });
    }
    const query = new URL(location.href).searchParams;
    const canvas = gl.canvas.getBoundingClientRect();
    for (const [index, layer] of layers.entries()) {
      buttons[index].click();
      await sleep(1800);
      const profileLayer = layer === "all-pain" ? "all-layers" : layer;
      const readyDeadline = performance.now() + 12000;
      while (true) {
        checkIdle();
        const state = quality();
        if (idleState().layer === profileLayer && buttons[index].classList.contains("blob-button--active") &&
          (!state.cpQualityTarget || state.cpQuality === state.cpQualityTarget)) break;
        check(performance.now() < readyDeadline, "Layer data or quality did not settle: " + layer);
        await sleep(100);
      }
      const before = quality(), observed = [];
      frames.clear();
      afterTimestamp = await nextFrame();
      recording = true;
      const deadline = performance.now() + 12000;
      while (observed.length < 8 && performance.now() < deadline) {
        const timestamp = await nextFrame();
        for (const [key, frame] of frames) if (key < timestamp) {
          frames.delete(key); observed.push(frame);
        }
        checkIdle();
        check(idleState().layer === profileLayer, "Layer changed during sampling: " + layer);
      }
      recording = false;
      check(observed.length === 8, "Incomplete frame window for " + layer + ": " + observed.length);
      rows.push(summarize(layer, observed, before, quality()));
    }
    check(!outsideRafDraws && !outsideRafClears,
      "Submissions outside wrapped rAF callbacks make frame attribution incomplete");
    check(gl.getError() === gl.NO_ERROR, "WebGL error during inventory");
    return { passed: rows.every((row) => row.passed), rows, outsideRafDraws, outsideRafClears,
      viewport: { css: [innerWidth, innerHeight], devicePixelRatio, canvasCss: [canvas.width, canvas.height],
        drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight] },
      request: { preset: query.get("cpPreset"), quality: query.get("cpQuality"), hq: query.get("hq") },
      sourceExpectations: "RENDERING-COMPARISON-PLAN.md idle counts assume loaded fields and no selection; diagnostic only. GlobeView.tick submits one main scene per rAF; stipple geometry is submitted once. Uniform/shader signatures are source-derived; pass counts and values above are native runtime observations.",
      limits: "Eight complete rAF timestamps per layer. All core draw methods, including offscreen and zero-count calls. Multi-draw fails explicitly. Submitted primitive counts precede culling/discard and assume no indexed primitive restart. Thick/native lines have unresolved ownership; generic materials cannot distinguish legacy haze, country fills or depth owners. No invisible-object, texture-upload, fragment-sample or physical presentation claims. DOM quality may be unavailable in older builds. Loop assertions cover observed drawing callbacks, screen clears and repeated stipple geometry, not arbitrary hidden JavaScript loops." };
  } catch (error) {
    return { passed: false, error: String(error.stack ?? error), rows, errors, outsideRafDraws, outsideRafClears };
  } finally {
    recording = false; currentFrame = null;
    for (const id of ownRafs) Reflect.apply(nativeCancelRaf, window, [id]);
    for (const timer of timers) clearTimeout(timer);
    for (const restore of restorers.reverse()) restore();
    window.removeEventListener("error", errorEvent);
    window.removeEventListener("unhandledrejection", errorEvent);
    if (initialButton && !initialButton.classList.contains("blob-button--active")) initialButton.click();
    frames.clear(); programs.clear(); targets.clear(); vaos.clear();
  }
})()
