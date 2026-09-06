/* Real WebGL: field registration, hidden-surface occlusion, sampling, and owned resources. */
(async () => {
  let renderer, atmosphere;
  const owned = [];
  const results = [];
  try {
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const { createEnvironmentalAtmosphere } = await import("/src/globe/environmentalAtmosphere.ts");
    const check = (condition, message) => { if (!condition) throw Error(message); };
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setSize(320, 320, false);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0, 0);
    const scene = new THREE.Scene(), earth = new THREE.Group();
    scene.add(earth);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10);
    camera.position.z = 2.35;
    const surface = new THREE.SphereGeometry(1, 96, 64);
    owned.push(surface);
    const originalPositions = surface.attributes.position.array.slice();
    const setSurface = (radiusAtY) => {
      const positions = surface.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const j = i * 3, radius = radiusAtY(originalPositions[j + 1]);
        positions.setXYZ(i, originalPositions[j] * radius,
          originalPositions[j + 1] * radius, originalPositions[j + 2] * radius);
      }
      positions.needsUpdate = true;
      surface.computeBoundingSphere();
    };
    const patch = (latitude, alpha) => {
      const w = 128, h = 64, bytes = new Uint8Array(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const lng = (x + 0.5) / w * 360 - 180, lat = 90 - (y + 0.5) / h * 180;
        if (((lng + 90) / 18) ** 2 + ((lat - latitude) / 13) ** 2 > 1) continue;
        const i = (y * w + x) * 4;
        bytes[i + 2] = 255; // Deliberately blue RGB: prototypes must take color from their palette.
        bytes[i + 3] = alpha;
      }
      const texture = new THREE.DataTexture(bytes, w, h, THREE.RGBAFormat);
      texture.flipY = true;
      texture.wrapS = THREE.RepeatWrapping;
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.colorSpace = THREE.NoColorSpace;
      texture.needsUpdate = true;
      owned.push(texture);
      return texture;
    };
    const temperature = patch(30, 115), co2 = patch(-30, 255);
    const zero = patch(0, 0), equator = patch(0, 255);
    const originalTemperature = temperature.image.data.slice();
    const pixels = new Uint8Array(320 * 320 * 4);
    const read = (steps = 32) => {
      atmosphere.prepare(steps, 0.5);
      renderer.render(scene, camera);
      renderer.getContext().readPixels(0, 0, 320, 320,
        renderer.getContext().RGBA, renderer.getContext().UNSIGNED_BYTE, pixels);
      const sum = { alpha: 0, upper: 0, lower: 0, red: 0, green: 0, blue: 0,
        redRadius: 0, greenRadius: 0, maxAlpha: 0 };
      for (let y = 0; y < 320; y++) for (let x = 0; x < 320; x++) {
        const i = (y * 320 + x) * 4, alpha = pixels[i + 3];
        sum.alpha += alpha;
        sum[y >= 160 ? "upper" : "lower"] += alpha;
        sum.red += pixels[i]; sum.green += pixels[i + 1]; sum.blue += pixels[i + 2];
        sum.maxAlpha = Math.max(sum.maxAlpha, alpha);
        const radius = Math.hypot(x - 160, y - 160);
        if (alpha > 4 && pixels[i] > pixels[i + 1] * 1.08) sum.redRadius = Math.max(sum.redRadius, radius);
        if (alpha > 4 && pixels[i + 1] > pixels[i] * 1.08) sum.greenRadius = Math.max(sum.greenRadius, radius);
      }
      return { ...sum, pixels: [[160, 160], [160, 280], [160, 40]].map(([x, y]) => ({
        x, y, rgba: Array.from(pixels.slice((y * 320 + x) * 4, (y * 320 + x) * 4 + 4)),
      })) };
    };
    for (const mode of ["flat", "mantle", "cloudlets", "volume", "volume-strong",
      "volume-separated", "volume-strong-separated", "volume-near-opaque-separated",
      "volume-very-strong-separated", "volume-log-separated",
      "volume-log-near-opaque-separated"]) {
      const isVolume = mode.startsWith("volume");
      const result = { mode };
      results.push(result);
      atmosphere = createEnvironmentalAtmosphere({ mode, renderer, camera, earthContent: earth,
        surfaceGeometry: surface });
      atmosphere.setFields(zero, zero);
      result.zeroFields = read();
      check(result.zeroFields.alpha === 0, mode + ": zero-valued non-null fields manufactured density");
      atmosphere.setFields(temperature, null);
      const north = read();
      check(north.alpha > 0 && north.upper > north.lower * 8, mode + ": north field misplaced");
      check(north.red > north.green * 2 && north.red > north.blue * 2, mode + ": temperature is not coral");
      const versions = result.textureVersions = { initial: { version: temperature.version, ...north } };
      temperature.image.data.fill(0);
      temperature.needsUpdate = true;
      atmosphere.setFields(temperature, null);
      versions.cleared = { version: temperature.version, ...read() };
      check(versions.cleared.alpha === 0, mode + ": clearing the same texture left stale density");
      temperature.image.data.set(originalTemperature);
      temperature.needsUpdate = true;
      atmosphere.setFields(temperature, null);
      versions.restored = { version: temperature.version, ...read() };
      check(versions.restored.alpha === north.alpha && versions.restored.red === north.red,
        mode + ": restoring the same texture did not restore its pixels");
      atmosphere.setFields(null, co2);
      const south = read();
      check(south.alpha > 0 && south.lower > south.upper * 8, mode + ": south field misplaced");
      check(south.green > south.red * 1.3, mode + ": CO2 is not green");
      atmosphere.setFields(temperature, co2);
      const combined = read();
      earth.rotation.y = Math.PI;
      const back = read();
      check(back.alpha === 0, mode + ": far-side field visible through hidden globe");
      earth.rotation.y = 0;
      setSurface((y) => y > 0 ? 1.2 : 0.8);
      const deformed = read();
      check(deformed.upper === 0 && deformed.lower > 0, mode + ": surface depth is stale or inverted");
      setSurface(() => 1.2);
      const enclosed = read();
      check(enclosed.alpha === 0, mode + ": air inside hidden surface did not clip");
      setSurface(() => 1);
      const qualities = isVolume ? [16, 32, 48].map((steps) => ({ steps, ...read(steps) })) : [];
      if (qualities.length) {
        const reference = qualities[2].alpha;
        check(qualities.every((q) => Math.abs(q.alpha / reference - 1) < 0.12),
          "sample count substantially changed volume strength");
      }
      let separation = null;
      if (mode.includes("separated")) {
        atmosphere.setFields(equator, equator);
        separation = read(48);
        check(separation.red > 0 && separation.green > 0 &&
          separation.greenRadius > separation.redRadius + 2,
        mode + ": CO2 does not extend above the Temperature band");
      }
      if (isVolume) {
        atmosphere.setFields(equator, null);
        camera.position.z = 1.04; // Above the surface, inside the 1.09 volume bound.
        const inside = result.insideShell = { cameraRadius: camera.position.z, front: read(48) };
        earth.rotation.y = Math.PI;
        inside.back = read(48);
        surface.setDrawRange(0, 0);
        inside.withoutSurfaceDepth = read(48);
        surface.setDrawRange(0, Infinity);
        earth.rotation.y = 0;
        camera.position.z = 2.35;
        atmosphere.setFields(temperature, co2);
        check(inside.front.alpha > 0, "inside-shell camera lost nearby air");
        check(inside.back.alpha === 0, "inside-shell camera sees air through the surface");
        check(inside.withoutSurfaceDepth.alpha > 0, "inside-shell far-side fixture is not visible without depth");
      }
      renderer.setViewport(3, 4, 200, 210);
      renderer.setScissor(5, 6, 180, 190);
      renderer.setScissorTest(true);
      renderer.setClearColor(0x123456, 0.3);
      atmosphere.prepare(32, 0.5);
      check(renderer.getViewport(new THREE.Vector4()).equals(new THREE.Vector4(3, 4, 200, 210)) &&
        renderer.getScissor(new THREE.Vector4()).equals(new THREE.Vector4(5, 6, 180, 190)) &&
        renderer.getScissorTest() && renderer.getClearAlpha() === 0.3 && renderer.getRenderTarget() === null,
      mode + ": prepass leaked renderer state");
      renderer.setViewport(0, 0, 320, 320);
      renderer.setScissorTest(false);
      renderer.setClearColor(0, 0);
      atmosphere.setFields(null, null);
      check(read().alpha === 0, mode + ": missing fields manufactured density");
      atmosphere.setFields(temperature, co2);
      renderer.setPixelRatio(2);
      renderer.setSize(1500, 950, false);
      camera.aspect = 1500 / 950;
      camera.updateProjectionMatrix();
      atmosphere.prepare(48, 0.5);
      const resources = atmosphere.stats();
      check(resources.depthWidth * resources.depthHeight <= 1048576, mode + ": depth target unbounded");
      if (isVolume) check(resources.width * resources.height <= 1048576, "volume target unbounded");
      check(resources.additionalBytes <= 64 * 1024 * 1024, mode + ": unexpected additional allocation");
      let borrowedDisposals = 0;
      const disposed = () => borrowedDisposals++;
      for (const resource of [surface, temperature, co2]) resource.addEventListener("dispose", disposed);
      atmosphere.dispose(); atmosphere = null;
      for (const resource of [surface, temperature, co2]) resource.removeEventListener("dispose", disposed);
      check(borrowedDisposals === 0 && earth.children.length === 0, mode + ": teardown damaged borrowed data");
      Object.assign(result, { north, south, combined, backAlpha: back.alpha,
        deformedUpper: deformed.upper, enclosedAlpha: enclosed.alpha, qualities, separation, resources,
        texturesAfterDisposal: renderer.info.memory.textures });
      renderer.setPixelRatio(1);
      renderer.setSize(320, 320, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    }
    const byMode = new Map(results.map((result) => [result.mode, result]));
    check(byMode.get("volume-strong").north.alpha > byMode.get("volume").north.alpha * 1.2,
      "strong volume does not materially strengthen the midpoint field");
    const separated = byMode.get("volume-strong-separated");
    const veryStrong = byMode.get("volume-very-strong-separated");
    const nearOpaque = byMode.get("volume-near-opaque-separated");
    const logarithmic = byMode.get("volume-log-separated");
    check(nearOpaque.north.alpha > separated.north.alpha * 1.25 &&
      nearOpaque.insideShell.front.maxAlpha >= 245,
    "near-opaque response is not strong at midpoint and close high-value views");
    check(veryStrong.north.alpha > separated.north.alpha &&
      veryStrong.north.alpha < nearOpaque.north.alpha,
    "very-strong linear response is not between strong and near-opaque");
    check(logarithmic.north.alpha > separated.north.alpha * 1.15,
      "log response did not lift the middle of the normalized range");
    return { passed: true, results, visibleSolidMesh: false };
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error), results };
  } finally {
    atmosphere?.dispose();
    for (const resource of owned) resource.dispose();
    renderer?.dispose(); renderer?.forceContextLoss();
  }
})()
