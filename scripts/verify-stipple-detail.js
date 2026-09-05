/* Existing eval.mjs expression: real shaders, bounded detail, and uniform-field visual weight. */
(async () => {
  let globe, controller, renderer, target;
  try {
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const { createEarthStippleGlobe } = await import("/src/globe/earthStippleGlobe.ts");
    const { createStippleDetailController } = await import("/src/globe/stippleDetailController.ts");
    const check = (condition, message) => { if (!condition) throw Error(message); };
    globe = await createEarthStippleGlobe(1, 82000, "/borders/ne_110m_admin_0_countries.geojson?v=4",
      new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), 1, 1);
    // An explicitly synthetic all-land uniform field isolates zoom from data differences.
    globe.points.geometry.getAttribute("aLand").array.fill(1);
    globe.points.geometry.getAttribute("aLand").needsUpdate = true;
    const original = globe.points.geometry.getAttribute("position").array.slice();
    const ownQueries = new Set();
    let queryCount = 0;
    controller = createStippleDetailController({ points: globe.points, material: globe.material,
      radius: 1, isLand: (direction) => {
        queryCount++;
        if (ownQueries.size < 4096) ownQueries.add(direction.toArray().join(","));
        return true;
      } });
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(1);
    renderer.setSize(950, 950, false);
    renderer.setClearColor(0, 0);
    target = new THREE.WebGLRenderTarget(950, 950);
    const scene = new THREE.Scene();
    scene.add(globe.points);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10);
    const settle = (distance, mode) => {
      controller.setMode(mode);
      camera.position.set(0, 0, distance);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      globe.points.updateWorldMatrix(true, false);
      for (let frame = 0; frame < 140; frame++) controller.update(camera, 950, 950, 1 / 60);
      return controller.stats();
    };
    const pixels = new Uint8Array(950 * 950 * 4);
    const weight = () => {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, 950, 950, pixels);
      let alpha = 0;
      for (let i = 3; i < pixels.length; i += 4) alpha += pixels[i];
      return alpha;
    };
    const far = settle(2.35, "split2");
    check(far.descendantCount === 0, "far view unnecessarily refines the control");
    const farWeight = weight();
    settle(1.35, "regrow");
    const controlWeight = weight();
    const rounds = [];
    for (const mode of ["split1", "split2"]) {
      const stats = settle(1.35, mode);
      check(stats.descendantCount > 0 && stats.descendantCount <= 131072, "descendant budget failed");
      check(stats.additionalBytes <= 64 * 1024 * 1024, "detail exceeds the initial extra-resource budget");
      const ratio = weight() / controlWeight;
      check(Math.abs(1 - ratio) < 0.04, "uniform-field brightness changed: " + ratio);
      const children = globe.points.children.filter((child) => child.isPoints);
      const submitted = children.reduce((sum, child) => sum + child.geometry.drawRange.count, 0);
      check(submitted === stats.descendantCount, "draw range includes inactive descendants");
      rounds.push({ mode, ...stats, submitted, visualWeightRatio: ratio });
      const merged = settle(2.35, mode);
      check(merged.descendantCount === 0 && merged.familyCount === 0, "merge stranded a family");
    }
    for (let cycle = 0; cycle < 3; cycle++) {
      settle(1.35, "split2");
      const stats = settle(2.35, "split2");
      check(stats.descendantCount === 0, "repeated zoom leaked descendants");
    }
    controller.setMode("split2");
    camera.position.z = 1.35;
    camera.updateMatrixWorld();
    const transitionRatios = [];
    let sawPartial = false;
    for (let frame = 0; frame < 45; frame++) {
      controller.update(camera, 950, 950, 1 / 60);
      sawPartial ||= controller.stats().transitionCount > 0;
      if (frame % 5 === 0) transitionRatios.push(weight() / controlWeight);
    }
    check(sawPartial, "motion check never observed an active split");
    camera.position.z = 2.35;
    camera.updateMatrixWorld();
    for (let frame = 0; frame < 25; frame++) {
      controller.update(camera, 950, 950, 1 / 60);
      if (frame % 5 === 0) transitionRatios.push(weight() / farWeight);
    }
    check(transitionRatios.every((ratio) => Math.abs(1 - ratio) < 0.04),
      "uniform-field split/merge pulse: " + transitionRatios.join(","));
    const fixed = settle(1.35, "fixed");
    check(fixed.descendantCount === 0, "fixed control retains child draws");
    check(original.every((value, i) => value === globe.points.geometry.getAttribute("position").array[i]),
      "detail changed original root positions");
    check(globe.material.uniforms.uDetailMode.value === 0, "fixed shader path not restored");
    return { passed: true, far, rounds, fixed, transitionRatios,
      ownCoordinateQueries: ownQueries.size, queryCount,
      originalRootPositionsPreserved: true, context: renderer.getContext().getParameter(
        renderer.getContext().VERSION) };
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error) };
  } finally {
    controller?.dispose(); globe?.dispose(); target?.dispose(); renderer?.dispose();
    renderer?.forceContextLoss();
  }
})()
