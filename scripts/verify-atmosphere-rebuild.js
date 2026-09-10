/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/**
 * Existing eval.mjs expression on a loaded Vite page. Exercises real texture rebuilds.
 */
(async () => {
  const check = (value, message) => { if (!value) throw Error(message); };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const url = performance.getEntriesByType("resource")
    .find(entry => entry.name.includes("/src/globe/GlobeView.ts"))?.name;
  check(url, "Use the loaded Vite application");
  const { GlobeView } = await import(url);
  const originalTick = GlobeView.prototype.tick;
  const globe = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      GlobeView.prototype.tick = originalTick;
      reject(Error("No application frame"));
    }, 3000);
    GlobeView.prototype.tick = function () {
      GlobeView.prototype.tick = originalTick;
      clearTimeout(timer);
      originalTick.call(this);
      resolve(this);
    };
  });
  const previousLayer = document.querySelector("button[data-layer].blob-button--active");
  const previousPattern = globe.environmentalFieldPattern;
  const gl = globe.renderer.getContext();
  const names = ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"];
  const original = new Map(names.map(name => [name, gl[name]]));
  let draws = 0;
  for (const name of names) gl[name] = function (...args) {
    draws++;
    return original.get(name).apply(this, args);
  };
  const sample = async () => {
    await new Promise(requestAnimationFrame);
    draws = 0;
    for (let i = 0; i < 8; i++) await new Promise(requestAnimationFrame);
    return draws;
  };
  const rows = [];
  try {
    document.querySelector('button[data-layer="envpain"]').click();
    await sleep(1800);
    check(globe.getAtmosphereStats()?.mode.startsWith("volume"), "Expected volume candidate");
    const baseline = await sample();
    for (const action of ["temperature", "co2", "pattern", "clear"]) {
      if (action === "temperature") globe.rebuildTempHeat();
      if (action === "co2") globe.rebuildCo2Haze();
      if (action === "pattern") globe.setEnvironmentalFieldPattern("grain");
      if (action === "clear") {
        document.querySelector('button[data-layer="physpain"]').click();
        await sleep(1800);
        globe.rebuildTempHeat(); globe.rebuildCo2Haze();
      }
      await sleep(100);
      check(!globe.temperatureShell.visible && !globe.co2Haze.visible,
        action + ": legacy atmospheric shell became visible");
      const count = await sample();
      check(action === "clear" ? count < baseline : count === baseline,
        action + ": unexpected draw count " + count + " versus " + baseline);
      rows.push({ action, draws: count });
    }
    return { passed: true, baselineDraws: baseline, framesPerSample: 8, rows };
  } finally {
    for (const [name, fn] of original) gl[name] = fn;
    globe.setEnvironmentalFieldPattern(previousPattern);
    previousLayer?.click();
  }
})().catch(error => ({ passed: false, error: String(error.stack ?? error) }));
