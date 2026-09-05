/*
 * Vite browser expression for artifacts/emo-views/eval.mjs at each compact preset and viewport.
 * Synthetic values exercise the real profile view with every real country/native term.
 * This measures layout and encoding, not the real countries' pain values.
 */
(async () => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  let view, host;
  try {
    const { loadEmoData } = await import("/src/emo/emoData.ts");
    const { createCountryProfileView } = await import("/src/countryProfile/profile.ts");
    const { resolveCountryProfilePreset } = await import("/src/countryProfile/presets.ts");
    const data = await loadEmoData();
    const preset = resolveCountryProfilePreset();
    const requestedTheme = new URL(location.href).searchParams.get("testTheme");
    if (requestedTheme && document.documentElement.dataset.theme !== requestedTheme) {
      document.querySelector("#theme-toggle").click();
    }
    if (requestedTheme) check(document.documentElement.dataset.theme === requestedTheme,
      "requested theme did not apply");
    const categories = new Map(data.categories.map((x) => [x.key, x.label]));
    host = document.createElement("div");
    document.body.append(host);
    view = createCountryProfileView(host, "all-layers", preset);
    const card = host.querySelector(".country-profile");
    await document.fonts.ready;
    let largestHeight = 0, longest = "", largestAlignmentError = 0;
    let largestPaintedGapError = 0, largestEnglishCenterError = 0;
    for (const [iso3, c] of Object.entries(data.countries)) {
      const profile = {
        iso3, countryName: c.name,
        emotional: { nativeTerm: c.term || categories.get(c.cat), englishTerm: categories.get(c.cat),
          categoryKey: c.cat, language: c.lang, script: c.script, value: c.score },
        temperature: { value: 0.5, pointCount: 1 }, co2: { value: 0.5, pointCount: 1 },
        physical: { value: 0.5, pointCount: 1 }, socioeconomic: { value: 0.5, pointCount: 1 },
      };
      view.setProfile(profile);
      const rect = card.getBoundingClientRect();
      const native = card.querySelector(".country-profile__native").getBoundingClientRect();
      check(rect.left >= 8 && rect.right <= innerWidth - 8, iso3 + ": card overflows");
      check(native.left >= 0 && native.right <= innerWidth, iso3 + ": native term outside viewport");
      check(native.height > 0, iso3 + ": missing native text");
      for (const id of ["ui-title", "ui-share-pain", "ui-bottom-left"]) {
        const r = document.getElementById(id).getBoundingClientRect();
        const overlaps = rect.left < r.right && rect.right > r.left &&
          rect.top < r.bottom && rect.bottom > r.top;
        check(!overlaps, iso3 + ": profile overlaps " + id);
      }
      const centers = [...card.querySelectorAll("[data-indicator]")].map((element) => {
        const r = element.getBoundingClientRect(); return r.y + r.height / 2;
      });
      const error = Math.max(...centers) - Math.min(...centers);
      largestAlignmentError = Math.max(largestAlignmentError, error);
      check(error < 1, iso3 + ": indicators misaligned");
      const slots = [...card.querySelectorAll("[data-indicator]")]
        .map((x) => x.getBoundingClientRect());
      if (preset.profileSpacing === "painted-n") {
        const horizontal = (nodes) => {
          const rects = nodes.flatMap((node) => {
            const r = node.getBoundingClientRect(), style = getComputedStyle(node);
            return style.display !== "none" && style.visibility !== "hidden" && r.width > 0 ? [r] : [];
          });
          return { left: Math.min(...rects.map((r) => r.left)),
            right: Math.max(...rects.map((r) => r.right)) };
        };
        const englishNode = card.querySelector(".country-profile__english");
        const terms = horizontal([card.querySelector(".country-profile__native"), englishNode]);
        const borders = ["environmental", "physical", "socioeconomic"].map((key) => horizontal(
          [...card.querySelector('[data-indicator="' + key + '"]').querySelectorAll(
            ".country-profile__outline, .country-profile__empty-outline")]
            .filter((node) => getComputedStyle(node).display !== "none"),
        ));
        const edges = [terms, ...borders];
        const gaps = edges.slice(1).map((edge, index) => edge.left - edges[index].right);
        const target = Number.parseFloat(card.style.getPropertyValue("--cp-painted-gap"));
        const gapError = Math.max(...gaps.map((gap) => Math.abs(gap - target)));
        largestPaintedGapError = Math.max(largestPaintedGapError, gapError);
        check(gapError < 1, iso3 + ": painted gaps differ from rendered n width");
        if (preset.centerEnglishTerm && getComputedStyle(englishNode).display !== "none") {
          const english = englishNode.getBoundingClientRect();
          const centerError = Math.abs(english.left + english.width / 2 - native.left - native.width / 2);
          largestEnglishCenterError = Math.max(largestEnglishCenterError, centerError);
          check(centerError < 1, iso3 + ": English term not centered beneath native term");
        }
        check(getComputedStyle(card.querySelector(".country-profile__native")).textAlign === "right",
          iso3 + ": native term is not right-aligned");
      } else {
        const gaps = slots.slice(1).map((r, i) => r.left - slots[i].right);
        check(Math.max(...gaps) - Math.min(...gaps) < 1, "unequal indicator-slot spacing");
        check(Math.max(...slots.map((r) => r.width)) - Math.min(...slots.map((r) => r.width)) < 1,
          "unequal indicator-slot widths");
      }
      for (const key of ["environmental", "physical"]) {
        const slot = card.querySelector('[data-indicator="' + key + '"]');
        const s = slot.getBoundingClientRect(), glyph = slot.querySelector("svg").getBoundingClientRect();
        check(Math.abs(s.x + s.width / 2 - glyph.x - glyph.width / 2) < 1,
          key + ": glyph not centered in its slot");
      }
      if (rect.height > largestHeight) { largestHeight = rect.height; longest = iso3; }
      if (innerWidth <= 768) {
        check(getComputedStyle(card.querySelector(".country-profile__english")).display === "none",
          "mobile English still visible");
      }
    }
    const c = data.countries.IND;
    const fixture = {
      iso3: "IND", countryName: c.name,
      emotional: { nativeTerm: c.term, englishTerm: "Uncertainty", language: c.lang,
        script: c.script, value: c.score },
      temperature: { value: 1, pointCount: 1 }, co2: { value: null, pointCount: 0 },
      physical: { value: 1, pointCount: 1 }, socioeconomic: { value: 0, pointCount: 1 },
    };
    view.setProfile(fixture);
    const environment = card.querySelector('[data-indicator="environmental"]');
    check(getComputedStyle(environment.querySelector(".country-profile__outline")).display ===
      "none", "missing CO2 still has a band");
    check(environment.getAttribute("aria-label").includes("CO2: data unavailable"),
      "missing CO2 not described");
    check(card.querySelector('[data-indicator="physical"] .country-profile__fill')
      .style.fill.includes("physical-dots"), "physical fill not dotted");
    const fill = card.querySelector('[data-indicator="physical"] .country-profile__fill');
    check(Number(fill.style.transform.match(/[0-9.]+/)[0]) === (preset.glyphInset ?? 0.88),
      "inset broke proportional scale");
    fixture.temperature = { value: null, pointCount: 0 };
    view.setProfile(fixture);
    check(getComputedStyle(environment.querySelector(".country-profile__empty-outline")).display !==
      "none", "fully unavailable environmental glyph vanished");
    fixture.co2 = { value: 0, pointCount: 1 };
    view.setProfile(fixture);
    check(Number(environment.querySelector(".country-profile__co2").style.opacity) === 0.1,
      "true zero lost its faint ring");
    for (const layer of ["envpain", "physpain", "socioecopain", "emopain", "all-layers"]) {
      view.setLayer(layer);
      await new Promise((resolve) => setTimeout(resolve, 270));
      const visible = [...card.querySelectorAll("[data-indicator]")].filter((x) => !x.hidden);
      check(visible.length === (layer === "all-layers" ? 4 : 1), "wrong layer indicators: " + layer);
      if (layer !== "all-layers") {
        const r = visible[0].getBoundingClientRect();
        check(Math.abs(r.x + r.width / 2 - innerWidth / 2) < 1, "single item off-center: " + layer);
      }
    }
    const result = { passed: true, preset: preset.id, width: innerWidth,
      theme: document.documentElement.dataset.theme, countries: 195,
      cardWidth: card.getBoundingClientRect().width, largestHeight, longest,
      largestAlignmentError, largestPaintedGapError, largestEnglishCenterError,
      independentMissingness: true, layerCenters: true };
    return result;
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error) };
  } finally {
    view?.destroy();
    host?.remove();
  }
})()
