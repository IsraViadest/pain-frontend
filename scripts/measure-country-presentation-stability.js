/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/*
 * Browser expression for artifacts/emo-views/eval.mjs.
 * Run with cpTimeScale=0.005. Defaults to the required 30-minute stability interval.
 */
(async () => {
  const durationMs = Number(
    new URL(location.href).searchParams.get("stabilityMs") ?? 1_800_000,
  );
  const toggle = document.querySelector("#country-presentation-toggle");
  const profile = document.querySelector("#country-profile");
  const country = profile?.querySelector(".country-profile__country");
  if (!(toggle instanceof HTMLButtonElement) || !profile || !country) {
    throw new Error("presentation controls unavailable");
  }

  const emoData = await fetch("/emo/emo-data.json").then((response) => response.json());
  const expectedCountries = Object.values(emoData.countries)
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  const countries = [];
  const countryTimes = [];
  let sequenceErrors = 0;
  const errors = [];
  const samples = [];
  const probeStarted = performance.now();
  let longTaskCount = 0;
  let longTaskMaxMs = 0;
  let longTaskTotalMs = 0;
  let liveLongTaskCount = 0;
  const longTasks = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      longTaskCount++;
      if (entry.startTime >= probeStarted) liveLongTaskCount++;
      longTaskMaxMs = Math.max(longTaskMaxMs, entry.duration);
      longTaskTotalMs += entry.duration;
    }
  });
  longTasks.observe({ type: "longtask", buffered: true });
  const recordCountry = () => {
    const name = country.textContent?.trim();
    if (!name || countries.at(-1) === name) return;
    const expected = expectedCountries[countries.length % expectedCountries.length];
    if (name !== expected) sequenceErrors++;
    countries.push(name);
    countryTimes.push(performance.now());
  };
  const observer = new MutationObserver(recordCountry);
  observer.observe(country, { childList: true, subtree: true });
  addEventListener("error", (event) => errors.push(String(event.error ?? event.message)));
  addEventListener("unhandledrejection", (event) => errors.push(String(event.reason)));

  let previousSample = performance.now();
  let maxSampleGapMs = 0;
  const sample = () => {
    const now = performance.now();
    maxSampleGapMs = Math.max(maxSampleGapMs, now - previousSample);
    previousSample = now;
    samples.push({
      atMs: Math.round(now),
      dom: document.querySelectorAll("*").length,
      heap: performance.memory?.usedJSHeapSize ?? null,
      state: toggle.dataset.state,
    });
  };
  sample();
  const timer = window.setInterval(sample, 10_000);
  toggle.click();
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  window.clearInterval(timer);
  sample();
  observer.disconnect();
  longTasks.disconnect();
  const wasRunning = toggle.getAttribute("aria-pressed") === "true";
  if (wasRunning) toggle.click();
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  const domValues = samples.map((entry) => entry.dom);
  const heapValues = samples
    .map((entry) => entry.heap)
    .filter((value) => typeof value === "number");
  const countryIntervals = countryTimes
    .slice(1)
    .map((time, index) => time - countryTimes[index])
    .sort((a, b) => a - b);
  const percentile = (fraction) =>
    countryIntervals[Math.max(0, Math.ceil(countryIntervals.length * fraction) - 1)] ?? 0;
  const stoppedCleanly =
    toggle.getAttribute("aria-pressed") === "false" && profile.hidden;
  const passed =
    wasRunning &&
    countries.length >= Math.max(1, Math.floor(durationMs / 500)) &&
    sequenceErrors === 0 &&
    Math.max(...domValues) === Math.min(...domValues) &&
    errors.length === 0 &&
    stoppedCleanly;
  return {
    passed,
    durationMs,
    wasRunning,
    countryChanges: countries.length,
    uniqueCountries: new Set(countries).size,
    firstCountries: countries.slice(0, 6),
    lastCountries: countries.slice(-6),
    wraps: countries.reduce(
      (count, name, index) => count + Number(name === "Afghanistan" && index > 0),
      0,
    ),
    sequenceErrors,
    countryIntervalMs: {
      min: Number((countryIntervals[0] ?? 0).toFixed(1)),
      median: Number(percentile(0.5).toFixed(1)),
      p95: Number(percentile(0.95).toFixed(1)),
      max: Number((countryIntervals.at(-1) ?? 0).toFixed(1)),
    },
    dom: { min: Math.min(...domValues), max: Math.max(...domValues) },
    heap: heapValues.length
      ? {
          first: heapValues[0],
          last: heapValues.at(-1),
          min: Math.min(...heapValues),
          max: Math.max(...heapValues),
        }
      : null,
    maxSampleGapMs: Number(maxSampleGapMs.toFixed(1)),
    longTasks: {
      count: longTaskCount,
      liveCount: liveLongTaskCount,
      maxMs: Number(longTaskMaxMs.toFixed(1)),
      totalMs: Number(longTaskTotalMs.toFixed(1)),
    },
    errors,
    stoppedCleanly,
  };
})()
