/* Real app wheel gestures and actual submitted point counts, using existing eval.mjs. */
(async () => {
  let restore;
  try {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Physical Pain").click();
    await sleep(700);
    const canvas = document.querySelector("canvas"), gl = canvas.getContext("webgl2");
    const original = gl.drawArrays.bind(gl);
    let counts = [];
    gl.drawArrays = (mode, start, count) => {
      if (mode === gl.POINTS) counts.push(count);
      return original(mode, start, count);
    };
    restore = () => { gl.drawArrays = original; };
    const zoom = (deltaY) => canvas.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true, cancelable: true, deltaY,
    }));
    const rows = [], started = performance.now();
    let previous = started;
    await new Promise((resolve) => {
      let frame = 0;
      const sample = (now) => {
        rows.push({ frame, ms: now - previous, children: counts.reduce((n, count) =>
          n + (count === 82000 ? 0 : count), 0), base: counts.includes(82000) });
        previous = now;
        counts = [];
        if (frame === 15) zoom(-400);
        if (frame >= 35 && frame < 115) zoom(-10);
        if (frame >= 145 && frame < 205) zoom(frame % 2 ? -10 : 10);
        if (frame === 230) zoom(1500);
        if (++frame >= 330) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const sampleRows = rows.slice(2);
    const ordered = sampleRows.map((row) => row.ms).sort((a, b) => a - b);
    const peak = Math.max(...sampleRows.map((row) => row.children));
    const mode = new URL(location.href).searchParams.get("cpPreset");
    if (sampleRows.some((row) => !row.base)) throw Error("original point draw disappeared");
    if (peak > 131072) throw Error("submitted more than the child budget");
    if (mode.includes("four-child") || mode.includes("two-level")) {
      if (peak === 0) throw Error("real close-view gesture never refined");
    } else if (peak !== 0) throw Error("control unexpectedly drew descendants");
    if (sampleRows.slice(-15).some((row) => row.children !== 0)) throw Error("zoom-out stranded descendants");
    const requests = performance.getEntriesByType("resource").filter((entry) =>
      entry.startTime >= started && /\/init\//.test(entry.name)).map((entry) => entry.name);
    if (requests.length) throw Error("zoom requested data");
    const previousDisplay = canvas.style.display;
    try {
      canvas.style.display = "none";
      await sleep(40);
    } finally { canvas.style.display = previousDisplay; }
    counts = [];
    await sleep(60);
    if (!counts.includes(82000)) throw Error("zero-size canvas stopped the render loop");
    return { passed: true, preset: mode, peakDescendants: peak,
      medianMs: ordered[Math.floor(ordered.length / 2)],
      p95Ms: ordered[Math.ceil(ordered.length * 0.95) - 1], maxMs: ordered.at(-1),
      steadyNearCounts: [...new Set(rows.slice(207, 225).map((row) => row.children))],
      lastCount: rows.at(-1).children, dataRequests: requests.length, frames: sampleRows.length,
      zeroSizeRecovery: true };
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error) };
  } finally { restore?.(); }
})()
