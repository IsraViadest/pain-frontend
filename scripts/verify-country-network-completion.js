/*
 * GPU-backed Vite browser expression for artifacts/emo-views/eval.mjs.
 * Run with ?cp=1&cpTimeScale=0.05&freeze=1. Require passed:true in the JSON result.
 * Exercises the actual arc and cycle modules independently, then the visible app gesture.
 */
(async () => {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (predicate, label) => {
    for (let i = 0; i < 250; i++) {
      if (predicate()) return;
      await sleep(10);
    }
    throw new Error("Timed out: " + label);
  };
  const cleanup = [];
  try {
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const { createEmoArcLayer } = await import("/src/emo/arcs.ts");
    const { createEmoSelectionMotion } = await import("/src/emo/selectionMotion.ts");
    const { DEFAULT_EMO_PARAMS } = await import("/src/emo/viewParams.ts");
    const { loadEmoData } = await import("/src/emo/emoData.ts");
    const { CountryPresentation } = await import("/src/countryProfile/presentation.ts");
    const { resolveCountryProfilePreset } = await import("/src/countryProfile/presets.ts");
    const data = await loadEmoData();
    const params = {
      ...DEFAULT_EMO_PARAMS, networkMode: "selected", categoryGraph: "delaunay",
      selectionLeaderMs: 40, selectionSpreadMs: 80, selectionRetractSpeed: 2,
    };
    const motion = createEmoSelectionMotion({ data, params });
    const globe = {
      earthContent: new THREE.Group(),
      camera: new THREE.PerspectiveCamera(),
      renderer: { domElement: { clientWidth: 1500, clientHeight: 950 } },
    };
    globe.camera.position.z = 2.35;
    const arcs = await createEmoArcLayer({ globe, data, params, motion });
    cleanup.push(() => arcs.destroy());
    const cat = data.countries.IND.cat;
    motion.setSelection(cat);
    arcs.setSelectedCategory(cat, "IND");
    const visible = globe.earthContent.getObjectByName("emo-arcs").children.filter((x) => x.visible);
    check(visible.length === 1, "one selected category mesh");
    const mesh = visible[0];
    check(mesh.geometry.instanceCount === 0, "new geometry flashed before its first update");
    await sleep(180);
    motion.tick();
    arcs.update();
    const completeSegments = mesh.geometry.attributes.instanceStart.count;
    check(completeSegments > 0 && mesh.geometry.instanceCount === completeSegments,
      "construction did not draw every planned segment");
    motion.setSelection(null);
    arcs.setSelectedCategory(null);
    await sleep(180);
    motion.tick();
    arcs.update();
    check(!mesh.visible || mesh.geometry.instanceCount === 0,
      "retracted category still draws segments");

    const host = document.createElement("div");
    let selected = null, paused = false, building = false, retreating = false;
    let suppressed = false, selections = 0, layerRestores = 0;
    let buildTimer = null, retreatTimer = null;
    const controls = new EventTarget();
    const cycle = new CountryPresentation({
      appRoot: host,
      profiles: new Map([["IND", { iso3: "IND", countryName: "India" }]]),
      controls,
      getSelectedIso3: () => selected,
      getCurrentLayer: () => "emopain",
      enterAllLayers: async () => {},
      restoreLayer: () => { layerRestores++; },
      moveTo: async (_iso, signal) => {
        await sleep(10);
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      },
      selectCountry: (iso) => {
        selected = iso; selections++; building = true;
        buildTimer = setTimeout(() => { if (!paused) building = false; }, 200);
      },
      clearCountry: () => {
        if (selected) {
          retreating = true; building = false;
          clearTimeout(buildTimer);
          retreatTimer = setTimeout(() => { if (!paused) retreating = false; }, 180);
        }
        selected = null;
      },
      isBuilding: () => building,
      isRetreating: () => retreating,
      setMotionPaused: (value) => { paused = value; },
      setPresentationTiming: () => {},
      setProfileSuppressed: (value) => { suppressed = value; },
      setProfileAutoplay: () => {},
      getAutoSpin: () => false,
      setAutoSpin: () => {},
    });
    cleanup.push(() => { cycle.destroy(); clearTimeout(buildTimer); clearTimeout(retreatTimer); });
    const toggle = host.querySelector("button");
    toggle.click();
    await until(() => toggle.dataset.state === "building", "fixture build");
    document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    controls.dispatchEvent(new Event("start"));
    check(toggle.dataset.state === "paused-interaction", "interaction did not pause cycle");
    check(!paused, "interaction froze shared network motion");
    await until(() => !building && !suppressed, "finish and reveal after canceled scheduler");
    await sleep(100);
    check(selections === 1, "paused cycle advanced");
    toggle.click();
    document.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    await until(() => layerRestores === 1, "Stop restores only after reversal");
    check(!retreating && !suppressed, "Stop left a partial retraction or suppressed profile");

    const realToggle = document.querySelector("#country-presentation-toggle");
    const profile = document.querySelector("#country-profile");
    check(realToggle && profile, "real app not ready");
    realToggle.click();
    await until(() => realToggle.dataset.state === "building", "real build");
    document.querySelector("canvas").dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, deltaY: 0 }),
    );
    check(realToggle.dataset.state === "paused-interaction", "real gesture did not pause");
    await until(() => !profile.hidden && profile.dataset.stage !== "heading",
      "real interrupted build reveals the profile");
    const country = profile.querySelector("h2").textContent;
    realToggle.click();
    await sleep(500);
    check(profile.hidden, "real Stop did not clear profile");

    realToggle.click();
    await until(() => realToggle.dataset.state === "building", "hidden-tab build");
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
    const restoreHidden = () => {
      if (hiddenDescriptor) Object.defineProperty(document, "hidden", hiddenDescriptor);
      else delete document.hidden;
    };
    cleanup.push(restoreHidden);
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    check(realToggle.dataset.state === "backgrounded", "hidden tab did not freeze cycle");
    await sleep(30);
    const labelStates = () => [...document.querySelectorAll(".emo-label")]
      .map((x) => x.style.getPropertyValue("--emo-emphasis")).join("|");
    const frozen = labelStates();
    await sleep(140);
    check(labelStates() === frozen, "hidden-tab motion advanced");
    restoreHidden();
    document.dispatchEvent(new Event("visibilitychange"));
    await until(() => !profile.hidden && profile.dataset.stage !== "heading",
      "returning tab finishes and reveals");
    check(realToggle.dataset.state === "paused-interaction", "returning tab resumed schedule");
    realToggle.click();
    await sleep(500);
    let refinedSequence = null;
    if (realToggle.classList.contains("country-presentation-toggle--refined")) {
      const profilePreset = resolveCountryProfilePreset();
      const revealWithNetwork = profilePreset.cycle?.revealWithNetwork === true;
      const labelHost = document.querySelector("#emo-label-host");
      const canvas = document.querySelector("canvas");
      let hit = null;
      labelHost.dataset.hit = "on";
      for (const label of document.querySelectorAll(".emo-label")) {
        const rect = label.getBoundingClientRect();
        const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
        if (x < 0 || x >= innerWidth || y < 180 || y >= innerHeight - 160) continue;
        if (document.elementFromPoint(x, y)?.closest(".emo-label") === label) {
          hit = { x, y }; break;
        }
      }
      delete labelHost.dataset.hit;
      check(hit, "no exposed manual label");
      document.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, clientX: hit.x, clientY: hit.y,
      }));
      canvas.dispatchEvent(new MouseEvent("click", {
        bubbles: true, clientX: hit.x, clientY: hit.y,
      }));
      await sleep(100);
      check(!profile.hidden, "manual country did not open");
      const manual = profile.querySelector("h2").textContent;
      realToggle.click();
      await until(() => realToggle.dataset.state === "flying", "manual-country flight");
      if (profilePreset.cycle?.previewDuringFlight === false) {
        check(profile.hidden, "country profile appeared during rotation-only travel");
      } else {
        check(profile.dataset.stage === "heading" && !profile.hidden,
          "country name missing during flight");
        check(profile.querySelector("h2").textContent === manual, "cycle ignored manual country");
        check(getComputedStyle(profile.querySelector(".country-profile__items")).visibility ===
          "hidden", "indicators shown before network arrival");
      }
      await until(() => realToggle.dataset.state === "building", "refined build");
      const began = performance.now();
      if (revealWithNetwork) {
        check(profile.dataset.stage === "full" && !profile.hidden,
          "profile did not appear with network construction");
        check(getComputedStyle(profile.querySelector(".country-profile__items")).visibility ===
          "visible", "indicators did not appear with network construction");
        check(profile.dataset.revealing === "true", "soft profile reveal did not start");
      }
      await until(() => realToggle.dataset.state === "dwelling", "refined full reveal");
      const buildRevealMs = performance.now() - began;
      check(profile.dataset.stage === "full" && !profile.hidden, "missing full profile");
      check(realToggle.textContent.includes("running"), "running state not visible");
      const scale = Number(new URL(location.href).searchParams.get("cpTimeScale") ?? 1);
      const motionScale = profilePreset.cycle?.motionScale ?? 1.5;
      const revealDelay = revealWithNetwork ? 0 : 500;
      check(Math.abs(buildRevealMs - (1160 * motionScale + revealDelay) * scale) < 100,
        "refined build/reveal duration differs from approved timing");
      realToggle.click();
      await sleep(400);
      realToggle.click();
      await until(() => realToggle.dataset.state === "flying", "saved-cursor flight");
      if (profilePreset.cycle?.previewDuringFlight === false) {
        check(profile.hidden, "country appeared during saved-cursor flight");
        canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 0 }));
        await sleep(100);
        check(profile.hidden, "canceled flight left a country profile visible");
        check(realToggle.textContent.includes("paused"), "paused state not visible");
        realToggle.click();
        await sleep(300);
        realToggle.click();
        await until(() => realToggle.dataset.state === "building", "saved-cursor build");
        check(profile.querySelector("h2").textContent === manual,
          "restart lost its country cursor");
        realToggle.click();
        await sleep(300);
      } else {
        check(profile.querySelector("h2").textContent === manual, "restart lost its country cursor");
        canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 0 }));
        await sleep(100);
        check(profile.hidden, "canceled flight left destination preview visible");
        check(realToggle.textContent.includes("paused"), "paused state not visible");
        realToggle.click();
        await sleep(300);
      }
      refinedSequence = { manual, buildRevealMs,
        headingDuringFlight: profilePreset.cycle?.previewDuringFlight !== false,
        revealWithNetwork,
        canceledPreviewCleared: true, savedCursor: true };
    }
    return { passed: true, completeSegments, fixtureSelections: selections,
      firstFrameCount: 0, finishedBuildAfterInteraction: true, finishedReverse: true,
      visibilityStateFreeze: true, country, refinedSequence };
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error) };
  } finally {
    for (const dispose of cleanup.reverse()) dispose();
  }
})()
