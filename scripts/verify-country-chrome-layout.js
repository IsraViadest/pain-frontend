/* Vite expression for eval.mjs. Use cp=1, a generated-legend preset, cpTimeScale=.01. */
(async () => {
  const stages = [];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const describe = (node) => {
    const r = node.getBoundingClientRect(), style = getComputedStyle(node);
    const painted = r.width > 0 && r.height > 0 && style.display !== "none" &&
      style.visibility !== "hidden" && Number(style.opacity) > 0;
    return { rect: [r.x, r.y, r.width, r.height], painted,
      visible: painted && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight };
  };
  const capture = (stage) => {
    const entries = [
      ["title", document.querySelector("#ui-title")],
      ["cycle", document.querySelector("#country-presentation-toggle")],
      ["menu", document.querySelector('.ui-hamburger[aria-label="Toggle menu"]')],
      ["layerPicker", document.querySelector("#ui-layer-stack")],
      ["share", document.querySelector("#ui-share-pain")],
      ["legend", document.querySelector("#ui-legend")],
      ["emotionalLegend", document.querySelector("#emo-legend")],
      ["about", document.querySelector("#ui-bottom-left")],
      ["profile", document.querySelector("#country-profile")],
      ["native", document.querySelector("#country-profile .country-profile__native")],
      ...[...document.querySelectorAll("#ui-layer-stack button")].map((node) => [node.dataset.layer, node]),
    ].filter(([, node]) => node);
    const elements = Object.fromEntries(entries.map(([name, node]) => [name, describe(node)]));
    const overlaps = [];
    for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
      const [a, an] = entries[i], [b, bn] = entries[j];
      if (!elements[a].visible || !elements[b].visible || an.contains(bn) || bn.contains(an)) continue;
      const [ax, ay, aw, ah] = elements[a].rect, [bx, by, bw, bh] = elements[b].rect;
      const width = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
      const height = Math.min(ay + ah, by + bh) - Math.max(ay, by);
      if (width > 0 && height > 0) overlaps.push([a, b]);
    }
    const outOfViewport = Object.entries(elements).filter(([, item]) => {
      const [x, y, w, h] = item.rect;
      return item.painted && (x < 0 || y < 0 || x + w > innerWidth || y + h > innerHeight);
    }).map(([name]) => name);
    const textWidths = [...document.querySelectorAll(
      ".ui-title__heading, .ui-title__subtitle, .ui-title__toggles button, .blob-button__label, " +
      "#ui-legend text, .emo-legend__item, .country-profile__country, .country-profile__native",
    )].flatMap((node) => {
      const item = describe(node);
      const text = (node.innerText ?? node.textContent ?? "").trim().replace(/\s+/g, " ");
      return item.visible && text ? [[text.slice(0, 80), Math.round(item.rect[2] * 10) / 10]] : [];
    });
    const legend = document.querySelector("#ui-legend");
    const rects = Object.fromEntries(Object.entries(elements).filter(([, item]) => item.visible)
      .map(([name, item]) => [name, item.rect.map((value) => Math.round(value * 10) / 10)]));
    stages.push({ stage, rects, overlaps, outOfViewport, textWidths,
      menuOpen: document.querySelector(".ui-hamburger")?.getAttribute("aria-expanded"),
      legendKind: legend?.querySelector("svg") ? "generated-svg" : legend?.querySelector("img") ? "image" : null,
      legendImage: legend?.querySelector("img")?.getAttribute("src") ?? null });
  };
  const wait = async (predicate, message) => {
    for (let attempt = 0; attempt < 480; attempt++) {
      if (predicate()) return;
      await sleep(25);
    }
    throw Error(message);
  };
  try {
    await document.fonts.ready;
    capture("initial");
    const canvas = document.querySelector("#globe"), profile = document.querySelector("#country-profile");
    const cycle = document.querySelector("#country-presentation-toggle");
    const menu = document.querySelector('.ui-hamburger[aria-label="Toggle menu"]');
    const environmental = document.querySelector('#ui-layer-stack button[data-layer="envpain"]');
    check(canvas && profile && cycle && menu && environmental, "Country-profile chrome is unavailable");
    if (profile.hidden) {
      cycle.click();
      await wait(() => cycle.dataset.state === "dwelling", "Cycle did not select a country; use cpTimeScale=.01");
      canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 0 }));
      await sleep(100);
    }
    capture("country-selected");
    if (!describe(environmental).visible) {
      check(describe(menu).visible, "Layer picker is hidden and its menu control is unavailable");
      menu.click();
      await sleep(450);
      capture("picker-open-for-selection");
    }
    environmental.click();
    const legend = document.querySelector("#ui-legend");
    await wait(() => legend.dataset.layer === "envpain" && legend.querySelector("svg") &&
      legend.classList.contains("legend--visible"), "Environmental generated SVG did not appear");
    await sleep(450);
    capture("environmental");
    check(describe(menu).visible, "Mobile layer-menu control is unavailable at this viewport");
    menu.click();
    await sleep(450);
    capture("menu-open");
    check(menu.getAttribute("aria-expanded") === "true" &&
      document.querySelector("#app").classList.contains("mobile-menu-open"), "Actual menu did not open");
    menu.click();
    await sleep(450);
    capture("menu-closed");
    check(menu.getAttribute("aria-expanded") === "false", "Actual menu did not close");
    check(legend.dataset.layer === "envpain" && legend.querySelector("svg") &&
      !legend.querySelector("img") && legend.classList.contains("legend--visible"),
    "Closing the layer menu replaced or lost the generated environmental SVG");
    return { passed: true, viewport: [innerWidth, innerHeight], menuRoundTripPreservedSvg: true, stages };
  } catch (error) {
    capture("failure");
    return { passed: false, viewport: [innerWidth, innerHeight],
      error: error instanceof Error ? error.stack : String(error), stages };
  }
})()
