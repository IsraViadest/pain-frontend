/* Actual canvas textures and the shared highlight layer. Run with existing eval.mjs. */
(async () => {
  const textures = [];
  let layer, surface, renderer;
  try {
    const check = (value, message) => { if (!value) throw Error(message); };
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const geo = await import("/src/globe/countryGeometry.ts");
    const { createCountryHighlightTexture } = await import("/src/globe/choroplethField.ts");
    const { createEmoSelectionLayer } = await import("/src/emo/selection.ts");
    const { GlobeView } = await import("/src/globe/GlobeView.ts");
    const { findEmoPreset, resolveEmoPresetParams, DEFAULT_EMO_PRESET_ID } = await import("/src/emo/viewPresets.ts");
    const rectangle = (key, left, right) => ({ properties: { ISO_A3: key },
      geometry: { type: "Polygon", coordinates: [[[left, 0], [right, 0],
        [right, 10], [left, 10], [left, 0]]] } });
    const countries = geo.buildCountryGeometries({ features: [
      rectangle("AAA", -20, -10), rectangle("BBB", -10, 0), rectangle("CCC", 0, 10),
    ] });
    const sample = (texture, lng, lat) => {
      const { data, width, height } = texture.image;
      const x = Math.floor((lng + 180) / 360 * width), y = Math.floor((90 - lat) / 180 * height);
      return Array.from(data.slice((y * width + x) * 4, (y * width + x) * 4 + 4));
    };
    const make = (weight) => {
      const texture = createCountryHighlightTexture(["AAA", "BBB", "CCC"], "#ffffff", 0.35, 4,
        [], 0, countries, new Map([["AAA", 1], ["BBB", weight], ["CCC", weight]]));
      textures.push(texture);
      return texture;
    };
    const results = [];
    for (const weight of [1, 0.5, 0.65]) {
      const texture = make(weight);
      const origin = sample(texture, -15, 5)[3], peer = sample(texture, -5, 5)[3];
      const shared = sample(texture, 0, 5)[3], outside = sample(texture, 10, 5)[3];
      check(Math.abs(peer - origin * weight) <= 1, "peer fill strength changed");
      check(shared === outside && shared === Math.round(255 * weight), "shared peer border brightened");
      check(sample(texture, -10, 5)[3] === 255, "origin border lost strength");
      results.push({ weight, originAlpha: origin, peerAlpha: peer, sharedAlpha: shared });
    }
    const marker = createCountryHighlightTexture([], "#ffffff", 0.35, 4,
      [{ lng: 0, lat: 0, strength: 0.5 }], 2, [], new Map());
    textures.push(marker);
    check(sample(marker, 0, 0)[3] === 45, "centroid marker does not inherit peer strength");

    await geo.ensureCountryGeometriesLoaded();
    surface = new THREE.SphereGeometry(1, 8, 8);
    const content = new THREE.Group();
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(32, 32, false);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    camera.position.z = 3;
    const gl = renderer.getContext();
    const createTexture = gl.createTexture.bind(gl), deleteTexture = gl.deleteTexture.bind(gl);
    let allocatedTextures = 0, deletedTextures = 0;
    gl.createTexture = () => { allocatedTextures++; return createTexture(); };
    gl.deleteTexture = (texture) => { deletedTextures++; return deleteTexture(texture); };
    const render = () => {
      renderer.render(content, camera);
      check(gl.getError() === gl.NO_ERROR, "highlight upload failed");
    };
    let origin = "IND", borderStorage = 0, surfaceProjection = true;
    const projectedArrays = new WeakSet();
    const motion = { retreatingCategories: () => [], markArrivalOf: () => 1,
      markStrengthOf: (iso, weight) => iso === origin ? 1 : weight };
    const params = { ...resolveEmoPresetParams(findEmoPreset(DEFAULT_EMO_PRESET_ID)), selectionOutline: 2 };
    layer = await createEmoSelectionLayer({ globe: { earthContent: content, renderer, camera,
      getCountrySurfaceGeometry: () => surface, getDisplayCountryGeometries: geo.getCountryGeometries,
      projectCountryOutlinePositions: (base, out) => {
        projectedArrays.add(out);
        if (surfaceProjection) GlobeView.prototype.projectCountryOutlinePositions.call(
          { choroplethShell: { geometry: surface } }, base, out);
        else out.set(base);
      },
      setSelectionBorderStorageBytes: (bytes) => { borderStorage = bytes; } },
      params, motion, data: { countries: { IND: { cat: "test" }, PAK: { cat: "test" } } } });
    const mesh = content.children[0];
    layer.setPeerStrength(0.5);
    layer.setSelectedCategory("test");
    layer.update();
    render();
    const first = mesh.material.map;
    const firstIndia = sample(first, 78, 20)[3], firstPakistan = sample(first, 69, 30)[3];
    origin = "PAK";
    layer.update();
    render();
    check(sample(mesh.material.map, 78, 20)[3] === firstPakistan &&
      sample(mesh.material.map, 69, 30)[3] === firstIndia, "origin role did not swap strengths");
    layer.setSelectedCategory(null);
    layer.setExactCountry("IND", "#ff0000");
    layer.update();
    render();
    check(sample(mesh.material.map, 78, 20)[0] === 255 &&
      sample(mesh.material.map, 78, 20)[1] === 0, "exact-country fill color incorrect");
    check(sample(mesh.material.map, 69, 30)[3] === 0, "exact mode marked a peer");
    check(mesh.material.blending === THREE.NormalBlending, "exact highlight adds unbounded light");
    const vectorBorders = content.getObjectByName("emo-country-selection-borders");
    check(vectorBorders && vectorBorders.children.some((line) => line.visible &&
      line.geometry.getAttribute("instanceStart").count > 0), "selected country lacks vector border");
    check(borderStorage > 2048, "vector border storage was omitted from the resource accounting");
    const line = vectorBorders.children.find((child) => child.visible);
    const instanceBuffer = line.geometry.getAttribute("instanceStart").data;
    check(projectedArrays.has(instanceBuffer.array), "line buffer copied away from live projected positions");
    const previous = instanceBuffer.array.slice();
    const surfacePositions = surface.getAttribute("position");
    for (let i = 0; i < surfacePositions.count; i++) surfacePositions.setXYZ(i,
      surfacePositions.getX(i) * 0.8, surfacePositions.getY(i) * 0.8, surfacePositions.getZ(i) * 0.8);
    surfacePositions.needsUpdate = true;
    surface.computeBoundingSphere();
    layer.update();
    render();
    check(line.geometry.getAttribute("instanceStart").data === instanceBuffer,
      "surface deformation replaced the border buffer");
    check(previous.every((value, i) => Math.abs(instanceBuffer.array[i] - value * 0.8) < 1e-6),
      "country border did not follow live surface deformation");

    const depthMesh = content.children.find((child) => child.material?.colorWrite === false);
    check(depthMesh?.geometry === surface && depthMesh.material.depthWrite &&
      depthMesh.renderOrder < mesh.renderOrder, "selection depth pass detached from borrowed surface");
    // Two camera-facing folds: a transparent foreground over the selected country's rear fold.
    // The colorless prepass must hide the rear country without requiring a visible globe.
    const positions = [], uvs = [];
    for (const [z, lng, lat] of [[0.2, 69, 30], [0, 78, 20]]) {
      for (const [x, y] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5],
        [-0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
        positions.push(x, y, z);
        uvs.push((lng + 180) / 360, (lat + 90) / 180);
      }
    }
    const folds = new THREE.BufferGeometry();
    folds.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    folds.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    surfaceProjection = false;
    surface.copy(folds);
    folds.dispose();
    surface.computeBoundingSphere();
    const pixel = new Uint8Array(4);
    const redAtCenter = () => {
      render();
      gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return pixel[0];
    };
    vectorBorders.visible = false;
    depthMesh.visible = false;
    check(redAtCenter() > 0, "occlusion control did not expose the rear country");
    depthMesh.visible = true;
    check(redAtCenter() === 0, "rear country bled through the transparent foreground");
    layer.setExactCountry("SGP", "#00ff00");
    layer.update();
    render();
    check(mesh.visible && mesh.material.map, "centroid-only country lost its exact highlight");
    layer.setExactCountry(null, "#ffffff");
    layer.update();
    render();
    check(!mesh.visible && !depthMesh.visible && mesh.material.map === null,
      "clear left a country highlighted or its depth mask active");
    check(mesh.geometry === surface, "highlight detached from shared scar surface");
    check(allocatedTextures === 1 && deletedTextures === 1,
      "highlight texture storage churn: " + allocatedTextures + " allocations / " + deletedTextures + " deletions");
    return { passed: true, results, roleSwap: true, exactCountry: true, centroidMarker: true,
      borrowedSurface: true, foldedSurfaceOcclusion: true, vectorCountryBorder: true,
      liveBorderBuffer: true, surfaceDeformation: true,
      allocatedTextures, deletedTextures };
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error) };
  } finally {
    layer?.destroy(); surface?.dispose();
    for (const texture of textures) texture?.dispose();
    renderer?.dispose(); renderer?.forceContextLoss();
  }
})()
