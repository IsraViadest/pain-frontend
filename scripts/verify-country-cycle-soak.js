/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/* eval.mjs expression: cpQuality=standard&cpTimeScale=.005, optional soakMs for bounded rounds.
 * The wall-clock interval is never multiplied by cpTimeScale. Keep the tab visible.
 * Run alone: existing browser helpers choose uncoordinated debugging ports.
 */
(async () => {
  const requestedDuration = Number(new URL(location.href).searchParams.get("soakMs"));
  const durationMs = Number.isFinite(requestedDuration) && requestedDuration > 0
    ? requestedDuration : 30 * 60 * 1000;
  const restore = [], errors = [], samples = [];
  const metrics = { toggles: 0, otherMetrics: 0, countryOpen: 0, countryClose: 0,
    unparsed: 0, failedResponses: 0 };
  const resources = Object.fromEntries(["buffers", "textures", "programs"].map((name) =>
    [name, { live: new Set(), created: 0, deleted: 0, peak: 0 }]));
  const dom = { first: null, min: null, max: null, last: null };
  const states = {}, seen = new Set();
  const gaps = { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0 };
  let app, canvas, toggle, profile, heading, gl, observer;
  let started = 0, wallStarted = 0, runMs = 0, wallMs = 0, running = false, startedCycle = false;
  let lastState = "", lastCompletion = 0, visits = 0, wraps = 0, lastCountry = "";
  let limits = null, warmAtMs = null, completedDuration = false, stoppedCleanly = false, afterStop = null;
  let signalCount = 0, contextLosses = 0, glErrors = 0, maxPollGapMs = 0;
  const note = (message) => {
    signalCount++;
    if (errors.length < 8) errors.push(String(message).slice(0, 500));
  };
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, timeoutMs, message) => {
    const start = performance.now();
    while (!predicate()) {
      if (performance.now() - start >= timeoutMs) throw Error(message);
      await sleep(25);
    }
  };
  const patch = (target, name, replacement) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, { configurable: true, writable: true,
      enumerable: descriptor?.enumerable ?? false, value: replacement });
    restore.push(() => descriptor ? Object.defineProperty(target, name, descriptor) : delete target[name]);
  };
  const listen = (target, type, listener) => {
    target.addEventListener(type, listener);
    restore.push(() => target.removeEventListener(type, listener));
  };
  const liveCounts = () => Object.fromEntries(Object.entries(resources).map(([name, value]) => [name, value.live.size]));
  const publish = (status) => {
    if (!app) return;
    app.dataset.cycleSoakState = status;
    app.dataset.cycleSoakSeconds = String(Math.floor(started ? (performance.now() - started) / 1000 : 0));
    app.dataset.cycleSoakVisits = String(visits);
    app.dataset.cycleSoakWraps = String(wraps);
    app.dataset.cycleSoakResources = JSON.stringify(liveCounts());
    app.dataset.cycleSoakErrors = String(signalCount);
  };
  try {
    const query = new URL(location.href).searchParams;
    check(Number(query.get("cpTimeScale")) === 0.005 && query.get("cpQuality") === "standard",
      "Use cpTimeScale=.005 and cpQuality=standard");
    app = document.querySelector("#app");
    canvas = document.querySelector("#globe");
    toggle = document.querySelector("#country-presentation-toggle");
    profile = document.querySelector("#country-profile");
    heading = profile?.querySelector(".country-profile__country");
    check(app && canvas && toggle && profile && heading, "Country-cycle UI unavailable");
    const requestedPreset = query.get("cpPreset") ?? "v24-b_balanced-cycle";
    check(profile.dataset.preset === requestedPreset, "Country profile preset does not match URL/default");
    check(!document.hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches,
      "Soak needs a visible tab with ordinary motion");
    check(toggle.dataset.state === "idle" && toggle.getAttribute("aria-pressed") === "false" && profile.hidden,
      "Start on a fresh page with no selected country or prior tour");
    const [{ loadEmoData }, { useMockApi }, { getPainServerUserId },
      { resolveCountryProfilePreset }] = await Promise.all([
      import("/src/emo/emoData.ts"), import("/src/api/config.ts"), import("/src/api/session.ts"),
      import("/src/countryProfile/presets.ts"),
    ]);
    const profilePreset = resolveCountryProfilePreset();
    const noFlightPreview = profilePreset.cycle?.previewDuringFlight === false;
    const revealWithNetwork = profilePreset.cycle?.revealWithNetwork === true;
    check(!useMockApi && getPainServerUserId().length > 0, "Country metrics must be enabled to verify their absence");
    const data = await loadEmoData(profilePreset.emotionDataset);
    const categoryLabels = new Map(data.categories.map((category) => [category.key, category.label]));
    const expected = Object.entries(data.countries).map(([iso3, country]) => ({ iso3, name: country.name,
      native: country.term.trim() || categoryLabels.get(country.cat) }))
      .concat(Object.entries(data.missingCountries ?? {}).map(([iso3, country]) =>
        ({ iso3, name: country.name, native: "no data" })))
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
    check(expected.length === 195 && new Set(expected.map((country) => country.name)).size === 195,
      "Expected 195 uniquely named countries");
    await document.fonts.ready;
    await waitFor(() => app.dataset.cpQuality === "standard" && app.dataset.cpQualityTarget === "standard" &&
      app.dataset.cpBudgetExceeded === "false", 30000, "Standard quality did not become ready");
    gl = canvas.getContext("webgl2");
    check(gl && !gl.isContextLost() && gl.getError() === gl.NO_ERROR, "WebGL2 context is not healthy at start");
    const viewport = [innerWidth, innerHeight, devicePixelRatio, canvas.width, canvas.height];

    for (const [name, suffix] of [["buffers", "Buffer"], ["textures", "Texture"], ["programs", "Program"]]) {
      const counters = resources[name], create = gl["create" + suffix], remove = gl["delete" + suffix];
      patch(gl, "create" + suffix, function (...args) {
        const object = Reflect.apply(create, this, args);
        if (!object) note("Native create" + suffix + " returned null");
        else {
          counters.live.add(object);
          counters.created++;
          counters.peak = Math.max(counters.peak, counters.live.size);
          if (running && limits && counters.live.size > limits[name]) note(name + " exceeded the two-cycle live-object bound");
        }
        return object;
      });
      patch(gl, "delete" + suffix, function (object) {
        const result = Reflect.apply(remove, this, arguments);
        if (counters.live.delete(object)) counters.deleted++;
        return result;
      });
    }
    const originalFetch = window.fetch;
    patch(window, "fetch", function (input, init) {
      try {
        const url = new URL(input instanceof Request ? input.url : String(input), location.href);
        if (url.pathname.endsWith("/metrics/toggle")) {
          metrics.toggles++;
          if (typeof init?.body !== "string") {
            metrics.unparsed++; note("Cannot inspect metrics/toggle body without altering its request");
          } else {
            try {
              const body = JSON.parse(init.body);
              if (body.kind === "category" && /^[A-Z]{3}:/.test(body.element)) {
                if (body.enabled === true) metrics.countryOpen++;
                else if (body.enabled === false) metrics.countryClose++;
                else metrics.unparsed++;
                note("Automation emitted a human country metric");
              }
            } catch { metrics.unparsed++; note("Unparseable metrics/toggle body"); }
          }
        } else if (url.pathname.includes("/metrics/")) metrics.otherMetrics++;
      } catch { metrics.unparsed++; note("Fetch observer could not inspect an endpoint"); }
      const request = Reflect.apply(originalFetch, this, arguments);
      request.then((response) => {
        if (!response.ok) { metrics.failedResponses++; note("A fetch returned a failing HTTP status"); }
      }, () => { metrics.failedResponses++; note("A fetch rejected during the soak"); });
      return request;
    });
    const originalError = console.error;
    patch(console, "error", function (...args) {
      note(args.map((value) => value instanceof Error ? value.message : String(value)).join(" "));
      return Reflect.apply(originalError, this, args);
    });
    listen(window, "error", (event) => note(event.error?.message ?? event.message));
    listen(window, "unhandledrejection", (event) => note(event.reason));
    listen(canvas, "webglcontextlost", () => { contextLosses++; note("WebGL context lost"); });
    listen(document, "visibilitychange", () => { if (document.hidden) note("Tab became hidden during the wall-clock soak"); });

    dom.first = dom.last = dom.min = dom.max = document.querySelectorAll("*").length;
    const inspect = () => {
      if (!running) return;
      try {
        const state = toggle.dataset.state, changed = state !== lastState;
        if (changed) { states[state] = (states[state] ?? 0) + 1; lastState = state; }
        check(["preparing", "flying", "building", "dwelling"].includes(state) || (state === "idle" && visits === 0),
          "Unexpected cycle state: " + state);
        if (state === "dwelling" && changed) {
          const next = expected[visits % expected.length];
          check(heading.textContent.trim() === next.name, "Sequence mismatch: expected " + next.name);
          const now = performance.now();
          if (visits) {
            const gap = now - lastCompletion;
            gaps.count++; gaps.totalMs += gap; gaps.minMs = Math.min(gaps.minMs, gap); gaps.maxMs = Math.max(gaps.maxMs, gap);
          }
          if (visits > 0 && visits % expected.length === 0) wraps++;
          visits++; seen.add(next.iso3); lastCountry = next.name; lastCompletion = now;
          if (!limits && wraps >= 2) {
            dom.max = Math.max(dom.max, document.querySelectorAll("*").length);
            limits = { dom: dom.max, ...Object.fromEntries(Object.entries(resources).map(([name, value]) => [name, value.peak])) };
            warmAtMs = now - started;
          }
        }
        if (state === "preparing") check(profile.hidden, "Previous profile remained visible during retraction");
        if (state === "flying") {
          if (noFlightPreview) check(profile.hidden, "Profile appeared during country travel");
          else {
            check(!profile.hidden && profile.dataset.stage === "heading" &&
              heading.textContent.trim() === expected[visits % expected.length].name,
            "Flight preview is stale or missing");
            check(getComputedStyle(profile.querySelector(".country-profile__items")).visibility === "hidden",
              "Profile indicators appeared during country travel");
          }
        }
        if (state === "building") {
          check(!profile.hidden &&
            heading.textContent.trim() === expected[visits % expected.length].name,
          "Building profile is stale or missing");
          check(profile.dataset.stage === (revealWithNetwork ? "full" : "heading"),
            "Building profile stage does not match its reveal mode");
          check(getComputedStyle(profile.querySelector(".country-profile__items")).visibility ===
            (revealWithNetwork ? "visible" : "hidden"),
          "Building indicators do not match their reveal mode");
        }
        if (state === "dwelling") {
          const current = expected[(visits - 1) % expected.length];
          check(!profile.hidden && profile.dataset.stage === "full" && profile.dataset.layer === "all-layers" &&
            heading.textContent.trim() === current.name && profile.getAttribute("aria-live") === "off" &&
            profile.querySelector(".country-profile__native").textContent === current.native,
          "Completed profile is stale, hidden, or not in automatic mode");
          check([...profile.querySelectorAll("[data-indicator]")].filter((element) => !element.hidden).length === 4 &&
            getComputedStyle(profile.querySelector(".country-profile__items")).visibility === "visible",
          "Completed profile does not expose all four indicators");
        }
      } catch (error) { note(error.message); }
    };
    observer = new MutationObserver(inspect);
    observer.observe(toggle, { attributes: true, attributeFilter: ["data-state"] });
    observer.observe(profile, { attributes: true, attributeFilter: ["hidden", "data-stage", "data-layer"] });
    observer.observe(heading, { childList: true, characterData: true, subtree: true });
    wallStarted = Date.now(); started = performance.now(); lastCompletion = started;
    let lastPoll = started, lastSample = -Infinity, lastPublish = -Infinity;
    running = true; startedCycle = true; publish("running"); toggle.click();
    while (performance.now() - started < durationMs || Date.now() - wallStarted < durationMs) {
      const remaining = Math.max(durationMs - (performance.now() - started), durationMs - (Date.now() - wallStarted));
      await sleep(Math.min(1000, Math.max(1, remaining)));
      const now = performance.now();
      maxPollGapMs = Math.max(maxPollGapMs, now - lastPoll); lastPoll = now;
      inspect();
      check([innerWidth, innerHeight, devicePixelRatio, canvas.width, canvas.height]
        .every((value, index) => value === viewport[index]), "Viewport changed during the fixed-size soak");
      check(!document.hidden && toggle.getAttribute("aria-pressed") === "true", "Tour stopped or backgrounded unexpectedly");
      check(now - lastCompletion < 30000, "No completed country observed for 30 wall-clock seconds");
      check(!gl.isContextLost(), "WebGL context lost");
      if (gl.getError() !== gl.NO_ERROR) { glErrors++; note("WebGL reported an error"); }
      check(app.dataset.cpQuality === "standard" && app.dataset.cpQualityTarget === "standard" &&
        app.dataset.cpBudgetExceeded === "false", "Quality changed or exceeded its reported resource budget");
      dom.last = document.querySelectorAll("*").length;
      dom.min = Math.min(dom.min, dom.last); dom.max = Math.max(dom.max, dom.last);
      check(!limits || dom.last <= limits.dom, "DOM exceeded the two-cycle warmup bound");
      if (now - lastSample >= 60000) {
        if (samples.length === 8) samples.shift();
        samples.push({ seconds: Math.round((now - started) / 1000), visits, wraps, dom: dom.last, ...liveCounts() });
        lastSample = now;
      }
      if (now - lastPublish >= 5000) { publish("running"); lastPublish = now; }
      check(signalCount === 0, errors[0] ?? "Soak error");
    }
    runMs = performance.now() - started; wallMs = Date.now() - wallStarted;
    check(visits >= 196 && seen.size === 195 && wraps >= 2 && limits, "Full sequence, wrap, or resource warmup was not observed");
    completedDuration = true;
  } catch (error) { note(error instanceof Error ? error.message : String(error)); }
  finally {
    if (started) { runMs ||= performance.now() - started; wallMs ||= Date.now() - wallStarted; }
    running = false;
    observer?.disconnect();
    if (startedCycle && toggle?.getAttribute("aria-pressed") === "true") {
      toggle.click();
      try {
        await waitFor(() => toggle.dataset.state === "paused-user" && toggle.getAttribute("aria-pressed") === "false" &&
          profile.hidden, 10000, "Cycle did not stop cleanly");
        stoppedCleanly = true;
      } catch (error) { note(error.message); }
    }
    afterStop = { state: toggle?.dataset.state ?? null, profileHidden: profile?.hidden ?? null, ...liveCounts() };
    for (const undo of restore.reverse()) undo();
    publish(completedDuration && stoppedCleanly && signalCount === 0 ? "passed" : "failed");
  }
  const native = Object.fromEntries(Object.entries(resources).map(([name, value]) =>
    [name, { created: value.created, deleted: value.deleted, live: value.live.size, peak: value.peak }]));
  for (const value of Object.values(resources)) value.live.clear();
  return { passed: completedDuration && stoppedCleanly && signalCount === 0, requiredMs: durationMs,
    runMs: Math.round(runMs), wallMs, visits, uniqueCountries: seen.size, wraps, lastCountry,
    sequenceAndProfileStates: states, intervalMs: { min: gaps.count ? gaps.minMs : null,
      mean: gaps.count ? gaps.totalMs / gaps.count : null, max: gaps.count ? gaps.maxMs : null },
    metrics, nativeResourcesCreatedAfterHook: native, warmLimits: limits, warmAtMs, dom,
    afterStop, stoppedCleanly, contextLosses, glErrors, maxPollGapMs, errorSignals: signalCount, errors, samples };
})()
