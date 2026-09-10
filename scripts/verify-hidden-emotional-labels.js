/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/*
 * Vite browser expression for artifacts/emo-views/eval.mjs. No WebGL context is created.
 */
(async () => {
  const cleanup = [];
  try {
    const check = (value, message) => { if (!value) throw Error(message); };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    await import("/src/emo/emo.css");
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const { createEmoLabelLayer } = await import("/src/emo/labelLayer.ts");
    const { createEmoSelectionMotion } = await import("/src/emo/selectionMotion.ts");
    const { DEFAULT_EMO_PARAMS } = await import("/src/emo/viewParams.ts");
    const { latLngToVector3 } = await import("/src/globe/latLng.ts");
    const response = await fetch("/emo/combined-v2/emo-data.json");
    check(response.ok, "Emotional fixture data did not load");
    const data = await response.json();
    const params = { ...DEFAULT_EMO_PARAMS, clickMode: "selectNetwork", selectionEmphasis: "bold",
      selectionMotionMs: 20, fontPxFar: 13, fontPxNear: 25, declutterMode: "priority", density: 0 };
    const css = document.createElement("style");
    css.textContent = ".hidden-label-verification .emo-label div { font-family: var(--test-font) !important; }";
    document.head.append(css);
    cleanup.push(() => css.remove());
    const make = async () => {
      const host = document.createElement("div");
      host.className = "emo-label-host hidden-label-verification";
      host.style.cssText = "inset:0 auto auto 0;width:1200px;height:800px;opacity:0;--test-font:serif";
      document.body.append(host);
      cleanup.push(() => host.remove());
      const globe = { camera: new THREE.PerspectiveCamera(45, 1.5, 0.1, 100),
        earthContent: new THREE.Group(), renderer: { domElement: host } };
      globe.camera.position.copy(latLngToVector3(20, 78, 2.35));
      globe.camera.lookAt(0, 0, 0);
      globe.camera.updateMatrixWorld();
      const motion = createEmoSelectionMotion({ data, params });
      let selections = 0;
      const layer = await createEmoLabelLayer({ host, globe, data, params, motion,
        onSelect: (selection) => { selections++; motion.setSelection(selection?.cat ?? null); } });
      cleanup.push(() => layer.destroy());
      return { host, globe, motion, layer, selections: () => selections };
    };
    const candidate = await make();
    const { host, globe, motion, layer } = candidate;
    const labels = [...host.querySelectorAll(".emo-label")];
    await document.fonts.ready;
    let covered = false;
    layer.setOcclusionRects(() => covered ? [new DOMRect(-10000, -10000, 20000, 20000)] : []);
    layer.update();
    layer.selectCountry("IND");
    await sleep(60);
    motion.tick();
    layer.update();
    check(labels.some((el) => el.classList.contains("emo-label--emphasis")), "Selection fixture never grew");
    covered = true;
    await sleep(120);
    layer.update();
    await sleep(200);
    layer.update();
    const uncovered = labels.filter((el) => getComputedStyle(el).visibility !== "hidden")
      .map((el) => ({ iso3: el.dataset.iso3, style: el.style.cssText }));
    check(uncovered.length === 0, "Occlusion fixture did not hide all words: " + JSON.stringify({
      host: host.getBoundingClientRect().toJSON(), uncovered }));

    host.hidden = true;
    layer.clearSelection();
    await sleep(60);
    const observer = new MutationObserver(() => {});
    observer.observe(host, { attributes: true, subtree: true, childList: true, characterData: true });
    const project = THREE.Vector3.prototype.project;
    const measure = HTMLElement.prototype.getBoundingClientRect;
    let projections = 0, measurements = 0;
    THREE.Vector3.prototype.project = function (...args) { projections++; return project.apply(this, args); };
    HTMLElement.prototype.getBoundingClientRect = function (...args) {
      measurements++; return measure.apply(this, args);
    };
    let mutations, visibleProjections;
    try {
      host.hidden = false;
      layer.update();
      visibleProjections = projections;
      check(visibleProjections > 0, "Projection counter did not observe the visible label layer");
      host.hidden = true;
      projections = measurements = 0;
      observer.takeRecords();
      for (let i = 0; i < 3; i++) {
        motion.tick();
        layer.update();
        check(layer.countryAtPoint(20, 20) === null, "Hidden labels accepted a hit");
      }
      mutations = observer.takeRecords().length;
    } finally {
      THREE.Vector3.prototype.project = project;
      HTMLElement.prototype.getBoundingClientRect = measure;
      observer.disconnect();
    }
    check(projections === 0 && measurements === 0 && mutations === 0,
      `Hidden presentation work: ${projections} projections, ${measurements} measurements, ${mutations} mutations`);
    check(candidate.selections() === 2 && motion.emphasisOf(data.countries.IND.cat) === 0,
      "Selection clear or shared motion did not finish while hidden");

    // Change geometry and actual font metrics while hidden, then inspect one update only.
    const changeView = (fixture) => {
      fixture.host.style.width = "900px";
      fixture.host.style.height = "600px";
      fixture.host.style.setProperty("--test-font", "monospace");
      fixture.globe.camera.position.multiplyScalar(0.85);
      fixture.globe.camera.aspect = 1.5;
      fixture.globe.camera.updateProjectionMatrix();
      fixture.globe.camera.updateMatrixWorld();
      fixture.globe.earthContent.rotation.y = 0.35;
    };
    const snapshot = (root) => [...root.querySelectorAll(".emo-label")]
      .filter((el) => el.style.visibility === "visible" && Number(el.style.opacity) > 0.01)
      .map((el) => ({ iso3: el.dataset.iso3, transform: el.style.transform, opacity: el.style.opacity,
        emphasis: el.classList.contains("emo-label--emphasis"),
        font: getComputedStyle(el.querySelector(".emo-label__native")).fontSize,
        width: el.getBoundingClientRect().width }));
    covered = false;
    changeView(candidate);
    document.fonts.dispatchEvent(new Event("loadingdone"));
    host.hidden = false;
    layer.update();
    const firstVisible = snapshot(host);
    check(firstVisible.length > 0, "First visible update retained the hidden layout");
    check(firstVisible.every((el) => !el.emphasis), "First visible update retained selection emphasis");

    // A newly created, settled layer supplies the expected visible set and screen geometry.
    const reference = await make();
    changeView(reference);
    reference.layer.setOcclusionRects(() => []);
    reference.layer.update();
    await sleep(200);
    reference.layer.update();
    check(JSON.stringify(firstVisible) === JSON.stringify(snapshot(reference.host)),
      "First visible update differs from a fresh layout after zoom, rotation, resize or font change");
    return { passed: true, hiddenFrames: 3, visibleProjections, projections, measurements, mutations,
      sharedMotionCleared: true, firstVisibleLabels: firstVisible.length, freshLayoutMatched: true };
  } catch (error) {
    return { passed: false, error: String(error.stack ?? error) };
  } finally {
    for (const dispose of cleanup.reverse()) dispose();
  }
})()
