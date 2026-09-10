/* created by: Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 * Run through artifacts/emo-views/eval.mjs on the live Vite preview.
 * Render ocean/land samples at identical positions with the production vertex shader. A white disk
 * isolates painted size from the deliberately different land/ocean colors and alpha.
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
    material = new THREE.ShaderMaterial({ vertexShader: live.vertexShader,
      fragmentShader: "void main() { if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard; gl_FragColor = vec4(1.0); }",
      uniforms: Object.fromEntries(Object.entries(live.uniforms).map(([key, item]) =>
        [key, { value: item.value }])), depthTest: false, depthWrite: false });
    scar = new THREE.DataTexture(new Uint8Array([64, 64, 64, 255]), 1, 1);
    scar.needsUpdate = true;
    Object.assign(material.uniforms, {
      uScarMap: { value: scar }, uScarActive: { value: 0 },
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
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10);
    for (const physical of [false, true]) for (const dpr of [1, 2]) {
      const width = 512 * dpr;
      target?.dispose();
      target = new THREE.WebGLRenderTarget(width, width);
      material.uniforms.uPixelRatio.value = dpr;
      material.uniforms.uScarActive.value = physical ? 1 : 0;
      material.uniforms.uScarDispScale.value = 0.4;
      material.uniforms.uScarDispBias.value = -0.2;
      material.uniforms.uScarLandOnly.value = 0;
      material.uniforms.uScarDepthSize.value = physical ? -1 : 0;
      material.uniforms.uDetailFocal.value = 512 * camera.projectionMatrix.elements[5] / 2;
      for (const distance of [2.8, 2.35, 1.7, 1.35]) {
        camera.position.set(0, 0, distance);
        camera.lookAt(0, 0, 0);
        const pixels = new Uint8Array(width * width * 4);
        const counts = [0, 0], min = [width, width], max = [-1, -1];
        for (const land of [0, 1]) {
          geometry.attributes.aLand.array.fill(land);
          geometry.attributes.aLand.needsUpdate = true;
          renderer.setRenderTarget(target);
          renderer.render(scene, camera);
          renderer.readRenderTargetPixels(target, 0, 0, width, width, pixels);
          // Compare the same screen position: mirrored dots can differ by an edge pixel.
          for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
            if (!pixels[(y * width + x) * 4 + 3]) continue;
            counts[land]++; min[land] = Math.min(min[land], x); max[land] = Math.max(max[land], x);
          }
        }
        rows.push({ physical, dpr, distance, oceanPixels: counts[0], landPixels: counts[1],
          oceanWidth: max[0] - min[0] + 1, landWidth: max[1] - min[1] + 1 });
      }
    }
    if (renderer.getContext().getError() !== 0) throw Error("WebGL error");
    const mismatches = rows.filter(row => !row.oceanPixels || (!row.physical &&
      (row.oceanPixels !== row.landPixels || row.oceanWidth !== row.landWidth)));
    for (const row of rows.filter(row => row.physical)) {
      const normal = rows.find(other => !other.physical && other.dpr === row.dpr &&
        other.distance === row.distance);
      if (row.oceanPixels !== normal.oceanPixels || row.oceanWidth !== normal.oceanWidth) {
        throw Error("Ocean size inherited physical scar changes");
      }
    }
    for (const dpr of [1, 2]) {
      const normal = rows.filter(row => !row.physical && row.dpr === dpr);
      if (normal.at(-1).oceanPixels <= normal[0].oceanPixels) {
        throw Error("Ocean did not grow with the normal land zoom sizing");
      }
    }
    return { passed: mismatches.length === 0, liveDetailMode: live.uniforms.uDetailMode.value,
      pointScale: live.uniforms.uPointScale.value, rows };
  } catch (error) {
    return { passed: false, error: String(error), rows };
  } finally {
    if (prototype && originalTick) prototype.tick = originalTick;
    target?.dispose(); geometry?.dispose(); material?.dispose(); scar?.dispose(); renderer?.dispose();
  }
})()
