/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/*
 * Live Vite browser expression for artifacts/emo-views/eval.mjs.
 * Use a fresh page with cp=1, cpPreset=v46-dots_water-depth, freeze=1, cam=20,78,2.35.
 * Pipe the JSON result to jq -e '.passed == true'. No images are returned or saved.
 */
(async () => {
  const check = (value, message) => { if (!value) throw Error(message); };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, description) => {
    const until = performance.now() + 15000;
    while (!predicate()) {
      check(performance.now() < until, "Missing fixture: " + description);
      await wait(50);
    }
  };
  const activeLayer = () => document.querySelector("button[data-layer].blob-button--active")?.dataset.layer;
  const layerButton = (layer) => [...document.querySelectorAll("button[data-layer]")]
    .find((button) => button.dataset.layer === layer);
  const selectedCountry = () => document.querySelector("#country-profile")?.dataset.country ?? "";
  const rows = [];
  const originalLayer = activeLayer();
  let prototype, originalSetter, globe, originalSpin, quad, result;
  let touchedSelection = false;
  function clickCanvas(x, y) {
    document.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0,
    }));
    globe.renderer.domElement.dispatchEvent(new MouseEvent("click", {
      bubbles: true, clientX: x, clientY: y, button: 0,
    }));
  }
  async function clearSelection() {
    if (!selectedCountry()) return;
    const rect = globe.renderer.domElement.getBoundingClientRect();
    const corner = [[rect.left + 1, rect.top + 1], [rect.right - 1, rect.top + 1],
      [rect.left + 1, rect.bottom - 1], [rect.right - 1, rect.bottom - 1]]
      .find(([x, y]) => !globe.pickSurfaceLatLng(x, y));
    check(corner, "Missing fixture: no empty canvas corner to clear selection");
    clickCanvas(...corner);
    await waitFor(() => !selectedCountry(), "selection did not clear");
    await waitFor(() => globe.earthContent.children.filter((object) => object.isMesh &&
      object.geometry === globe.getCountrySurfaceGeometry() && object !== globe.choroplethShell)
      .every((object) => !object.visible), "selection retreat did not finish");
  }
  try {
    check(originalLayer && selectedCountry() === "", "Missing fixture: fresh unselected country profile");
    check(document.visibilityState === "visible", "Missing fixture: visible page");
    const moduleUrl = performance.getEntriesByType("resource").map((entry) => entry.name)
      .find((name) => /\/src\/globe\/GlobeView(?:\.ts)?(?:\?|$)/.test(name));
    check(moduleUrl, "Missing fixture: loaded Vite GlobeView module");
    const { GlobeView } = await import(moduleUrl);
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const { latLngToVector3 } = await import("/src/globe/latLng.ts");
    prototype = GlobeView.prototype;
    originalSetter = prototype.setScarContourStyle;
    prototype.setScarContourStyle = function (...args) {
      globe = this;
      return Reflect.apply(originalSetter, this, args);
    };
    // Clicking the already-active physical layer is a no-op, so first activate all-pain.
    const captureLayer = originalLayer === "physpain" ? "all-pain" : "physpain";
    check(layerButton(captureLayer), "Missing fixture: layer button " + captureLayer);
    layerButton(captureLayer).click();
    await waitFor(() => globe, "layer update did not reach the contour setter");
    originalSpin = globe.isAutoSpinEnabled();
    globe.setAutoSpinEnabled(false);

    const renderer = globe.renderer, gl = renderer.getContext();
    check(gl.getContextAttributes().stencil, "Missing fixture: live stencil buffer");
    check(!gl.isContextLost(), "Missing fixture: healthy WebGL context");
    quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: "void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: "void main() { gl_FragColor = vec4(1.0); }",
      depthTest: false, depthWrite: false, blending: THREE.NoBlending,
      stencilWrite: true, stencilWriteMask: 0, stencilFuncMask: 2,
      stencilRef: 2, stencilFunc: THREE.EqualStencilFunc,
    }));
    quad.frustumCulled = false;
    const maskScene = new THREE.Scene();
    maskScene.add(quad);
    const maskCamera = new THREE.Camera();
    function selectionObjects() {
      const meshes = globe.earthContent.children.filter((object) => object.isMesh &&
        object.geometry === globe.getCountrySurfaceGeometry() && object !== globe.choroplethShell);
      const fill = meshes.filter((object) => object.material.colorWrite && !object.material.depthWrite);
      const depth = meshes.filter((object) => !object.material.colorWrite && object.material.depthWrite);
      const borders = globe.earthContent.getObjectByName("emo-country-selection-borders");
      check(fill.length === 1 && depth.length === 1 && borders,
        "Missing fixture: unique production selection fill, depth, and border objects");
      return { fill: fill[0], depth: depth[0], borders };
    }
    function measure(layer, contour = false) {
      const dots = contour ? globe.earthContent.getObjectByName("scar-contours") : globe.pointsStipple;
      const material = dots?.material, bit = contour ? 4 : 2;
      check(dots?.visible && material?.uniforms.uScarMap,
        "Missing fixture: visible production dots or contours");
      quad.material.stencilFuncMask = quad.material.stencilRef = bit;
      const { fill, depth, borders } = selectionObjects();
      check(fill.visible && fill.material.map && depth.visible && borders.children.some((line) => line.visible),
        "Missing fixture: selected fill, depth, or outlines are absent");
      check(gl.getError() === gl.NO_ERROR && renderer.getRenderTarget() === null,
        "Missing fixture: clean default framebuffer");
      const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight, pixels = width * height;
      check(pixels > 0, "Missing fixture: nonempty drawing buffer");
      const visibility = new Map();
      const kept = new Set([dots, globe.pointsStipple, globe.globe, globe.choroplethShell,
        fill, depth, ...borders.children]);
      globe.scene.traverse((object) => {
        if (!object.geometry || !object.material) return;
        visibility.set(object, object.visible);
        if (!kept.has(object)) object.visible = false;
      });
      const stencilKeys = ["stencilWrite", "stencilWriteMask", "stencilFunc", "stencilRef",
        "stencilFuncMask", "stencilFail", "stencilZFail", "stencilZPass"];
      const oldStencil = Object.fromEntries(stencilKeys.map((key) => [key, material[key]]));
      const color = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
      const autoClear = renderer.autoClear;
      const instrumented = !material.stencilWrite;
      const originalBorderVisibility = borders.visible;
      try {
        // On the old implementation only, observe surviving fragments without changing RGB/depth.
        if (instrumented) Object.assign(material, {
          stencilWrite: true, stencilWriteMask: bit, stencilFuncMask: bit,
          stencilRef: bit, stencilFunc: THREE.AlwaysStencilFunc,
          stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp,
          stencilZPass: THREE.ReplaceStencilOp,
        });
        check((material.stencilWriteMask & bit) && (material.stencilRef & bit) &&
          material.stencilZPass === THREE.ReplaceStencilOp,
        "Missing fixture: dot stencil does not preserve the observation bit");
        const scratch = new Uint8Array(pixels * 4);
        function capture(selected) {
          fill.visible = depth.visible = borders.visible = selected;
          renderer.setClearColor(color, alpha);
          renderer.autoClear = true;
          renderer.render(globe.scene, globe.camera);
          const rgb = new Uint8Array(pixels * 4);
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, rgb);
          // Color-only clear retains the dot stencil and the production scene depth.
          renderer.autoClear = false;
          renderer.setClearColor(0x000000, 1);
          renderer.clear(true, false, false);
          renderer.render(maskScene, maskCamera);
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
          const mask = new Uint8Array(pixels);
          for (let p = 0; p < pixels; p++) mask[p] = scratch[p * 4];
          check(gl.getError() === gl.NO_ERROR, "WebGL error during dot capture");
          return { rgb, mask };
        }
        // No await or tick between captures: camera, uniforms, and animation are identical.
        const hidden = capture(false), selected = capture(true);
        let hiddenCoverage = 0, selectedCoverage = 0, coverageChanged = 0, lostPixels = 0;
        let gainedPixels = 0, corePixels = 0, coreRgbChanged = 0, maxCoreRgbDelta = 0;
        let selectionChangedPixels = 0, hiddenSamples = 0, selectedSamples = 0;
        for (let p = 0; p < pixels; p++) {
          const a = hidden.mask[p], b = selected.mask[p];
          hiddenCoverage += Number(a > 0); selectedCoverage += Number(b > 0);
          hiddenSamples += a / 255; selectedSamples += b / 255;
          coverageChanged += Number(a !== b);
          lostPixels += Number(a > 0 && b === 0); gainedPixels += Number(a === 0 && b > 0);
          const i = p * 4;
          const delta = Math.max(Math.abs(hidden.rgb[i] - selected.rgb[i]),
            Math.abs(hidden.rgb[i + 1] - selected.rgb[i + 1]),
            Math.abs(hidden.rgb[i + 2] - selected.rgb[i + 2]));
          selectionChangedPixels += Number(delta > 0);
          // Partial MSAA pixels also contain background, which the country wash should change.
          if (a === 255 && b === 255) {
            corePixels++; coreRgbChanged += Number(delta > 0);
            maxCoreRgbDelta = Math.max(maxCoreRgbDelta, delta);
          }
        }
        const errors = [];
        if (!hiddenCoverage || !corePixels) errors.push("Missing fixture: measurable full-coverage dot pixels");
        if (!selectionChangedPixels) errors.push("Missing fixture: selection has no visible effect");
        if (coverageChanged) errors.push("Selection changed " + (contour ? "contour" : "dot") + " coverage");
        if (!contour && coreRgbChanged) errors.push("Selection changed fully covered dot RGB");
        return { layer, subject: contour ? "contours" : "dots", distance: globe.camera.position.length(),
          country: selectedCountry(), width, height, instrumentedDotStencil: instrumented,
          pointCount: dots.geometry.getAttribute("position").count,
          orders: { dots: dots.renderOrder, depth: depth.renderOrder, fill: fill.renderOrder,
            borders: borders.children.map((line) => line.renderOrder) },
          hiddenCoverage, selectedCoverage, hiddenSamples, selectedSamples,
          coverageChanged, lostPixels, gainedPixels, corePixels, coreRgbChanged, maxCoreRgbDelta,
          selectionChangedPixels, errors, passed: errors.length === 0 };
      } finally {
        for (const [object, visible] of visibility) object.visible = visible;
        borders.visible = originalBorderVisibility;
        Object.assign(material, oldStencil);
        renderer.setClearColor(color, alpha);
        renderer.autoClear = autoClear;
        renderer.render(globe.scene, globe.camera);
      }
    }
    for (const layer of ["emopain", "envpain", "physpain", "socioecopain", "all-pain"]) {
      await clearSelection();
      layerButton(layer).click();
      await waitFor(() => activeLayer() === layer && globe.pointsStipple?.visible &&
        (layer === "all-pain" ? globe.showAllLayersMode : globe.currentLayerId === layer),
      "production layer " + layer);
      await wait(2200);
      const label = layer === "all-pain" || layer === "emopain"
        ? document.querySelector('.emo-label[data-iso3="IND"]') : null;
      const labelRect = label?.getBoundingClientRect();
      let x, y, route;
      if (labelRect?.width > 0 && getComputedStyle(label).visibility !== "hidden" &&
        Number(getComputedStyle(label).opacity) > 0 && labelRect.left >= 0 && labelRect.right <= innerWidth &&
        labelRect.top >= 0 && labelRect.bottom <= innerHeight) {
        x = labelRect.left + labelRect.width / 2; y = labelRect.top + labelRect.height / 2; route = "label";
      } else {
        check(globe.isCountryOriginVisible(20, 78), "Missing fixture: camera does not expose India");
        const position = latLngToVector3(20, 78, 1);
        globe.earthContent.localToWorld(position); position.project(globe.camera);
        const rect = renderer.domElement.getBoundingClientRect();
        x = rect.left + (position.x + 1) * rect.width / 2;
        y = rect.top + (1 - position.y) * rect.height / 2; route = "surface";
      }
      touchedSelection = true;
      clickCanvas(x, y);
      await waitFor(() => selectedCountry() === "IND", "India selection through " + route);
      await wait(2500);
      await waitFor(() => {
        const { fill, depth, borders } = selectionObjects();
        return fill.visible && fill.material.map && depth.visible && borders.children.some(line => line.visible);
      }, "painted India selection in " + layer);
      rows.push({ ...measure(layer), selectionRoute: route });
      if (layer === "physpain" || layer === "all-pain") {
        rows.push(measure(layer, true));
        const position = globe.camera.position.clone();
        try {
          globe.camera.position.setLength(1.6);
          globe.camera.updateMatrixWorld();
          rows.push(measure(layer, true));
        } finally {
          globe.camera.position.copy(position);
          globe.camera.updateMatrixWorld();
        }
      }
    }
    result = { passed: rows.length === 9 && rows.every((row) => row.passed), rows,
      scope: "Production dots, contours and country fill/depth/borders; unrelated drawables hidden. " +
        "Exact stencil coverage and dot-core RGB in synchronous renders; contour coverage at two distances." };
  } catch (error) { result = { passed: false, error: String(error.stack ?? error), rows }; }
  finally {
    const cleanupErrors = [];
    try {
      if (touchedSelection) await clearSelection();
      if (originalLayer && activeLayer() !== originalLayer) {
        layerButton(originalLayer).click();
        await waitFor(() => activeLayer() === originalLayer, "original layer restoration");
        await wait(500);
      }
    } catch (error) { cleanupErrors.push(String(error)); }
    if (globe && originalSpin !== undefined) globe.setAutoSpinEnabled(originalSpin);
    if (prototype && originalSetter) prototype.setScarContourStyle = originalSetter;
    quad?.geometry.dispose(); quad?.material.dispose();
    result.cleanup = { restored: cleanupErrors.length === 0, errors: cleanupErrors };
    if (cleanupErrors.length) result.passed = false;
  }
  return result;
})()
