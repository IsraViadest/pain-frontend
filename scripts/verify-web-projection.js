/* Browser expression for the existing eval.mjs runner, using the v48 default. */
(async () => {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  try {
    for (let i = 0; i < 600 && !document.getElementById("country-profile"); i++) await sleep(100);
    const projection = new URL(location.href).searchParams.get("cpProjection") === "1";
    const app = document.getElementById("app");
    const card = document.getElementById("country-profile");
    check(card?.dataset.preset === "v48-a_web", "new default did not initialize: " +
      JSON.stringify({ preset: card?.dataset.preset, body: document.body.innerText.slice(-1500) }));
    const share = document.getElementById("ui-share-pain");
    const shareBox = share.getBoundingClientRect();
    check(shareBox.width > 0 && shareBox.height > 0, "share footprint collapsed");
    check(share.inert === projection, "projection survey remains interactive");
    check((getComputedStyle(share).opacity === "0") === projection, "share visibility wrong");
    check(Boolean(document.getElementById("festival-media")) !== projection, "festival mode wrong");
    check(!document.querySelector("video"), "video loaded without a source or intent");
    const buttons = [...document.querySelectorAll("#ui-layer-stack button")];
    check(buttons.length >= 5 && buttons.every((b) => b.textContent === b.textContent.toLowerCase()),
      "layer button text is not lowercase");
    const canvas = document.querySelector("canvas");
    const railBefore = document.getElementById("ui-layer-stack").getBoundingClientRect();
    const candidates = [...document.querySelectorAll(".emo-label")].filter((el) => {
      const r = el.getBoundingClientRect(), css = getComputedStyle(el);
      return r.left > innerWidth * .25 && r.right < innerWidth * .75 && r.top > 100 &&
        r.bottom < innerHeight - 120 && css.visibility === "visible" && Number(css.opacity) > .5;
    });
    let selected, selectedPoint;
    for (const el of candidates) {
      const r = el.getBoundingClientRect(), clientX = r.x + r.width / 2, clientY = r.y + r.height / 2;
      document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX, clientY }));
      canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX, clientY }));
      await sleep(80);
      if (!card.hidden) { selected = el.dataset.iso3; selectedPoint = { clientX, clientY }; break; }
    }
    check(selected, "no label click revealed a profile");
    await sleep(1400);
    canvas.dispatchEvent(new PointerEvent("pointermove", { ...selectedPoint, pointerType: "mouse" }));
    await sleep(150);
    check(canvas.style.cursor === "pointer", "label hover cursor absent");
    // At portrait zoom the globe can cover all four viewport corners. This ray must miss it.
    canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: -10000, clientY: -10000, pointerType: "mouse" }));
    await sleep(150);
    check(canvas.style.cursor === "default", "empty background has country cursor");
    canvas.dispatchEvent(new PointerEvent("pointerleave"));
    const country = card.querySelector(".country-profile__country").textContent;
    check(country && country === country.toLocaleLowerCase("en"), "country casing wrong");
    const railAfter = document.getElementById("ui-layer-stack").getBoundingClientRect();
    check(Math.abs(railBefore.bottom - railAfter.bottom) < 1, "selection moved button rail");
    let gdpCountries;
    if (!new URL(location.href).searchParams.has("testBundled")) {
      const { loadGdpPerCapita } = await import("/src/countryProfile/gdpPerCapita.ts");
      const gdp = (await loadGdpPerCapita()).sort((a, b) => a.metadata.rawValue - b.metadata.rawValue);
      check(gdp[0].intensity === 1 && gdp.at(-1).intensity === 0,
        "GDP min is not brightest or max is not darkest");
      check(gdp.every((p, i) => !i || p.intensity <= gdp[i - 1].intensity), "GDP order changed");
      gdpCountries = gdp.length;
    }
    buttons.find((b) => b.textContent.trim() === "socio-economic pain").click();
    await sleep(1800);
    const svg = document.querySelector("#ui-legend svg");
    check(svg?.textContent.includes("wealth (GDP)"), "GDP title absent");
    const min = [...svg.querySelectorAll("text")].find((x) => x.textContent === "min");
    const max = [...svg.querySelectorAll("text")].find((x) => x.textContent === "max");
    check(Number(min.getAttribute("y")) < Number(max.getAttribute("y")), "min is not above bright end");
    check(document.documentElement.scrollWidth <= innerWidth, "horizontal overflow");
    return { passed: true, projection, selected, country, gdpCountries,
      railDelta: railAfter.bottom - railBefore.bottom, shareFootprint: [shareBox.width, shareBox.height],
      drawingBuffer: [canvas.width, canvas.height], viewport: [innerWidth, innerHeight],
      quality: app.dataset.cpQuality, detailBytes: app.dataset.cpDetailBytes,
      budgetExceeded: app.dataset.cpBudgetExceeded };
  } catch (error) { return { passed: false, error: String(error) }; }
})()
