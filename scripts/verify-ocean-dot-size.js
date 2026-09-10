/* created by: Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 * Run through artifacts/emo-views/eval.mjs on the live Vite preview.
 * Render the production vertex shader into a float target. Reading gl_PointSize through
 * a varying checks exact size ratios without whole-pixel rounding or color/alpha differences.
 */
(async () => {
  let prototype, originalTick, renderer, target, geometry, material, scar;
  const rows = [];
  try {
    const moduleUrl = performance.getEntriesByType("resource").map(entry => entry.name)
      .find(name => /\/src\/globe\/GlobeView(?:\.ts)?(?:\?|$)/.test(name));
    if (!moduleUrl) throw Error("Missing live GlobeView module");
    const { GlobeView } = await import(moduleUrl);
    const THREE = await import("/node_modules/.vite/deps/three.js");
    prototype = GlobeView.prototype;
    originalTick = prototype.tick;
    const globe = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("No live globe frame")), 3000);
      prototype.tick = function (...args) {
        prototype.tick = originalTick;
        clearTimeout(timer);
        originalTick.apply(this, args);
        resolve(this);
      };
    });
    const live = globe.pointsMaterial;
    if (!live) throw Error("Missing live stipple material");
    if (live.uniforms.uDetailMode.value !== 1) throw Error("Expected the existing land zoom sizing");
    material = new THREE.ShaderMaterial({
      vertexShader: "varying float measuredSize;\n" + live.vertexShader.replace(
        "gl_Position = projectionMatrix * mvPosition;",
        "measuredSize = gl_PointSize; gl_Position = projectionMatrix * mvPosition;"),
      fragmentShader: "varying float measuredSize; void main() { gl_FragColor = vec4(measuredSize, 0.0, 0.0, 1.0); }",
      uniforms: Object.fromEntries(Object.entries(live.uniforms).map(([key, item]) =>
        [key, { value: item.value }])), depthTest: false, depthWrite: false });
    scar = new THREE.DataTexture(new Uint8Array([64, 64, 64, 255]), 1, 1);
    scar.needsUpdate = true;
    Object.assign(material.uniforms, {
      uScarMap: { value: scar }, uScarActive: { value: 0 },
      uScarMaxDepth: { value: 128 / 255 },
      uScarDepthSize: { value: 0 }, uDetailFadeSeconds: { value: 0 },
    });
    const positions = [0, 0, 1];
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aLand", new THREE.Float32BufferAttribute([0], 1));
    geometry.setAttribute("aRoot", new THREE.Float32BufferAttribute([0, 0, 1, 0.012], 4));
    geometry.setAttribute("aSizeScale", new THREE.Float32BufferAttribute([1], 1));
    geometry.setAttribute("aFade", new THREE.Float32BufferAttribute([1, 1, 0], 3));
    geometry.setAttribute("aUniformDetail", new THREE.Float32BufferAttribute([0], 1));
    const scene = new THREE.Scene();
    scene.add(new THREE.Points(geometry, material));
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setClearColor(0, 0);
    if (!renderer.getContext().getExtension("EXT_color_buffer_float")) throw Error("Float target unavailable");
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10);
    for (const physical of [false, true]) for (const dpr of [1, 2]) {
      const width = 512 * dpr;
      target?.dispose();
      target = new THREE.WebGLRenderTarget(width, width, { type: THREE.FloatType });
      material.uniforms.uPixelRatio.value = dpr;
      material.uniforms.uScarActive.value = physical ? 1 : 0;
      // Keep geometry identical while varying scar depth to isolate the size multiplier.
      material.uniforms.uScarDispScale.value = 0;
      material.uniforms.uScarDispBias.value = 0;
      material.uniforms.uScarLandOnly.value = 0;
      material.uniforms.uScarDepthSize.value = physical ? -1 : 0;
      material.uniforms.uDetailFocal.value = 512 * camera.projectionMatrix.elements[5] / 2;
      for (const distance of [2.8, 2.35, 1.7, 1.35]) for (const height of physical ? [128, 64, 0] : [128]) {
        scar.image.data.set([height, height, height, 255]);
        scar.needsUpdate = true;
        camera.position.set(0, 0, distance);
        camera.lookAt(0, 0, 0);
        const pixels = new Float32Array(width * width * 4);
        const sizes = [0, 0];
        for (const land of [0, 1]) {
          geometry.attributes.aLand.array.fill(land);
          geometry.attributes.aLand.needsUpdate = true;
          renderer.setRenderTarget(target);
          renderer.render(scene, camera);
          renderer.readRenderTargetPixels(target, 0, 0, width, width, pixels);
          for (let offset = 0; offset < pixels.length; offset += 4) {
            if (!pixels[offset + 3]) continue;
            sizes[land] = pixels[offset];
            break;
          }
        }
        rows.push({ physical, dpr, distance, depth: (128 - height) / 128,
          oceanSize: sizes[0], landSize: sizes[1] });
      }
    }
    if (renderer.getContext().getError() !== 0) throw Error("WebGL error");
    for (const row of rows) {
      const normal = rows.find(other => !other.physical && other.dpr === row.dpr &&
        other.distance === row.distance);
      if (!(row.oceanSize > 0) || Math.abs(row.oceanSize / normal.landSize - 0.85) > 0.00001) {
        throw Error("Ocean is not 15% smaller than normal country dots");
      }
      if (row.physical && Math.abs(row.landSize / row.oceanSize - (1.5 - 0.75 * row.depth)) > 0.00001) {
        throw Error("Physical scar size does not follow 150% to 75% of the ocean reference");
      }
    }
    for (const dpr of [1, 2]) {
      const normal = rows.filter(row => !row.physical && row.dpr === dpr);
      if (normal.at(-1).oceanSize <= normal[0].oceanSize) {
        throw Error("Ocean did not grow with the normal land zoom sizing");
      }
    }
    const layers = [];
    for (const layer of ["emopain", "envpain", "socioecopain", "physpain", "all-pain"]) {
      document.querySelector(`button[data-layer="${layer}"]`).click();
      await new Promise(resolve => setTimeout(resolve, 1500));
      const uniforms = globe.pointsMaterial.uniforms;
      const sizeMode = uniforms.uScarDepthSize.value;
      if (sizeMode !== (["physpain", "all-pain"].includes(layer) ? -1 : 0)) {
        throw Error("Incorrect scar sizing on " + layer);
      }
      const low = new THREE.Color(0x370713).toArray();
      if (uniforms.uScarReliefLow.value.toArray().some((value, i) => Math.abs(value - low[i]) > 1e-6)) {
        throw Error("Dark red was not brightened");
      }
      layers.push({ layer, sizeMode });
    }
    return { passed: true, pointScale: live.uniforms.uPointScale.value, rows, layers };
  } catch (error) {
    return { passed: false, error: String(error), rows };
  } finally {
    if (prototype && originalTick) prototype.tick = originalTick;
    target?.dispose(); geometry?.dispose(); material?.dispose(); scar?.dispose(); renderer?.dispose();
  }
})()
