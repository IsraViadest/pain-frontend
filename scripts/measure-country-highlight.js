/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/* CPU-only Vite expression: node ../../artifacts/emo-views/eval.mjs <url> 1200 < this-file */
(async () => {
  const results = [];
  let currentCase = "loading";
  try {
    const { createCountryHighlightTexture } = await import("/src/globe/choroplethField.ts");
    const geo = await import("/src/globe/countryGeometry.ts");
    const centroids = await import("/src/api/countryCentroids.ts");
    const { loadEmoData } = await import("/src/emo/emoData.ts");
    const [data] = await Promise.all([
      loadEmoData(), geo.ensureCountryGeometriesLoaded(), centroids.ensureCountryCentroidsLoaded(),
    ]);
    const countries = geo.getCountryGeometries();
    if (!countries.length || !geo.hasCountryGeometry("IND") || !data.countries.IND) {
      throw Error("Actual India geometry/category is unavailable");
    }
    const category = data.countries.IND.cat;
    const members = Object.entries(data.countries).filter(([, value]) => value.cat === category)
      .map(([iso3]) => iso3);
    const weights = (peer) => new Map(members.map((iso3) => [iso3, iso3 === "IND" ? 1 : peer]));
    const cases = [
      { name: "IND-origin-only", members: ["IND"], strengths: new Map([["IND", 1]]) },
      { name: "IND-category-peers-0.5", members, strengths: weights(0.5) },
      { name: "IND-category-all-1", members, strengths: weights(1) },
      { name: "IND-exact-red-white-outline", members: ["IND"], strengths: new Map([["IND", 1]]),
        color: "#ff0000", fill: 0.18, outline: "#ffffff" },
      { name: "IND-category-legacy", members },
      { name: "IND-zero-weights", members: ["IND"], strengths: new Map([["IND", 0]]) },
    ];
    const warmups = 2, sampleCount = 5;
    const median = (values) => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
    for (const test of cases) {
      currentCase = test.name;
      const markers = test.members.filter((iso3) => !geo.hasCountryGeometry(iso3)).flatMap((iso3) => {
        const point = centroids.getCountryCentroid(iso3);
        return point ? [{ ...point, strength: test.strengths?.get(iso3) ?? 1 }] : [];
      });
      const samples = [];
      let output;
      for (let iteration = 0; iteration < warmups + sampleCount; iteration++) {
        await new Promise(requestAnimationFrame);
        const sample = { cpuMs: 0, readbackMs: 0, readbackBytes: 0, readbacks: 0 };
        const prototype = CanvasRenderingContext2D.prototype;
        const original = prototype.getImageData;
        let texture;
        try {
          // Patch only this synchronous builder call, never across an animation frame or hash.
          prototype.getImageData = function (...args) {
            const start = performance.now();
            const image = original.apply(this, args);
            sample.readbackMs += performance.now() - start;
            sample.readbackBytes += image.data.byteLength;
            sample.readbacks++;
            return image;
          };
          const start = performance.now();
          try {
            texture = createCountryHighlightTexture(test.members, test.color ?? "#ffffff",
              test.fill ?? 0.35, 2, markers, 0.9, countries, test.strengths, test.outline);
          } finally {
            sample.cpuMs = performance.now() - start;
            prototype.getImageData = original;
          }
          if (!texture && test.name !== "IND-zero-weights") throw Error("Nonempty case returned no texture");
          if (iteration >= warmups) samples.push(sample);
          if (iteration === warmups + sampleCount - 1) {
            const bytes = texture ? texture.image.data : new Uint8Array(0);
            const digest = await crypto.subtle.digest("SHA-256", bytes);
            output = { returnedNull: texture === null,
              dimensions: texture ? [texture.image.width, texture.image.height] : null,
              rgbaBytes: bytes.byteLength,
              sha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("") };
          }
        } finally {
          texture?.dispose();
        }
      }
      results.push({ name: test.name, members: test.members.length, markers: markers.length,
        weights: test.strengths ? [...new Set(test.strengths.values())] : "legacy",
        fill: test.fill ?? 0.35, color: test.color ?? "#ffffff", outline: test.outline ?? test.color ?? "#ffffff",
        cpuMedianMs: median(samples.map((sample) => sample.cpuMs)),
        cpuMaxMs: Math.max(...samples.map((sample) => sample.cpuMs)),
        readbackMedianMs: median(samples.map((sample) => sample.readbackMs)), samples, output });
    }
    return { passed: true, measurement: "CPU raster/readback only; no GPU upload timing",
      viewport: [innerWidth, innerHeight], category, categoryMembers: members,
      geometryCountries: countries.length, warmups, sampleCount, outlineWidth: 2, markerRadius: 0.9, results };
  } catch (error) {
    return { passed: false, measurement: "CPU raster/readback only", currentCase,
      error: error instanceof Error ? error.stack : String(error), results };
  }
})()
