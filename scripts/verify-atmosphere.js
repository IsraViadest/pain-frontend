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
    const renderScene = renderer.render.bind(renderer);
    let depthDraws = 0;
    renderer.render = (scene, camera) => {
      if (scene.children.length === 1 && scene.children[0].material?.colorWrite === false) depthDraws++;
      return renderScene(scene, camera);
    };
    const setTarget = renderer.setRenderTarget;
    let verifiedDepthTargets = 0;
    const checkedTargets = new WeakSet();
    renderer.setRenderTarget = function (target, ...args) {
      setTarget.call(this, target, ...args);
      if (target?.depthTexture && !checkedTargets.has(target)) {
        const gl = renderer.getContext();
        check(target.texture.format === THREE.RedFormat && target.texture.type === THREE.UnsignedByteType,
          "Unused depth-pass color attachment is not R8");
        check(gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE,
          "R8 plus depth framebuffer is incomplete");
        checkedTargets.add(target); verifiedDepthTargets++;
      }
    };
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
      "volume-log-near-opaque-separated", "volume-very-strong-separated-smooth"]) {
      const smooth = mode.endsWith("-smooth");
      const isVolume = mode.startsWith("volume");
      const result = { mode };
      results.push(result);
      atmosphere = createEnvironmentalAtmosphere({ mode: mode.replace(/-smooth$/, ""), smooth,
        renderer, camera, earthContent: earth,
        surfaceGeometry: surface });
      atmosphere.setFields(zero, zero);
      result.zeroFields = read();
      check(result.zeroFields.alpha === 0, mode + ": zero-valued non-null fields manufactured density");
      atmosphere.setFields(temperature, null);
      const depthBeforeNorth = depthDraws;
      const north = read();
      check(depthDraws - depthBeforeNorth === (isVolume ? 0 : 1),
        mode + ": incorrect depth pass for a complete sphere");
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
      const depthBeforeDeformation = depthDraws;
      const deformed = read();
      check(depthDraws - depthBeforeDeformation === 1, mode + ": deformed surface lost its depth pass");
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
      const pixelCap = smooth ? 2097152 : 1048576;
      check(resources.depthWidth * resources.depthHeight <= pixelCap, mode + ": depth target unbounded");
      if (isVolume) check(resources.width * resources.height <= pixelCap, "volume target unbounded");
      check(resources.additionalBytes <= 64 * 1024 * 1024, mode + ": unexpected additional allocation");
      if (smooth) {
        atmosphere.prepare(16, 0.25);
        const light = atmosphere.stats();
        check(light.samples === 16 && light.width <= 750 && light.height <= 475 &&
          light.depthWidth <= 750 && light.depthHeight <= 475 &&
          light.additionalBytes < resources.additionalBytes,
        "smooth volume ignores requested Light quality");
      }
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
    // Rear air is visible outside the globe but clipped inside its silhouette. This exposes
    // the stepped nearest-depth edge which the front-facing field checks cannot detect.
    renderer.setSize(640, 640, false);
    camera.position.z = 3.5;
    const edgeSurface = new THREE.SphereGeometry(1, 192, 128);
    const edgeBytes = new Uint8Array(128 * 4);
    for (let x = 64; x < 128; x++) edgeBytes[x * 4 + 3] = 100;
    const edgeField = new THREE.DataTexture(edgeBytes, 128, 1, THREE.RGBAFormat);
    edgeField.minFilter = edgeField.magFilter = THREE.LinearFilter;
    edgeField.needsUpdate = true;
    owned.push(edgeSurface, edgeField);
    const edgeCaptures = [];
    for (const [smooth, fraction] of [[false, 0.25], [true, 1]]) {
      atmosphere = createEnvironmentalAtmosphere({ mode: "volume-very-strong-separated",
        smooth, renderer, camera, earthContent: earth, surfaceGeometry: edgeSurface });
      atmosphere.setFields(null, edgeField);
      atmosphere.prepare(16, fraction);
      renderer.render(scene, camera);
      const rgba = new Uint8Array(640 * 640 * 4), gl = renderer.getContext();
      gl.readPixels(0, 0, 640, 640, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      edgeCaptures.push(rgba);
      atmosphere.dispose(); atmosphere = null;
    }
    const projectedRadius = 640 / (2 * Math.tan(Math.PI / 8) * Math.sqrt(3.5 ** 2 - 1));
    let edgeError = 0, edgePixelCount = 0;
    for (let y = 30; y < 610; y++) for (let x = 30; x < 610; x++) {
      if (Math.abs(Math.hypot(x + 0.5 - 320, y + 0.5 - 320) - projectedRadius) > 6) continue;
      const index = (y * 640 + x) * 4 + 3;
      edgeError += Math.abs(edgeCaptures[0][index] - edgeCaptures[1][index]);
      edgePixelCount++;
    }
    const edgeMeanAlphaError = edgeError / edgePixelCount;
    check(edgeMeanAlphaError < 1, "Rear atmospheric edge is still magnified from low resolution: " + edgeMeanAlphaError);
    // A 2x image with one ray per pixel provides the exact four spatial sample positions.
    // Disable its own AA so the reference does not accidentally supersample twice.
    renderer.setSize(1280, 1280, false);
    atmosphere = createEnvironmentalAtmosphere({ mode: "volume-very-strong-separated", smooth: true,
      renderer, camera, earthContent: earth, surfaceGeometry: edgeSurface });
    const composite = earth.children.find((child) => child.material?.uniforms?.uVolume).material;
    const originalFragment = composite.fragmentShader;
    composite.fragmentShader = originalFragment.replace("if (abs(edge) <= 0.5 * pixelWidth)", "if (false)");
    check(composite.fragmentShader !== originalFragment, "Cannot disable reference subpixel AA");
    composite.needsUpdate = true;
    atmosphere.setFields(null, edgeField); atmosphere.prepare(16, 1); renderer.render(scene, camera);
    const referencePixels = new Uint8Array(1280 * 1280 * 4), gl = renderer.getContext();
    gl.readPixels(0, 0, 1280, 1280, gl.RGBA, gl.UNSIGNED_BYTE, referencePixels);
    let coverageError = 0, coveragePixels = 0;
    for (let y = 30; y < 610; y++) for (let x = 30; x < 610; x++) {
      const outside = [[-.25, -.25], [-.25, .25], [.25, -.25], [.25, .25]]
        .filter(([dx, dy]) => Math.hypot(x + .5 + dx - 320, y + .5 + dy - 320) > projectedRadius).length;
      if (outside === 0 || outside === 4) continue;
      let referenceAlpha = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        referenceAlpha += referencePixels[((2 * y + dy) * 1280 + 2 * x + dx) * 4 + 3] / 4;
      }
      coverageError += Math.abs(referenceAlpha - edgeCaptures[0][(y * 640 + x) * 4 + 3]);
      coveragePixels++;
    }
    const coverageMeanAlphaError = coverageError / coveragePixels;
    check(coveragePixels > 100 && coverageMeanAlphaError < 1,
      "Output-pixel silhouette coverage differs from 2x spatial reference: " + coverageMeanAlphaError);
    atmosphere.dispose(); atmosphere = null;
    // An ellipsoid has no analytic-sphere shortcut. Compare its actual depth-guided edge with
    // independently rendered 2x rays, borrowing the identical 2x depth guide for both results.
    renderer.setSize(640, 640, false);
    edgeSurface.scale(0.92, 0.8, 1);
    atmosphere = createEnvironmentalAtmosphere({ mode: "volume-very-strong-separated",
      renderer, camera, earthContent: earth, surfaceGeometry: edgeSurface });
    atmosphere.setFields(null, edgeField); atmosphere.prepare(16, 0.25); renderer.render(scene, camera);
    const scarPixels = new Uint8Array(640 * 640 * 4);
    gl.readPixels(0, 0, 640, 640, gl.RGBA, gl.UNSIGNED_BYTE, scarPixels);
    const scarComposite = earth.children.find((child) => child.material?.uniforms?.uVolume);
    check(scarComposite.material.uniforms.uSurfaceRadius.value === 0, "Non-spherical fixture used a fake sphere");
    const referenceMaterial = new THREE.ShaderMaterial({
      vertexShader: scarComposite.material.vertexShader,
      fragmentShader: scarComposite.material.fragmentShader.split("void main()")[0] + `
        void main() {
          gl_FragColor = integrateVolume(vUv);
          if (gl_FragColor.a > 0.0) gl_FragColor.rgb /= gl_FragColor.a;
          #include <colorspace_fragment>
        }`,
      uniforms: scarComposite.material.uniforms,
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
    owned.push(referenceMaterial);
    const referenceScene = new THREE.Scene();
    const referenceMesh = new THREE.Mesh(scarComposite.geometry, referenceMaterial);
    referenceMesh.frustumCulled = false; referenceScene.add(referenceMesh);
    renderer.setSize(1280, 1280, false); renderer.render(referenceScene, new THREE.Camera());
    gl.readPixels(0, 0, 1280, 1280, gl.RGBA, gl.UNSIGNED_BYTE, referencePixels);
    let scarError = 0, scarCount = 0;
    for (let y = 30; y < 610; y++) for (let x = 30; x < 610; x++) {
      if (Math.abs(Math.hypot((x + .5 - 320) / .92, (y + .5 - 320) / .8) - projectedRadius) > 6) continue;
      let alpha = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        alpha += referencePixels[((2 * y + dy) * 1280 + 2 * x + dx) * 4 + 3] / 4;
      }
      scarError += Math.abs(alpha - scarPixels[(y * 640 + x) * 4 + 3]); scarCount++;
    }
    const scarMeanAlphaError = scarError / scarCount;
    check(scarCount > 100 && scarMeanAlphaError < 1,
      "Actual non-spherical edge disagrees with independent spatial reference: " + scarMeanAlphaError);
    referenceScene.remove(referenceMesh); atmosphere.dispose(); atmosphere = null;
    const byMode = new Map(results.map((result) => [result.mode, result]));
    check(byMode.get("volume-strong").north.alpha > byMode.get("volume").north.alpha * 1.2,
      "strong volume does not materially strengthen the midpoint field");
    const separated = byMode.get("volume-strong-separated");
    const veryStrong = byMode.get("volume-very-strong-separated");
    const nearOpaque = byMode.get("volume-near-opaque-separated");
    const logarithmic = byMode.get("volume-log-separated");
    check(nearOpaque.north.alpha > separated.north.alpha * 1.25 &&
      // Exact spherical clipping removes the mesh chord's extra optical depth (one alpha byte).
      nearOpaque.insideShell.front.maxAlpha >= 244,
    "near-opaque response is not strong at midpoint and close high-value views");
    check(veryStrong.north.alpha > separated.north.alpha &&
      veryStrong.north.alpha < nearOpaque.north.alpha,
    "very-strong linear response is not between strong and near-opaque");
    check(logarithmic.north.alpha > separated.north.alpha * 1.15,
      "log response did not lift the middle of the normalized range");
    return { passed: true, results, visibleSolidMesh: false, edgeMeanAlphaError,
      coverageMeanAlphaError, coveragePixels, scarMeanAlphaError, verifiedDepthTargets };
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error), results };
  } finally {
    atmosphere?.dispose();
    for (const resource of owned) resource.dispose();
    renderer?.dispose(); renderer?.forceContextLoss();
  }
})()
