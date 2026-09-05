/* Actual WebGL readback against the CPU scar sampler, using the installed renderer. */
(async () => {
  let renderer, geometry, material, target;
  const textures = [];
  let borders;
  const surfaces = [];
  try {
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const { sampleScarHeight01 } = await import("/src/globe/scarDisplacement.ts");
    const { createPainScarDisplacementTexture } = await import("/src/globe/painScarField.ts");
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(1, 1, false);
    target = new THREE.WebGLRenderTarget(1, 1);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
    camera.position.z = 1;
    const scene = new THREE.Scene();
    material = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, sampleUv: { value: new THREE.Vector2() } },
      vertexShader: "void main(){gl_Position=vec4(position.xy,0.,1.);}",
      fragmentShader: "uniform sampler2D map; uniform vec2 sampleUv; void main(){" +
        "float h=texture2D(map,sampleUv).r; gl_FragColor=vec4(h,h,h,1.);}",
    });
    geometry = new THREE.PlaneGeometry(2, 2);
    scene.add(new THREE.Mesh(geometry, material));
    const ramp = new THREE.DataTexture(new Uint8Array([
      0, 255, 64, 192, 128, 32, 200, 16, 250, 120, 90, 4,
    ]), 4, 3, THREE.RedFormat);
    ramp.wrapS = THREE.RepeatWrapping;
    ramp.minFilter = ramp.magFilter = THREE.LinearFilter;
    ramp.needsUpdate = true;
    const scar = createPainScarDisplacementTexture([
      { lat: 0, lng: 179.9, intensity: 1 }, { lat: 80, lng: 20, intensity: 0.8 },
    ]);
    textures.push(ramp, scar);
    const samples = [[0, 0], [1, 0], [0, 0.5], [1, 0.5], [0.125, 1 / 6],
      [0.25, 0.5], [0.4997, 0.502], [0.99999, 0.5], [-0.02, 1], [1.1, -0.2],
      [0.37, 0.61], [0.125, 0.75], [0.625, 0.8]];
    let maxByteError = 0;
    const bytes = new Uint8Array(4);
    renderer.setRenderTarget(target);
    for (const texture of textures) {
      material.uniforms.map.value = texture;
      for (const [u, v] of samples) {
        material.uniforms.sampleUv.value.set(u, v);
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(target, 0, 0, 1, 1, bytes);
        const expected = sampleScarHeight01(texture, u, v) * 255;
        maxByteError = Math.max(maxByteError, Math.abs(bytes[0] - expected));
      }
    }
    if (maxByteError > 1.1) throw new Error("CPU/GPU mismatch: " + maxByteError + " bytes");
    const { GlobeView } = await import("/src/globe/GlobeView.ts");
    const { loadGlobeBorderOutlines } = await import("/src/globe/countryBorders.ts");
    borders = await loadGlobeBorderOutlines("/borders/", 1, new THREE.Vector2(1500, 950));
    const countBorders = () => borders.group.children.reduce((sum, line) =>
      sum + line.geometry.attributes.instanceStart.count, 0);
    const originalBorders = countBorders();
    const depth = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 128));
    const fill = new THREE.Mesh(new THREE.SphereGeometry(1.001, 192, 128));
    surfaces.push(depth, fill);
    let rewarps = 0;
    const owner = { globe: depth, choroplethShell: fill, surfaceDetail: 1,
      bordersOutlines: borders, syncScarVisualization: () => { rewarps++; } };
    const borrowed = GlobeView.prototype.getCountrySurfaceGeometry.call(owner);
    GlobeView.prototype.setSurfaceDetail.call(owner, 2);
    if (borrowed !== fill.geometry || borrowed.attributes.position.count !== 98945) {
      throw new Error("surface refinement detached the borrowed selection geometry");
    }
    const refinedBorders = countBorders();
    if (refinedBorders <= originalBorders || rewarps !== 1) throw new Error("refinement not applied");
    GlobeView.prototype.setSurfaceDetail.call(owner, 1);
    if (countBorders() !== originalBorders || borrowed.attributes.position.count !== 24897) {
      throw new Error("original surface sampling did not restore");
    }
    return { passed: true, samples: samples.length * textures.length, maxByteError,
      originalBorders, refinedBorders, sharedGeometryRetained: true,
      renderer: renderer.getContext().getParameter(renderer.getContext().VERSION) };
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error) };
  } finally {
    for (const texture of textures) texture.dispose();
    borders?.dispose();
    for (const mesh of surfaces) { mesh.geometry.dispose(); mesh.material.dispose(); }
    geometry?.dispose(); material?.dispose(); target?.dispose(); renderer?.dispose();
    renderer?.forceContextLoss();
  }
})()
