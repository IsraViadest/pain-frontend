/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/* Existing eval.mjs expression: real source rows, actual field builders, CPU timing and byte hashes.
 * Load cp=1 first. No registration, scene changes, GPU upload or per-frame instrumentation.
 */
(async () => {
  try {
    const source = performance.getEntriesByType("resource")
      .find((entry) => new URL(entry.name).pathname === "/src/api/client.ts")?.name;
    if (!source) throw Error("Loaded API client URL is unavailable");
    const { fetchPoints } = await import(source);
    const { createPainHeatTexture } = await import("/src/globe/painHeatField.ts");
    const { createPainScarDisplacementTexture } = await import("/src/globe/painScarField.ts");
    const temperature = await import("/src/globe/temperatureHazeField.ts");
    const co2 = await import("/src/globe/co2HazeField.ts");
    const layers = {};
    for (const id of ["emopain", "envpain", "physpain", "socioecopain"]) layers[id] = await fetchPoints(id);
    const all = Object.values(layers).flat();
    const hash = async (bytes) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
    // The adapter adds a new createdAt timestamp on each fetch; it is not a field input.
    const inputHash = await hash(new TextEncoder().encode(JSON.stringify(layers,
      (key, value) => key === "createdAt" ? undefined : value)));
    const cases = [
      ["physical-scars", () => createPainScarDisplacementTexture(layers.physpain, "physpain", {
        roundedShoulder: true, stampRadiusMin: 1, stampRadiusMul: 0.15, stampPeakMul: 0.35,
        falloffSigma: 1.05, blurPass1Radius: 4, blurPass2Radius: 1 })],
      ["physical-heat", () => createPainHeatTexture(layers.physpain)],
      ["all-pain-heat", () => createPainHeatTexture(all)],
      ["temperature", () => temperature.createTemperatureHazeTexture(
        temperature.filterTemperatureHazePoints(layers.envpain), {
          ...temperature.TEMPERATURE_HAZE_TUNE_DEFAULTS, stampRadiusBase: 16, stampRadiusSpan: 12,
          blurPass1Radius: 4, blurPass2Radius: 1 })],
      ["co2", () => co2.createCo2HazeTexture(co2.filterCo2HazePoints(layers.envpain))],
    ];
    const rows = [];
    for (const [name, build] of cases) {
      const times = [];
      let digest, bytes;
      for (let sample = 0; sample < 4; sample++) {
        const started = performance.now();
        const texture = build();
        const elapsed = performance.now() - started;
        try {
          if (sample > 0) times.push(elapsed);
          if (sample === 3) { bytes = texture.image.data.byteLength; digest = await hash(texture.image.data); }
        } finally { texture.dispose(); }
        await new Promise(requestAnimationFrame);
      }
      times.sort((a, b) => a - b);
      rows.push({ name, medianMs: Number(times[1].toFixed(2)), maxMs: Number(times[2].toFixed(2)), bytes, hash: digest });
    }
    return { passed: true, inputHash, points: Object.fromEntries(Object.entries(layers).map(([key, value]) => [key, value.length])),
      rows, scope: "CPU field construction only, without texture upload or compositor timing" };
  } catch (error) { return { passed: false, error: String(error.stack ?? error) }; }
})()
