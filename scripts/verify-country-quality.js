/* Live app expression for existing eval.mjs. Suggested URL controls:
 * cp=1&cpPreset=v18-a_composed&cpQuality=auto|light|standard|rich&cam=20,78,2.35&freeze=1
 * No private module/prototype patches; GPU settings are inspected at actual draw calls.
 */
(async () => {
  const restore = [];
  const reports = [];
  const stages = [];
  const errors = [];
  const glErrors = [];
  const zoomRequests = [];
  const programs = new Map();
  const bufferCapacities = new Map();
  let observer, resources, gl, capture = null, selected = false, reportSerial = 0;
  let zoomStart = Infinity, zoomEnd = -Infinity;
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const noteError = (error) => {
    if (errors.length < 8) errors.push(error instanceof Error ? error.stack : String(error));
  };
  function patch(target, name, replacement) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, { configurable: true, writable: true,
      enumerable: descriptor?.enumerable ?? false, value: replacement });
    restore.push(() => descriptor ? Object.defineProperty(target, name, descriptor) : delete target[name]);
  }
  const onError = (event) => noteError(event.error ?? event.message);
  const onRejection = (event) => noteError(event.reason);
  try {
    const query = new URL(location.href).searchParams;
    const request = query.get("cpQuality") ?? "auto";
    const profiles = {
      light: { capacity: 16384, samples: 16, fraction: 0.25, budget: 64 * 1024 ** 2 },
      standard: { capacity: 32768, samples: 16, fraction: 0.5, budget: 128 * 1024 ** 2 },
      rich: { capacity: 65536, samples: 32, fraction: 0.5, budget: 128 * 1024 ** 2 },
    };
    check(request === "auto" || profiles[request], "Unknown cpQuality request");
    const allowed = request === "auto" ? ["light", "standard"] : [request];
    const app = document.querySelector("#app"), canvas = document.querySelector("canvas");
    const profile = document.querySelector("#country-profile"), host = document.querySelector("#emo-label-host");
    check(app && canvas && profile && host, "Country quality UI unavailable");
    gl = canvas.getContext("webgl2");
    check(gl && !gl.isContextLost(), "Live WebGL2 context unavailable");
    const maximumTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const originalError = console.error;
    patch(console, "error", function (...args) {
      noteError(args.map((value) => value instanceof Error ? value.stack : String(value)).join(" "));
      return Reflect.apply(originalError, this, args);
    });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    const checkProfile = () => {
      if (selected) check(!profile.hidden && profile.querySelector("h2")?.textContent.trim() === "India",
        "India profile was cleared or replaced");
    };
    const checkErrors = () => {
      check(!errors.length, "Console, application or draw-hook error: " + errors[0]);
      check(!gl.isContextLost(), "WebGL context lost");
      for (let i = 0; i < 8; i++) {
        const error = gl.getError();
        if (error === gl.NO_ERROR) break;
        if (glErrors.length < 8) glErrors.push(error);
      }
      check(!glErrors.length, "WebGL error: " + glErrors.join(","));
      checkProfile();
    };
    async function waitFor(predicate, label, timeout = 20000) {
      const deadline = performance.now() + timeout;
      while (performance.now() < deadline) {
        checkErrors();
        const value = predicate();
        if (value) return value;
        await sleep(50);
      }
      throw new Error("Timed out: " + label);
    }
    function qualityReport() {
      const current = app.dataset.cpQuality, target = app.dataset.cpQualityTarget;
      const bytes = Number(app.dataset.cpDetailBytes), budget = Number(app.dataset.cpDetailBudget);
      if (!current || !target || !Number.isFinite(bytes) || !Number.isFinite(budget) || budget <= 0) return null;
      check(allowed.includes(current) && allowed.includes(target), "Quality exceeded requested level: " + current + "/" + target);
      return { current, target, bytes, budget, exceeded: app.dataset.cpBudgetExceeded };
    }
    observer = new MutationObserver(() => {
      try {
        const report = qualityReport();
        if (report) {
          reportSerial++;
          reports.push(report);
          if (reports.length > 10) reports.shift();
        }
      } catch (error) { noteError(error); }
    });
    observer.observe(app, { attributes: true, attributeFilter: ["data-cp-quality", "data-cp-quality-target",
      "data-cp-detail-bytes", "data-cp-detail-budget", "data-cp-budget-exceeded"] });
    async function settledReport(label, fresh = true) {
      const serial = reportSerial;
      const report = await waitFor(() => {
        const value = qualityReport();
        return value && value.current === value.target && (!fresh || reportSerial > serial) ? value : null;
      }, label + " quality report");
      check(report.bytes > 0 && report.bytes <= report.budget && report.exceeded === "false",
        label + ": active quality budget exceeded");
      check(report.budget === profiles[report.current].budget, label + ": wrong active budget");
      return report;
    }
    resources = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.startTime < zoomStart || entry.startTime > zoomEnd) continue;
        const path = new URL(entry.name).pathname;
        if (/\/(?:init|borders)(?:\/|$)|\/emo\/emo-data\.json$/.test(path) && zoomRequests.length < 8) {
          zoomRequests.push(path);
        }
      }
    });
    resources.observe({ type: "resource", buffered: false });

    for (const name of ["drawArrays", "drawElements", "drawRangeElements", "drawArraysInstanced", "drawElementsInstanced"]) {
      const original = gl[name];
      if (typeof original !== "function") continue;
      patch(gl, name, function (...args) {
        if (capture) {
          try {
            const program = gl.getParameter(gl.CURRENT_PROGRAM);
            let info = programs.get(program);
            if (program && !info) {
              info = { samples: gl.getUniformLocation(program, "uSamples"),
                detail: gl.getUniformLocation(program, "uDetailMode"), size: gl.getAttribLocation(program, "aSizeScale") };
              programs.set(program, info);
            }
            if (info?.samples !== null && info?.samples !== undefined) {
              const samples = Number(gl.getUniform(program, info.samples));
              const viewport = gl.getParameter(gl.VIEWPORT);
              capture.samples.add(samples);
              capture.volumeTargets.add(samples + ":" + viewport[2] + "x" + viewport[3]);
              capture.volumeDraws++;
              const matches = allowed.some((level) => {
                const setting = profiles[level];
                const scale = Math.min(setting.fraction, 1,
                  Math.sqrt(1048576 / (gl.drawingBufferWidth * gl.drawingBufferHeight)),
                  maximumTextureSize / gl.drawingBufferWidth, maximumTextureSize / gl.drawingBufferHeight);
                return samples === setting.samples && viewport[2] === Math.max(1, Math.floor(gl.drawingBufferWidth * scale)) &&
                  viewport[3] === Math.max(1, Math.floor(gl.drawingBufferHeight * scale));
              });
              check(matches, "Actual volume settings do not match requested quality: " + samples +
                " samples at " + viewport[2] + "x" + viewport[3]);
            }
            if (name === "drawArrays" && args[0] === gl.POINTS && info?.detail !== null && info?.detail !== undefined) {
              if (args[2] === 82000) capture.baseDraws++;
              else if (args[2] > 0) {
                check(info.size >= 0, "Refined point draw lacks size attribute");
                const buffer = gl.getVertexAttrib(info.size, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
                check(buffer, "Refined point draw has no size buffer");
                let capacity = bufferCapacities.get(buffer);
                if (capacity === undefined) {
                  const previous = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
                  try {
                    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                    capacity = gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE) / 4;
                    bufferCapacities.set(buffer, capacity);
                  } finally { gl.bindBuffer(gl.ARRAY_BUFFER, previous); }
                }
                check(allowed.some((level) => capacity === profiles[level].capacity), "Actual child-buffer capacity is wrong: " + capacity);
                check(args[2] <= capacity, "Draw range exceeds child capacity");
                capture.capacities.add(capacity);
                capture.peakDescendants = Math.max(capture.peakDescendants, args[2]);
              }
            }
          } catch (error) { noteError(error); }
        }
        return Reflect.apply(original, this, args);
      });
    }
    const layerButton = (layer) => [...document.querySelectorAll("button[data-layer]")]
      .find((button) => button.dataset.layer === (layer === "all-layers" ? "all-pain" : layer));
    const chooseLayer = (layer) => {
      const button = layerButton(layer);
      check(button && !button.disabled, "Layer button unavailable: " + layer);
      button.click();
    };
    const waitLayer = (layer) => waitFor(() => profile.dataset.layer === layer && profile.dataset.transition !== "out",
      "layer " + layer);
    const beginCapture = (name) => {
      capture = { name, samples: new Set(), volumeTargets: new Set(), capacities: new Set(),
        volumeDraws: 0, baseDraws: 0, peakDescendants: 0 };
    };
    const endCapture = (requireVolume, requireChildren = false) => {
      checkErrors();
      if (requireVolume) check(capture.volumeDraws > 0, "No actual volume draw observed: " + capture.name);
      check(capture.baseDraws > 0, "Original 82000-point draw missing: " + capture.name);
      if (requireChildren) check(capture.peakDescendants > 0 && capture.capacities.size > 0, "No refined points observed at close zoom");
      stages.push({ ...capture, samples: [...capture.samples], volumeTargets: [...capture.volumeTargets], capacities: [...capture.capacities] });
      capture = null;
    };
    await settledReport("initial", false);
    chooseLayer("all-layers");
    await waitLayer("all-layers");
    const hit = await waitFor(() => {
      const label = document.querySelector('.emo-label[data-iso3="IND"]');
      if (!label) return null;
      const rect = label.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const previous = host.getAttribute("data-hit");
      try {
        host.dataset.hit = "on";
        for (const xPart of [0.5, 0.25, 0.75]) for (const yPart of [0.5, 0.25, 0.75]) {
          const x = rect.left + rect.width * xPart, y = rect.top + rect.height * yPart;
          if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
          if (document.elementFromPoint(x, y)?.closest(".emo-label") === label) return { x, y };
        }
        return null;
      } finally {
        if (previous === null) host.removeAttribute("data-hit");
        else host.setAttribute("data-hit", previous);
      }
    }, "exposed India label; use cam=20,78,2.35&freeze=1", 10000);
    // Seed the app's document capture listener without invoking native pointer capture for an
    // untrusted synthetic pointer. This checks hit-testing, not physical pointer/drag behavior.
    document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: hit.x, clientY: hit.y }));
    canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: hit.x, clientY: hit.y }));
    await waitFor(() => !profile.hidden && profile.querySelector("h2")?.textContent.trim() === "India", "India canvas hit");
    selected = true;
    await settledReport("selected");
    beginCapture("all-selected");
    await sleep(350);
    endCapture(true);

    chooseLayer("physpain");
    await waitLayer("physpain");
    await settledReport("physical");
    beginCapture("physical-close");
    zoomStart = performance.now();
    zoomEnd = Infinity;
    const wheel = (deltaY) => {
      const rect = canvas.getBoundingClientRect();
      const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY,
        clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
      canvas.dispatchEvent(event);
      check(event.defaultPrevented, "Canvas wheel gesture was not consumed");
    };
    wheel(-1600);
    for (let i = 0; i < 20; i++) { await sleep(50); checkErrors(); }
    await settledReport("close zoom");
    endCapture(false, true);
    wheel(1200);
    for (let i = 0; i < 16; i++) { await sleep(50); checkErrors(); }
    await settledReport("zoom return");
    zoomEnd = performance.now();
    check(!zoomRequests.length, "Zoom requested application data: " + zoomRequests.join(","));

    for (const sequence of [["physpain", "envpain", "all-layers"],
      ["all-layers", "physpain", "envpain"], ["envpain", "physpain", "all-layers"]]) {
      for (const layer of sequence) { chooseLayer(layer); await sleep(40); checkErrors(); }
      const expected = sequence[sequence.length - 1];
      await waitLayer(expected);
      const report = await settledReport(expected + " race");
      beginCapture("race-to-" + expected);
      await sleep(350);
      endCapture(true);
      stages[stages.length - 1].quality = report.current;
      check(layerButton(expected).classList.contains("blob-button--active"), "Layer chrome is stale after race");
    }
    checkErrors();
    check(!zoomRequests.length, "Delayed zoom data request completed during layer checks");
    return { passed: true, request, selectedCountry: "India", finalLayer: profile.dataset.layer,
      profilePreserved: true, reports, reportCount: reportSerial, stages,
      zoomDataRequests: zoomRequests.length, consoleAndHookErrors: errors.length, glErrors,
      actualGpuUniformsAndBuffers: true };
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error),
      reports, stages, errors, glErrors, zoomRequests,
      activeStage: capture ? { name: capture.name, samples: [...capture.samples],
        volumeTargets: [...capture.volumeTargets], capacities: [...capture.capacities],
        peakDescendants: capture.peakDescendants } : null };
  } finally {
    capture = null;
    observer?.disconnect();
    resources?.disconnect();
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    for (const undo of restore.reverse()) undo();
    programs.clear();
    bufferCapacities.clear();
  }
})()
