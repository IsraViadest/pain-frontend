/* Actual canvas textures and the shared highlight layer. Run with existing eval.mjs. */
(async () => {
  const textures = [];
  let layer, surface;
  try {
    const check = (value, message) => { if (!value) throw Error(message); };
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const geo = await import("/src/globe/countryGeometry.ts");
    const { createCountryHighlightTexture } = await import("/src/globe/choroplethField.ts");
    const { createEmoSelectionLayer } = await import("/src/emo/selection.ts");
    const { resolveEmoViewFromUrl } = await import("/src/emo/emoViewConfig.ts");
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
    let origin = "IND";
    const motion = { retreatingCategories: () => [], markArrivalOf: () => 1,
      markStrengthOf: (iso, weight) => iso === origin ? 1 : weight };
    const params = resolveEmoViewFromUrl().params;
    layer = await createEmoSelectionLayer({ globe: { earthContent: content,
      getCountrySurfaceGeometry: () => surface, getDisplayCountryGeometries: geo.getCountryGeometries },
      params, motion, data: { countries: { IND: { cat: "test" }, PAK: { cat: "test" } } } });
    const mesh = content.children[0];
    layer.setPeerStrength(0.5);
    layer.setSelectedCategory("test");
    layer.update();
    const first = mesh.material.map;
    const firstIndia = sample(first, 78, 20)[3], firstPakistan = sample(first, 69, 30)[3];
    origin = "PAK";
    layer.update();
    check(mesh.material.map !== first, "equal-count role change did not repaint");
    check(sample(mesh.material.map, 78, 20)[3] === firstPakistan &&
      sample(mesh.material.map, 69, 30)[3] === firstIndia, "origin role did not swap strengths");
    layer.setSelectedCategory(null);
    layer.setExactCountry("IND", "#ff0000");
    layer.update();
    check(sample(mesh.material.map, 78, 20)[0] === 255 &&
      sample(mesh.material.map, 78, 20)[1] === 0, "exact-country fill color incorrect");
    check(sample(mesh.material.map, 69, 30)[3] === 0, "exact mode marked a peer");
    check(mesh.material.blending === THREE.NormalBlending, "exact highlight adds unbounded light");
    layer.setExactCountry("SGP", "#00ff00");
    layer.update();
    check(mesh.visible && mesh.material.map, "centroid-only country lost its exact highlight");
    layer.setExactCountry(null, "#ffffff");
    layer.update();
    check(!mesh.visible && mesh.material.map === null, "clear left a country highlighted");
    check(mesh.geometry === surface, "highlight detached from shared scar surface");
    return { passed: true, results, roleSwap: true, exactCountry: true, centroidMarker: true,
      borrowedSurface: true };
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error) };
  } finally {
    layer?.destroy(); surface?.dispose();
    for (const texture of textures) texture?.dispose();
  }
})()
