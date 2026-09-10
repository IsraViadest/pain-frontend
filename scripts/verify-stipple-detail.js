/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/* Existing eval.mjs expression: real shaders, bounded detail, and uniform-field visual weight. */
(async () => {
  let globe, controller, renderer, target, gl;
  const restore = [];
  const liveBuffers = new Map();
  let bufferCreations = 0, bufferDeletions = 0;
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
    gl = renderer.getContext();
    const patch = (name, replacement) => {
      const descriptor = Object.getOwnPropertyDescriptor(gl, name);
      Object.defineProperty(gl, name, { configurable: true, writable: true, value: replacement });
      restore.push(() => descriptor ? Object.defineProperty(gl, name, descriptor) : delete gl[name]);
    };
    const createBuffer = gl.createBuffer;
    patch("createBuffer", function (...args) {
      const buffer = Reflect.apply(createBuffer, this, args);
      if (buffer) { liveBuffers.set(buffer, 0); bufferCreations++; }
      return buffer;
    });
    const bufferData = gl.bufferData;
    patch("bufferData", function (...args) {
      const result = Reflect.apply(bufferData, this, args);
      const binding = args[0] === gl.ARRAY_BUFFER ? gl.ARRAY_BUFFER_BINDING :
        args[0] === gl.ELEMENT_ARRAY_BUFFER ? gl.ELEMENT_ARRAY_BUFFER_BINDING : null;
      if (binding !== null) {
        const buffer = gl.getParameter(binding);
        if (liveBuffers.has(buffer)) liveBuffers.set(buffer, gl.getBufferParameter(args[0], gl.BUFFER_SIZE));
      }
      return result;
    });
    const deleteBuffer = gl.deleteBuffer;
    patch("deleteBuffer", function (buffer) {
      const result = Reflect.apply(deleteBuffer, this, [buffer]);
      if (liveBuffers.delete(buffer)) bufferDeletions++;
      return result;
    });
    const bufferState = () => ({ count: liveBuffers.size,
      bytes: [...liveBuffers.values()].reduce((sum, value) => sum + value, 0),
      created: bufferCreations, deleted: bufferDeletions });
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
      const error = gl.getError();
      check(error === gl.NO_ERROR && !gl.isContextLost(), "WebGL error in stipple fixture: " + error);
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

    const resizeStable = settle(1.35, "split2");
    check(resizeStable.transitionCount === 0 && resizeStable.descendantCount > 32,
      "pool resize fixture did not reach a stable refined state");
    weight();
    const stablePixels = pixels.slice();
    const stableIds = resizeStable.descendantIdSum;
    const fitting = Math.max(4, Math.ceil(resizeStable.descendantCount / 4) * 4);
    const grown = Math.min(131072, Math.max(fitting + 4, fitting * 2));
    check(fitting < grown, "pool resize fixture has no growth headroom");
    const resizeSteps = [];
    const childGeometry = () => globe.points.children.find((child) => child.isPoints).geometry;
    const childBufferBytes = () => Object.values(childGeometry().attributes)
      .reduce((sum, attribute) => sum + attribute.array.byteLength, 0);
    const maximumPixelDifference = () => {
      let maximum = 0;
      for (let i = 0; i < pixels.length; i++) maximum = Math.max(maximum, Math.abs(pixels[i] - stablePixels[i]));
      return maximum;
    };
    for (const next of [fitting, grown, fitting]) {
      const previousCapacity = controller.stats().capacityLimit;
      const before = bufferState();
      const oldHandles = [...liveBuffers.keys()];
      const expectedOldBytes = childBufferBytes();
      const expectedBuffers = Object.keys(childGeometry().attributes).length;
      controller.setCapacity(next);
      const released = bufferState();
      const retiredHandles = oldHandles.filter((buffer) => !liveBuffers.has(buffer));
      check(before.bytes - released.bytes === expectedOldBytes && retiredHandles.length === expectedBuffers,
        "resize did not delete exactly the old child VBOs");
      check(retiredHandles.every((buffer) => !gl.isBuffer(buffer)), "old child VBO remains a valid GL buffer");
      // No controller update or time advance: copied geometry/fades must produce identical pixels.
      weight();
      const after = bufferState();
      const pixelDifference = maximumPixelDifference();
      check(pixelDifference === 0, "growth/fitting shrink changed pixels without time advance: " + pixelDifference);
      check(after.bytes - released.bytes === childBufferBytes() && after.count === before.count,
        "resize did not allocate exactly the replacement child VBOs");
      check(after.created - before.created === expectedBuffers && after.deleted - before.deleted === expectedBuffers,
        "child VBO allocation/deletion counts disagree");
      check(controller.stats().descendantIdSum === stableIds && controller.stats().descendantCount === resizeStable.descendantCount,
        "resize changed live child identity");
      resizeSteps.push({ from: previousCapacity, to: next, pixelDifference,
        deletedBuffers: after.deleted - before.deleted, createdBuffers: after.created - before.created,
        releasedChildBytes: expectedOldBytes, replacementChildBytes: childBufferBytes(), liveBufferBytes: after.bytes });
    }
    const crowdedTarget = Math.max(4, Math.floor(resizeStable.descendantCount / 8) * 4);
    check(crowdedTarget < resizeStable.descendantCount, "crowded shrink is not crowded");
    const beforeCrowded = bufferState();
    const crowdedOldBytes = childBufferBytes();
    const crowdedOldHandles = [...liveBuffers.keys()];
    controller.setCapacity(crowdedTarget);
    let shrinkFrames = 0;
    while (controller.stats().capacityLimit !== crowdedTarget && shrinkFrames < 120) {
      controller.update(camera, 950, 950, 1 / 60);
      const ratio = weight() / controlWeight;
      check(Math.abs(1 - ratio) < 0.04, "crowded shrink changed uniform-field visual weight: " + ratio);
      shrinkFrames++;
    }
    const shrunk = controller.stats();
    const afterCrowded = bufferState();
    const crowdedRetired = crowdedOldHandles.filter((buffer) => !liveBuffers.has(buffer));
    check(shrunk.capacityLimit === crowdedTarget && shrunk.targetCapacity === crowdedTarget &&
      shrunk.descendantCount <= crowdedTarget && shrunk.pendingRootRetirements === 0,
    "crowded GPU shrink did not finish within cap");
    check(childGeometry().drawRange.count === shrunk.descendantCount, "crowded draw range includes expired records");
    check(crowdedRetired.length === Object.keys(childGeometry().attributes).length &&
      crowdedRetired.every((buffer) => !gl.isBuffer(buffer)), "crowded shrink retained old child VBOs");
    check(afterCrowded.bytes - beforeCrowded.bytes === childBufferBytes() - crowdedOldBytes,
      "crowded shrink live GPU byte delta is wrong");
    const gpuResize = { scope: "Native WebGL buffer objects and BUFFER_SIZE bytes; excludes driver-private overhead.",
      stableDescendants: resizeStable.descendantCount, steps: resizeSteps,
      crowded: { target: crowdedTarget, frames: shrinkFrames, descendants: shrunk.descendantCount,
        deletedBuffers: afterCrowded.deleted - beforeCrowded.deleted,
        createdBuffers: afterCrowded.created - beforeCrowded.created,
        liveBufferByteDelta: afterCrowded.bytes - beforeCrowded.bytes } };
    const fixed = settle(1.35, "fixed");
    check(fixed.descendantCount === 0, "fixed control retains child draws");
    check(original.every((value, i) => value === globe.points.geometry.getAttribute("position").array[i]),
      "detail changed original root positions");
    check(globe.material.uniforms.uDetailMode.value === 0, "fixed shader path not restored");
    renderer.setRenderTarget(null);
    scene.remove(globe.points);
    controller.dispose(); controller = null;
    globe.dispose(); globe = null;
    target.dispose(); target = null;
    renderer.render(scene, camera);
    const disposal = { ...bufferState(), textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries };
    check(disposal.count === 0 && disposal.bytes === 0 && disposal.created === disposal.deleted &&
      disposal.textures === 0 && disposal.geometries === 0, "actual GPU fixture resources leaked after disposal");
    return { passed: true, far, rounds, fixed, transitionRatios, gpuResize, disposal,
      ownCoordinateQueries: ownQueries.size, queryCount,
      originalRootPositionsPreserved: true, context: renderer.getContext().getParameter(
        renderer.getContext().VERSION) };
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error) };
  } finally {
    controller?.dispose(); globe?.dispose(); target?.dispose(); renderer?.dispose();
    renderer?.forceContextLoss();
    for (const undo of restore.reverse()) undo();
    liveBuffers.clear();
  }
})()
