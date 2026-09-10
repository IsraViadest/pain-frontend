/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/*
 * Browser expression for the existing workspace `artifacts/emo-views/eval.mjs` runner.
 * It is read as text and evaluated in GPU-backed Chrome; it is not bundled into the app.
 *
 * Query controls:
 *   perfScenario=rest|selected|building
 *   perfIso=IND
 *   perfMs=20000
 *   perfLayer=envpain|physpain|socioecopain
 */
(async () => {
  const query = new URL(location.href).searchParams;
  const scenario = query.get("perfScenario") ?? "rest";
  const sampleMs = Number(query.get("perfMs") ?? 20000);
  const canvas = document.querySelector("canvas");
  if (!canvas) throw new Error("WebGL canvas unavailable");
  const layer = query.get("perfLayer");
  if (layer) {
    const label = { envpain: "Environmental Pain", physpain: "Physical Pain",
      socioecopain: "Socio-economic Pain" }[layer];
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === label);
    if (!button) throw Error("Unknown performance layer: " + layer);
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 1800));
  }

  if (scenario === "selected" || scenario === "building") {
    const iso3 = query.get("perfIso") ?? "IND";
    const label = document.querySelector(`.emo-label[data-iso3="${iso3}"]`);
    if (!label) throw new Error(`Label unavailable: ${iso3}`);
    const rect = label.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    // Seed document hit-testing without asking OrbitControls to capture an untrusted pointer.
    document.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, clientX, clientY }),
    );
    canvas.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX, clientY }),
    );
    if (scenario === "selected") await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!gl) throw new Error("WebGL context unavailable");

  const names = [
    "drawArrays",
    "drawElements",
    "drawArraysInstanced",
    "drawElementsInstanced",
  ].filter((name) => typeof gl[name] === "function");
  const originals = new Map();
  const calls = Object.fromEntries(names.map((name) => [name, 0]));
  let primitives = 0;

  const countPrimitives = (mode, count, instances = 1) => {
    let perInstance = 0;
    if (mode === gl.TRIANGLES) perInstance = count / 3;
    else if (mode === gl.TRIANGLE_STRIP || mode === gl.TRIANGLE_FAN) {
      perInstance = Math.max(0, count - 2);
    } else if (mode === gl.LINES) perInstance = count / 2;
    else if (mode === gl.LINE_STRIP) perInstance = Math.max(0, count - 1);
    else if (mode === gl.POINTS) perInstance = count;
    primitives += perInstance * instances;
  };

  for (const name of names) {
    const original = gl[name].bind(gl);
    originals.set(name, original);
    gl[name] = (...args) => {
      calls[name] += 1;
      if (name === "drawArrays") countPrimitives(args[0], args[2]);
      if (name === "drawElements") countPrimitives(args[0], args[1]);
      if (name === "drawArraysInstanced") {
        countPrimitives(args[0], args[2], args[3]);
      }
      if (name === "drawElementsInstanced") {
        countPrimitives(args[0], args[1], args[4]);
      }
      return original(...args);
    };
  }

  const originalBindTexture = gl.bindTexture.bind(gl);
  const textures = new Set();
  gl.bindTexture = (target, texture) => {
    if (texture) textures.add(texture);
    return originalBindTexture(target, texture);
  };

  const deltas = [];
  let last = performance.now();
  const started = last;
  await new Promise((resolve) => {
    const frame = (now) => {
      deltas.push(now - last);
      last = now;
      if (now - started >= sampleMs) resolve();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  for (const [name, original] of originals) gl[name] = original;
  gl.bindTexture = originalBindTexture;

  const sorted = deltas.slice(1).sort((a, b) => a - b);
  const quantile = (fraction) =>
    sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
  const totalCalls = Object.values(calls).reduce((sum, value) => sum + value, 0);
  const labels = [...document.querySelectorAll(".emo-label")];
  const emphasised = [...document.querySelectorAll(".emo-label--emphasis")];
  const painted = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility === "visible" && Number(style.opacity) > 0.01 &&
      rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 &&
      rect.left < innerWidth && rect.top < innerHeight;
  };

  return {
    passed: true,
    scenario,
    layer: layer ?? "all-layers",
    gpuTimerAvailable: !!gl.getExtension("EXT_disjoint_timer_query_webgl2"),
    viewport: [innerWidth, innerHeight],
    sampleMs,
    frames: sorted.length,
    medianMs: Number(quantile(0.5).toFixed(3)),
    p95Ms: Number(quantile(0.95).toFixed(3)),
    maxMs: Number(sorted.at(-1).toFixed(3)),
    drawCallsPerFrame: Number((totalCalls / sorted.length).toFixed(2)),
    primitivesPerFrame: Math.round(primitives / sorted.length),
    texturesUsed: textures.size,
    domElements: document.querySelectorAll("*").length,
    labels: labels.length,
    visibleLabels: labels.filter(painted).length,
    emphasisedLabels: emphasised.length,
    visibleEmphasised: emphasised.filter(painted).length,
    calls,
  };
})().catch((error) => ({
  passed: false,
  error: error instanceof Error ? error.stack : String(error),
}))
