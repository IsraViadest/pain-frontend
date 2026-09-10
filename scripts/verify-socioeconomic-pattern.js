/* Actual MeshBasicMaterial pattern shader and choropleth alpha, evaluated by existing eval.mjs.
 * Synthetic countries only. Imports code modules but never requests country or application data.
 */
(async () => {
  let renderer, target, geometry, material, texture, legacyTexture, floorTexture, missingTexture,
    scene, mesh, missingMask;
  const rows = [];
  const shaderErrors = [];
  try {
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const { buildCountryGeometries } = await import("/src/globe/countryGeometry.ts");
    const { createChoroplethTexture, createChoroplethMissingMask } =
      await import("/src/globe/choroplethField.ts");
    const { applySocioeconomicPattern } = await import("/src/globe/socioeconomicPattern.ts");
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const minimum = 0.25;
    const minimumByte = Math.round(minimum * 255);
    const periods = 8;
    const tiles = [
      ["ZER", "zero", 0], ["MIS", "absent", null], ["NAN", "NaN", NaN],
      ["LOW", "quarter", 0.25], ["MID", "half", 0.5], ["HIG", "three-quarter", 0.75],
      ["MAX", "one", 1], ["TIE", "equal-half", 0.5],
    ].map(([key, label, value], index) => ({ key, label, value, longitude: -126 + index * 36 }));
    const countries = buildCountryGeometries({ features: tiles.map((tile) => ({
      properties: { ISO_A3: tile.key }, geometry: { type: "Polygon", coordinates: [[
        [tile.longitude - 6, -6], [tile.longitude + 6, -6], [tile.longitude + 6, 6],
        [tile.longitude - 6, 6], [tile.longitude - 6, -6],
      ]] },
    })) });
    const values = tiles.filter((tile) => tile.value !== null)
      .map((tile) => ({ country: tile.key, intensity: tile.value }));
    texture = createChoroplethTexture(values, "#ffff00", countries, minimum);
    legacyTexture = createChoroplethTexture(values, "#ffff00", countries);
    missingTexture = createChoroplethTexture(values, "#ffff00", countries, minimum, "diagonal");
    missingMask = createChoroplethMissingMask(values, countries);
    for (const tile of tiles) {
      const { width, height, data } = missingMask.image;
      const x = Math.floor((tile.longitude + 180) / 360 * width);
      const expected = tile.value === null || !Number.isFinite(tile.value) ? 255 : 0;
      check(data[Math.floor(height / 2) * width + x] === expected,
        tile.label + ': missing mask confused genuine zero and absence');
    }
    const sourceByte = (map, tile) => {
      const { width, height, data } = map.image;
      const x = Math.floor((tile.longitude + 180) / 360 * width);
      return data[(Math.floor(height / 2) * width + x) * 4 + 3];
    };
    const legacyBytes = [];
    for (const tile of tiles) {
      tile.alphaByte = sourceByte(texture, tile);
      const finite = tile.value !== null && Number.isFinite(tile.value);
      const expected = finite ? Math.round(255 * (minimum + (1 - minimum) * tile.value)) : 0;
      const legacy = sourceByte(legacyTexture, tile);
      check(tile.alphaByte === expected, tile.label + ": non-affine source alpha " + tile.alphaByte);
      check(legacy === (finite ? Math.round(255 * tile.value) : 0), tile.label + ": default minimum changed");
      legacyBytes.push(legacy);
    }
    check(tiles[0].alphaByte === 64 && tiles[1].alphaByte === 0 && tiles[2].alphaByte === 0,
      "Finite zero is not distinct from absent/NaN");
    const missingPixel = (tile) => {
      const { width, height, data } = missingTexture.image;
      const x = Math.floor((tile.longitude + 180) / 360 * width);
      const offset = (Math.floor(height / 2) * width + x) * 4;
      return [...data.slice(offset, offset + 4)];
    };
    const missingSample = missingPixel(tiles[1]);
    const dataSample = missingPixel(tiles[0]);
    check(missingSample[3] > 0 && Math.max(...missingSample.slice(0, 3)) -
      Math.min(...missingSample.slice(0, 3)) < 10, "Missing region is not a visible neutral gray");
    check(dataSample[0] > 200 && dataSample[1] > 200 && dataSample[2] < 20,
      "Missing treatment changed a real socioeconomic value");

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: false });
    renderer.setPixelRatio(1);
    renderer.setSize(256, 256, false);
    renderer.setClearColor(0, 0);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.debug.onShaderError = (gl, program, vertex, fragment) => shaderErrors.push({
      program: gl.getProgramInfoLog(program), vertex: gl.getShaderInfoLog(vertex), fragment: gl.getShaderInfoLog(fragment),
    });
    scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
    camera.position.z = 1;
    renderer.render(scene, camera);
    const baseline = { ...renderer.info.memory };
    target = new THREE.WebGLRenderTarget(256, 256, {
      format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false,
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    });
    geometry = new THREE.PlaneGeometry(2, 2);
    material = new THREE.MeshBasicMaterial({
      map: texture, color: 0xffffff, opacity: 1, transparent: true,
      blending: THREE.NoBlending, depthTest: false, depthWrite: false, toneMapped: false,
    });
    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    function placeTile(tile) {
      const position = geometry.getAttribute("position");
      const uv = geometry.getAttribute("uv");
      const centerU = (tile.longitude + 180) / 360;
      for (let i = 0; i < position.count; i++) {
        const s = (position.getX(i) + 1) / 2;
        const t = (position.getY(i) + 1) / 2;
        // x=720u+360v and y=720u-360v each span eight complete, independent periods.
        // This is a UV parallelogram, not a correlated diagonal slice through woven stripes.
        uv.setXY(i, centerU + periods * (s + t - 1) / 1440,
          0.5 + periods * (s - t) / 720);
      }
      uv.needsUpdate = true;
    }
    function read(style, tile, contrast, alphaMinimum = minimum) {
      placeTile(tile);
      if (contrast === undefined) applySocioeconomicPattern(material, style, alphaMinimum);
      else applySocioeconomicPattern(material, style, alphaMinimum, contrast);
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      const pixels = new Uint8Array(target.width * target.height * 4);
      renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
      check(shaderErrors.length === 0, "Actual pattern shader compilation failed");
      return pixels;
    }
    function summarize(pixels) {
      let total = 0, min = 255, max = 0;
      for (let i = 3; i < pixels.length; i += 4) {
        total += pixels[i]; min = Math.min(min, pixels[i]); max = Math.max(max, pixels[i]);
      }
      return { mean: total / (pixels.length / 4), min, max };
    }
    function maximumDifference(a, b, alphaOnly = false) {
      check(a.length === b.length, "Pixel buffer sizes differ");
      let maximum = 0;
      for (let i = alphaOnly ? 3 : 0; i < a.length; i += alphaOnly ? 4 : 1) {
        maximum = Math.max(maximum, Math.abs(a[i] - b[i]));
      }
      return maximum;
    }
    const means = { color: [], hatch: [], woven: [] };
    const tiePixels = new Map();
    let maxMeanErrorBytes = 0;
    let maxTieDifferenceBytes = 0;
    let rerenderDifferenceBytes = 0;
    for (const tile of tiles) {
      // Decode q from the actual byte alpha and quantized minimum, exactly as the shader does.
      const numerator = Math.max(0, tile.alphaByte - minimumByte);
      const denominator = 255 - minimumByte;
      const q = numerator / denominator;
      const amplitudeBytes = 0.25 * denominator;
      const row = { sample: tile.label, sourceAlpha: tile.alphaByte / 255,
        q: numerator + "/" + denominator };
      for (const style of ["color", "hatch", "woven"]) {
        const pixels = read(style, tile);
        const summary = summarize(pixels);
        means[style].push(summary.mean);
        row[style + "Mean"] = Number((summary.mean / 255).toFixed(6));
        maxMeanErrorBytes = Math.max(maxMeanErrorBytes, Math.abs(summary.mean - tile.alphaByte));
        check(Math.abs(summary.mean - tile.alphaByte) <= 0.55,
          tile.label + "/" + style + ": mean alpha changed by " + (summary.mean - tile.alphaByte) + " bytes");
        if (style === "color" || q === 0 || q === 1) {
          check(summary.min === tile.alphaByte && summary.max === tile.alphaByte,
            tile.label + "/" + style + ": manufactured endpoint/missing texture");
        } else {
          const low = tile.alphaByte - amplitudeBytes * q;
          const high = tile.alphaByte + amplitudeBytes * (1 - q);
          check(summary.min >= Math.floor(low) - 1 && summary.max <= Math.ceil(high) + 1,
            tile.label + "/" + style + ": alpha exceeded bounded contrast");
          check(summary.max - summary.min > 20, tile.label + "/" + style + ": resolved pattern is absent");
        }
        rerenderDifferenceBytes = Math.max(rerenderDifferenceBytes, maximumDifference(pixels, read(style, tile)));
        if (tile.key === "MID") tiePixels.set(style, pixels);
        if (tile.key === "TIE") {
          const difference = maximumDifference(tiePixels.get(style), pixels, true);
          maxTieDifferenceBytes = Math.max(maxTieDifferenceBytes, difference);
          check(difference <= 1, style + ": equal-valued integer-phase tiles disagree");
        }
      }
      rows.push(row);
    }
    check(rerenderDifferenceBytes === 0, "Pattern phase changed on identical rerender");
    for (const style of ["color", "hatch", "woven"]) {
      const ordered = [0, 3, 4, 5, 6].map((index) => means[style][index]);
      check(ordered.every((value, i) => i === 0 || value > ordered[i - 1]), style + ": affine alpha order reversed");
      check(Math.abs(means[style][4] - means[style][7]) <= 0.55, style + ": equal source means diverged");
    }

    const contrastChecks = [];
    const half = tiles[4];
    const halfQ = (half.alphaByte - minimumByte) / (255 - minimumByte);
    for (const style of ["hatch", "woven"]) {
      const soft = summarize(read(style, half, 0.1));
      const amplitude = 0.1 * (255 - minimumByte);
      check(Math.abs(soft.mean - half.alphaByte) <= 0.55, style + ": .10 contrast shifted the mean");
      check(soft.min >= Math.floor(half.alphaByte - amplitude * halfQ) - 1 &&
        soft.max <= Math.ceil(half.alphaByte + amplitude * (1 - halfQ)) + 1 && soft.max - soft.min > 5,
      style + ": .10 contrast bounds or live uniform update failed");
      const zero = read(style, half, 0);
      const difference = maximumDifference(zero, read("color", half));
      check(difference === 0, style + ": zero contrast did not restore color control on the same material");
      contrastChecks.push({ style, contrast: 0.1, sourceAlpha: half.alphaByte / 255,
        meanAlpha: Number((soft.mean / 255).toFixed(6)), alphaByteRange: [soft.min, soft.max],
        zeroContrastDifferenceBytes: difference });
    }

    floorTexture = createChoroplethTexture(values, "#ffffff", countries, 0.5);
    material.map = floorTexture;
    const changedFloorByte = sourceByte(floorTexture, tiles[0]);
    check(changedFloorByte === 128, "Changed source floor is not quantized correctly");
    for (const style of ["color", "hatch", "woven"]) {
      const changed = summarize(read(style, tiles[0], 0.25, 0.5));
      check(changed.min === changedFloorByte && changed.max === changedFloorByte,
        style + ": same-material floor update left a stale minimum uniform");
    }
    material.map = texture;
    const restoredFloor = summarize(read("hatch", half));
    check(Math.abs(restoredFloor.min - (half.alphaByte - 0.25 * (half.alphaByte - minimumByte))) <= 1.5,
      "Restoring the original floor/contrast retained stale uniforms");

    // The same eight periods now occupy eight pixels: footprint=1 and detail must be zero.
    target.setSize(8, 8);
    let unresolvedDifferenceBytes = 0;
    for (const tile of tiles) {
      const color = read("color", tile);
      check(Math.abs(summarize(color).mean - tile.alphaByte) <= 0.5, "Unresolved fixture left its uniform country tile");
      for (const style of ["hatch", "woven"]) {
        unresolvedDifferenceBytes = Math.max(unresolvedDifferenceBytes,
          maximumDifference(color, read(style, tile)));
      }
    }
    check(unresolvedDifferenceBytes === 0, "Unresolved pattern does not return the color control");

    // Magnify one missing-data stripe to expose raster blur. Only its antialiased edge may blend.
    material.map = missingTexture;
    target.setSize(256, 256);
    const uv = geometry.getAttribute('uv');
    const centerU = (tiles[1].longitude + 180) / 360;
    for (let i = 0; i < uv.count; i++) uv.setXY(i,
      centerU + geometry.attributes.position.getX(i) * 6 / 2048,
      0.5 + geometry.attributes.position.getY(i) * 0.01 / 1024);
    uv.needsUpdate = true;
    applySocioeconomicPattern(material, 'color', minimum, 0.25, 'diagonal', missingMask);
    renderer.setRenderTarget(target); renderer.render(scene, camera);
    const missingPixels = new Uint8Array(256 * 256 * 4);
    renderer.readRenderTargetPixels(target, 0, 0, 256, 256, missingPixels);
    const missingSummary = summarize(missingPixels);
    check(missingSummary.max - missingSummary.min > 75, 'Crisp missing stripes absent');
    let blendedEdges = 0;
    for (let x = 0; x < 256; x++) {
      const alpha = missingPixels[(128 * 256 + x) * 4 + 3];
      if (alpha > missingSummary.min + 3 && alpha < missingSummary.max - 3) blendedEdges++;
    }
    check(blendedEdges <= 4, 'Missing stripe edge is raster blurred: ' + blendedEdges);
    check(shaderErrors.length === 0, 'Missing stripe shader failed');

    renderer.setRenderTarget(null);
    scene.remove(mesh);
    material.dispose(); material = null;
    geometry.dispose(); geometry = null;
    texture.dispose(); texture = null;
    legacyTexture.dispose(); legacyTexture = null;
    floorTexture.dispose(); floorTexture = null;
    missingTexture.dispose(); missingTexture = null;
    missingMask.dispose(); missingMask = null;
    target.dispose(); target = null;
    renderer.render(scene, camera);
    const afterDisposal = { ...renderer.info.memory };
    check(afterDisposal.textures === baseline.textures && afterDisposal.geometries === baseline.geometries,
      "Pattern probe leaked textures or geometry");
    return { passed: true, minimumAlpha: minimum, minimumByte, rows, legacyAlphaBytes: legacyBytes,
      resolved: { pixelsPerSide: 256, independentPeriodsPerAxis: periods, footprint: periods / 256 },
      unresolved: { pixelsPerSide: 8, footprint: 1, maximumByteDifference: unresolvedDifferenceBytes },
      maximumMeanErrorBytes: Number(maxMeanErrorBytes.toFixed(4)),
      maximumTieDifferenceBytes: maxTieDifferenceBytes, rerenderDifferenceBytes,
      contrastChecks, sameMaterialFloorUpdateByte: changedFloorByte, missingStripeBlendedPixels: blendedEdges,
      resources: { baseline, afterDisposal }, syntheticDataOnly: true };
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error), rows, shaderErrors };
  } finally {
    if (mesh && scene) scene.remove(mesh);
    renderer?.setRenderTarget(null);
    material?.dispose(); geometry?.dispose(); texture?.dispose(); legacyTexture?.dispose();
    floorTexture?.dispose(); missingTexture?.dispose(); missingMask?.dispose(); target?.dispose();
    renderer?.dispose(); renderer?.forceContextLoss();
  }
})()
