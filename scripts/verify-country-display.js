/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/* Existing eval.mjs browser expression: shared display consumers and projected edge bounds. */
(async () => {
  const disposable = [];
  try {
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const geo = await import("/src/globe/countryGeometry.ts");
    const { buildCountryDisplayGeometry } = await import("/src/globe/countryDisplayGeometry.ts");
    const { createPainScarDisplacementTexture } = await import("/src/globe/painScarField.ts");
    const { GLOBE_DEBUG_TUNE_DEFAULTS: tune } = await import("/src/globe/GlobeView.ts");
    const { fetchLayerDataPoints } = await import("/src/api/painServer.ts");
    const { mapInitResponseToPainPoints } = await import("/src/api/adapter.ts");
    const { loadGlobeBorderOutlines } = await import("/src/globe/countryBorders.ts");
    const { createEarthStippleGlobe } = await import("/src/globe/earthStippleGlobe.ts");
    const { latLngToVector3 } = await import("/src/globe/latLng.ts");
    await geo.ensureCountryGeometriesLoaded();
    const canonical = geo.getCountryGeometries();
    const points = mapInitResponseToPainPoints(await fetchLayerDataPoints("physpain"), "physpain");
    const map = createPainScarDisplacementTexture(points, "physpain", {
      roundedShoulder: true, stampRadiusMin: tune.scarStampRadiusMin,
      stampRadiusMul: tune.scarStampRadiusMul, stampPeakMul: tune.scarStampPeakMul,
      falloffSigma: tune.scarFalloffSigma, blurPass1Radius: tune.scarBlurPass1Radius,
      blurPass2Radius: tune.scarBlurPass2Radius,
    });
    disposable.push(map);
    const { data, width: w, height: h } = map.image;
    const byte = (x, y) => data[Math.max(0, Math.min(h - 1, y)) * w + ((x % w) + w) % w];

    // Global perspective Jacobian bound over a radius-1.01 ball, at the closest camera.
    // It bounds every orientation, including limb views, for H<=950 and FOV>=45 degrees.
    const D = 1.35, R = 1.01, focal = 950 / (2 * Math.tan(Math.PI / 8));
    const projection = focal * 9 * D * D / (4 * Math.sqrt(3) * (D * D - R * R) ** 1.5);
    const rows = [];
    let rounded;
    for (const degrees of [0, 0.0025, 0.005]) {
      const started = performance.now();
      const display = buildCountryDisplayGeometry(canonical, degrees);
      const buildMs = performance.now() - started;
      let pixelBound = 0;
      // Each group is a five-point polyline mapped to the original two straight edges.
      // Their coordinate difference is linear on each interval, so endpoint maxima bound it.
      for (let corner = 0; corner < display.displacementPairs.length; corner += 5) {
        for (let step = 0; step < 4; step++) {
          const pair = display.displacementPairs.slice(corner + step, corner + step + 2);
          const positions = pair.flatMap((p) => [p.source, p.display]);
          const xs = positions.map((p) => (p[0] + 180) / 360 * w - 0.5);
          const ys = positions.map((p) => (90 - p[1]) / 180 * h - 0.5);
          let gradientX = 0, gradientY = 0;
          for (let y = Math.floor(Math.min(...ys)); y <= Math.floor(Math.max(...ys)); y++) {
            for (let x = Math.floor(Math.min(...xs)); x <= Math.floor(Math.max(...xs)); x++) {
              gradientX = Math.max(gradientX, Math.abs(byte(x + 1, y) - byte(x, y)),
                Math.abs(byte(x + 1, y + 1) - byte(x, y + 1)));
              gradientY = Math.max(gradientY, Math.abs(byte(x, y + 1) - byte(x, y)),
                Math.abs(byte(x + 1, y + 1) - byte(x + 1, y)));
            }
          }
          const dx = Math.max(...pair.map((p) => Math.abs(p.source[0] - p.display[0])));
          const dy = Math.max(...pair.map((p) => Math.abs(p.source[1] - p.display[1])));
          const radial = 0.4 / 255 * (gradientX * w / 360 * dx + gradientY * h / 180 * dy);
          const world = R * Math.PI / 180 * Math.hypot(dx, dy) + radial;
          pixelBound = Math.max(pixelBound, projection * world);
        }
      }
      rows.push({ degrees, buildMs, pixelBound, ...display.stats });
      if (degrees === 0.005) rounded = display;
    }
    const borders = await loadGlobeBorderOutlines("/borders/", 1, new THREE.Vector2(1500, 950));
    disposable.push(borders);
    const count = () => borders.group.children.reduce((n, line) =>
      n + line.geometry.attributes.instanceStart.count, 0);
    const original = count();
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(32, 32, false);
    disposable.push(renderer);
    const scene = new THREE.Scene();
    scene.add(borders.group);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
    camera.position.z = 3;
    renderer.render(scene, camera);
    const gl = renderer.getContext(), draw = gl.drawElementsInstanced.bind(gl);
    let drawnSegments = 0;
    gl.drawElementsInstanced = (...args) => { drawnSegments += args[4]; return draw(...args); };
    borders.setDisplayPaths(rounded);
    const expected = [...rounded.coastLines, ...rounded.borderLines]
      .reduce((n, path) => n + path.length - 1, 0);
    if (count() !== expected) throw Error("display paths lost border segments");
    renderer.render(scene, camera);
    gl.drawElementsInstanced = draw;
    if (drawnSegments !== expected) throw Error(`rendered ${drawnSegments} of ${expected} border segments`);

    // Compare the actual Float32 scar-warped chords, including changed subdivision stations.
    // Both paths are linear between their joint station breakpoints; endpoint distance bounds
    // the complete corresponding interval, not just a sparse set of projected screenshots.
    const straight = buildCountryDisplayGeometry(canonical, 0);
    const pointKey = (point) => point.join(",");
    const sourceByDisplay = new Map(rounded.displacementPairs.map((p) => [pointKey(p.display), p.source]));
    const span = (a, b) => [((b[0] - a[0] + 540) % 360) - 180, b[1] - a[1]];
    const pathStations = (path) => {
      const stations = [0];
      for (let i = 1; i < path.length; i++) {
        stations.push(stations.at(-1) + Math.hypot(...span(path[i - 1], path[i])));
      }
      return stations;
    };
    const sourceStation = (point, path, stations) => {
      let best = Infinity, at = 0;
      for (let i = 1; i < path.length; i++) {
        const d = span(path[i - 1], path[i]), p = span(path[i - 1], point);
        const length2 = d[0] ** 2 + d[1] ** 2;
        const t = Math.max(0, Math.min(1, (p[0] * d[0] + p[1] * d[1]) / length2));
        const distance = Math.hypot(p[0] - t * d[0], p[1] - t * d[1]);
        if (distance < best) { best = distance; at = stations[i - 1] + t * Math.sqrt(length2); }
      }
      if (best > 1e-7) throw Error("fillet correspondence left its source path: " + best);
      return at;
    };
    const samples = (paths, sourcePaths, group) => paths.map((path, pathIndex) => {
      const originalPath = sourcePaths[pathIndex];
      const originalStations = pathStations(originalPath), length = originalStations.at(-1);
      const closed = pointKey(originalPath[0]) === pointKey(originalPath.at(-1));
      const unchanged = path.length === originalPath.length && path.every((point, i) =>
        pointKey(point) === pointKey(originalPath[i]));
      const stations = unchanged ? originalStations : path.map((point) => sourceStation(
        sourceByDisplay.get(pointKey(point)) ?? point, originalPath, originalStations));
      for (let i = 1; i < stations.length; i++) {
        if (closed && stations[i] < stations[i - 1] - 1e-7) stations[i] += length;
        if (stations[i] < stations[i - 1] - 1e-7) throw Error("source station reversed " +
          JSON.stringify({ pathIndex, i, closed, length, previous: stations[i - 1],
            station: stations[i], point: path[i], source: sourceByDisplay.get(pointKey(path[i])) }));
      }
      const values = [];
      for (let i = 1; i < path.length; i++) {
        const a = latLngToVector3(path[i - 1][1], path[i - 1][0], 1);
        const b = latLngToVector3(path[i][1], path[i][0], 1);
        const steps = Math.max(1, Math.ceil(THREE.MathUtils.radToDeg(a.angleTo(b)) / 0.01));
        if (i === 1) values.push({ s: stations[0], p: new THREE.Vector3()
          .fromBufferAttribute(group.attributes.instanceStart, group.cursor) });
        for (let step = 1; step <= steps; step++) {
          values.push({ s: THREE.MathUtils.lerp(stations[i - 1], stations[i], step / steps),
            p: new THREE.Vector3().fromBufferAttribute(group.attributes.instanceEnd, group.cursor++) });
        }
      }
      return { values, length, closed };
    });
    const readSamples = (display) => [display.coastLines, display.borderLines].flatMap((paths, i) =>
      samples(paths, [straight.coastLines, straight.borderLines][i],
        { attributes: borders.group.children[i].geometry.attributes, cursor: 0 }));
    borders.setMaxSegmentDegrees(0.01);
    let chordPixelBound = 0;
    for (const scar of [null, map]) {
      borders.setScarDisplacementMap(scar, 0.4, -0.2);
      borders.setDisplayPaths(straight);
      const controlPaths = readSamples(straight);
      borders.setDisplayPaths(rounded);
      const displayPaths = readSamples(rounded);
      displayPaths.forEach(({ values, length, closed }, pathIndex) => {
        let control = controlPaths[pathIndex].values;
        if (closed) control = [...control, ...control.slice(1).map((v) => ({ s: v.s + length, p: v.p }))];
        let cursor = 0;
        const at = (s) => {
          while (cursor < control.length - 2 && control[cursor + 1].s < s - 1e-8) cursor++;
          const a = control[cursor], b = control[cursor + 1];
          return a.p.clone().lerp(b.p, (s - a.s) / (b.s - a.s));
        };
        for (let i = 1; i < values.length; i++) {
          const a = values[i - 1], b = values[i];
          at(a.s);
          const knots = [a.s];
          for (let k = cursor + 1; k < control.length && control[k].s < b.s; k++) {
            if (control[k].s > a.s) knots.push(control[k].s);
          }
          knots.push(b.s);
          for (const s of knots) {
            const displayed = a.p.clone().lerp(b.p, (s - a.s) / (b.s - a.s || 1));
            chordPixelBound = Math.max(chordPixelBound, projection * displayed.distanceTo(at(s)));
          }
        }
      });
    }
    const fineSegments = count();
    borders.setMaxSegmentDegrees(Infinity);
    borders.setDisplayPaths(null);
    if (count() !== original) throw Error("historical border paths not restored");
    const stipple = await createEarthStippleGlobe(1, 82000,
      "/borders/ne_110m_admin_0_countries.geojson?v=4", new THREE.Vector3(1, 1, 1),
      new THREE.Vector3(), new THREE.Vector3(1, 0, 0), 1, 1);
    disposable.push(stipple);
    const land = stipple.points.geometry.getAttribute("aLand");
    const before = land.array.slice();
    stipple.setDisplayCountries(rounded.countries);
    let changed = 0;
    for (let i = 0; i < before.length; i++) if (before[i] !== land.array[i]) changed++;
    stipple.setDisplayCountries(null);
    if (before.some((value, i) => value !== land.array[i])) throw Error("original land not restored");
    if (canonical !== geo.getCountryGeometries()) throw Error("canonical source changed");
    const maximum = Math.max(chordPixelBound, ...rows.map((row) => row.pixelBound));
    return { passed: maximum <= 1, rows, chordPixelBound, pixelBoundPass: maximum <= 1,
      cameraEnvelope: { minDistance: D, maxRadius: R, maxCssHeight: 950, minFov: 45 },
      originalSegments: original, sharedRoundedSegments: expected, changedStippleLand: changed,
      drawnSegments,
      fineSegments,
      dataPoints: points.length };
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error) };
  } finally {
    for (const resource of disposable) resource.dispose();
  }
})()
