/* Vite expression for eval.mjs. Use cp=1, a generated-legend preset, cpTimeScale=.01. */
(async () => {
  const stages = [];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const describe = (node) => {
    const r = node.getBoundingClientRect(), style = getComputedStyle(node);
    const painted = r.width > 0 && r.height > 0 && style.display !== "none" &&
      style.visibility !== "hidden" && Number(style.opacity) > 0;
    const picker = node.closest("#ui-layer-stack, #emo-legend");
    const clipped = picker && picker !== node && getComputedStyle(picker).overflowY === "auto";
    const clip = clipped ? picker.getBoundingClientRect() : r;
    const x = Math.max(r.left, clip.left), y = Math.max(r.top, clip.top);
    const right = Math.min(r.right, clip.right), bottom = Math.min(r.bottom, clip.bottom);
    return { rect: [r.x, r.y, r.width, r.height], paintRect: [x, y, right - x, bottom - y], painted, clipped,
      visible: painted && right > x && bottom > y && right > 0 && x < innerWidth && bottom > 0 && y < innerHeight };
  };
  const pointerClick = (node) => {
    const r = node.getBoundingClientRect();
    node.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true,
      clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerType: "mouse" }));
    node.click();
  };
  const intersects = (a, b) => {
    if (!a || !b) return false;
    const first = describe(a), second = describe(b);
    if (!first.visible || !second.visible) return false;
    const [ax, ay, aw, ah] = first.paintRect, [bx, by, bw, bh] = second.paintRect;
    return Math.min(ax + aw, bx + bw) - Math.max(ax, bx) > 1 &&
      Math.min(ay + ah, by + bh) - Math.max(ay, by) > 1;
  };
  const checkChrome = () => {
    for (const node of document.querySelectorAll(
      "#ui-title, #country-presentation-toggle, .ui-hamburger, #ui-share-pain, #ui-legend, " +
      "#ui-layer-stack, #ui-bottom-left, #country-profile, #country-profile .country-profile__native",
    )) {
      const item = describe(node), [x, y, width, height] = item.rect;
      if (!item.painted) continue;
      check(x >= -1 && y >= -1 && x + width <= innerWidth + 1 && y + height <= innerHeight + 1,
        (node.id || node.className) + ": visible control extends outside viewport");
    }
    const card = document.querySelector("#country-profile");
    check(!intersects(card, document.querySelector("#ui-title")), "Profile overlaps header or cycle controls");
    check(!intersects(document.querySelector("#ui-layer-stack"), document.querySelector("#ui-title")),
      "Picker overlaps header or cycle controls");
    if (card) {
      for (const overlay of document.querySelectorAll("#ui-layer-stack, #ui-legend, #emo-legend")) {
        if (innerWidth <= innerHeight && overlay.id !== "ui-layer-stack") continue;
        for (const content of card.querySelectorAll(
          ".country-profile__country, .country-profile__native, .country-profile__english, .country-profile__metric svg",
        )) check(!intersects(content, overlay), "Profile glyph/text overlaps " + overlay.id);
      }
    }
    const textRects = (selector) => [...document.querySelectorAll(selector)].flatMap((label) => {
      if (!describe(label).visible) return [];
      const range = document.createRange();
      range.selectNodeContents(label);
      return [...range.getClientRects()];
    });
    const shareText = textRects("#ui-share-pain .blob-button__label");
    for (const aboutText of textRects("#ui-bottom-left .blob-button__label")) {
      check(!shareText.some((share) => Math.min(aboutText.right, share.right) - Math.max(aboutText.left, share.left) > 1 &&
        Math.min(aboutText.bottom, share.bottom) - Math.max(aboutText.top, share.top) > 1), "About text overlaps Share text");
    }
    for (const button of document.querySelectorAll("#ui-bottom-left button")) {
      const item = describe(button);
      if (item.visible) check(item.rect[2] >= 48 && item.rect[3] >= 48, "About action target is smaller than 48px");
    }
    if ((innerWidth <= 768 || innerHeight <= 500) &&
        !document.querySelector("#app").classList.contains("mobile-menu-open")) {
      const previousFocus = document.activeElement;
      for (const button of document.querySelectorAll("#ui-layer-stack button, #ui-bottom-left button")) {
        button.focus();
        check(document.activeElement !== button, "Collapsed menu control remains focusable: " + button.textContent.trim());
      }
      previousFocus?.focus?.();
    }
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
      ...[...document.querySelectorAll("#country-profile [data-indicator] svg")]
        .map((node) => [node.parentElement.dataset.indicator + "Glyph", node]),
      ...[...document.querySelectorAll("#ui-layer-stack button")].map((node) => [node.dataset.layer, node]),
    ].filter(([, node]) => node);
    const elements = Object.fromEntries(entries.map(([name, node]) => [name, describe(node)]));
    const overlaps = [];
    for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
      const [a, an] = entries[i], [b, bn] = entries[j];
      if (!elements[a].visible || !elements[b].visible || an.contains(bn) || bn.contains(an)) continue;
      const [ax, ay, aw, ah] = elements[a].paintRect, [bx, by, bw, bh] = elements[b].paintRect;
      const width = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
      const height = Math.min(ay + ah, by + bh) - Math.max(ay, by);
      if (width > 0 && height > 0) overlaps.push([a, b]);
    }
    const outOfViewport = Object.entries(elements).filter(([, item]) => {
      const [x, y, w, h] = item.rect;
      return item.painted && !item.clipped && (x < 0 || y < 0 || x + w > innerWidth || y + h > innerHeight);
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
    const physical = document.querySelector('#ui-layer-stack button[data-layer="physpain"]');
    check(canvas && profile && cycle && menu && environmental && physical,
      "Country-profile chrome is unavailable");
    const verifyEmotional = async () => {
      const emotional = document.querySelector('#ui-layer-stack button[data-layer="emopain"]');
      if (!describe(emotional).visible) {
        pointerClick(menu);
        await sleep(450);
        capture("emotional-picker-open");
        checkChrome();
      }
      emotional.scrollIntoView({ block: "nearest" });
      pointerClick(emotional);
      const words = document.querySelector("#emo-legend");
      await wait(() => profile.dataset.layer === "emopain" && !words.hidden, "Actual Emotional view did not settle");
      await sleep(450);
      capture("emotional");
      checkChrome();
      const buttons = [...words.querySelectorAll("button")];
      check(buttons.length === 14, "Emotional category controls are missing");
      for (const button of buttons) {
        if (getComputedStyle(words).overflowY === "auto") {
          button.scrollIntoView({ block: "nearest" });
          await new Promise(requestAnimationFrame);
        }
        const r = button.getBoundingClientRect(), clip = words.getBoundingClientRect();
        check(r.top >= clip.top - 1 && r.bottom <= clip.bottom + 1 &&
          r.left >= clip.left - 1 && r.right <= clip.right + 1 && button.scrollWidth <= button.clientWidth + 1,
        "Emotional category is clipped or truncated: " + button.textContent.trim());
      }
      capture("emotional-categories-reachable");
      if (innerWidth <= 768 || innerHeight <= 500) {
        pointerClick(menu);
        await sleep(450);
        capture("emotional-menu-open");
        check(getComputedStyle(words).visibility === "hidden" &&
          Number(getComputedStyle(words).opacity) === 0,
        "Emotional category legend remains visible beneath the mobile menu");
        pointerClick(menu);
        await sleep(450);
        capture("emotional-menu-closed");
        check(!words.hidden && getComputedStyle(words).visibility === "visible" &&
          Number(getComputedStyle(words).opacity) > 0,
        "Closing the mobile menu did not restore the Emotional category legend");
      }
      return buttons.length;
    };
    if (profile.hidden) {
      pointerClick(cycle);
      await wait(() => cycle.dataset.state === "dwelling", "Cycle did not select a country; use cpTimeScale=.01");
      canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 0 }));
      await sleep(100);
    }
    capture("country-selected");
    checkChrome();
    if (!describe(environmental).visible) {
      check(describe(menu).visible, "Layer picker is hidden and its menu control is unavailable");
      pointerClick(menu);
      await sleep(450);
      capture("picker-open-for-selection");
      checkChrome();
    }
    environmental.scrollIntoView({ block: "nearest" });
    pointerClick(environmental);
    const legend = document.querySelector("#ui-legend");
    await wait(() => legend.dataset.layer === "envpain" && legend.querySelector("svg") &&
      legend.classList.contains("legend--visible"), "Environmental generated SVG did not appear");
    await sleep(450);
    capture("environmental");
    checkChrome();
    if (innerWidth > 768 && innerHeight > 500) {
      const environmentalTop = profile.getBoundingClientRect().top;
      pointerClick(physical);
      await wait(() => legend.dataset.layer === "physpain" && legend.querySelector("svg") &&
        legend.classList.contains("legend--visible"), "Physical generated SVG did not appear");
      await sleep(450);
      capture("physical");
      checkChrome();
      check(Math.abs(profile.getBoundingClientRect().top - environmentalTop) < 1,
        "Physical legend displaced the profile vertically");
      const emotionalCategories = await verifyEmotional();
      return { passed: true, viewport: [innerWidth, innerHeight], compactMenuRequired: false, emotionalCategories, stages };
    }
    check(describe(menu).visible, "Mobile layer-menu control is unavailable at this viewport");
    pointerClick(menu);
    await sleep(450);
    capture("menu-open");
    check(menu.getAttribute("aria-expanded") === "true" &&
      document.querySelector("#app").classList.contains("mobile-menu-open"), "Actual menu did not open");
    checkChrome();
    check(getComputedStyle(legend).visibility === "hidden" && Number(getComputedStyle(legend).opacity) === 0,
      "Hidden legend leaves visible content during menu use");
    const picker = document.querySelector("#ui-layer-stack");
    for (const button of picker.querySelectorAll("button")) {
      button.scrollIntoView({ block: "nearest" });
      await new Promise(requestAnimationFrame);
      const r = button.getBoundingClientRect(), clip = picker.getBoundingClientRect();
      check(r.top >= Math.max(0, clip.top) - 1 && r.bottom <= Math.min(innerHeight, clip.bottom) + 1 &&
        r.left >= 0 && r.right <= innerWidth, "Picker button cannot be scrolled fully into view: " + button.dataset.layer);
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      check(button.contains(hit), "Picker button is covered: " + button.dataset.layer);
    }
    pointerClick(menu);
    await sleep(450);
    capture("menu-closed");
    checkChrome();
    check(menu.getAttribute("aria-expanded") === "false", "Actual menu did not close");
    check(legend.dataset.layer === "envpain" && legend.querySelector("svg") &&
      !legend.querySelector("img") && legend.classList.contains("legend--visible"),
    "Closing the layer menu replaced or lost the generated environmental SVG");
    const emotionalCategories = await verifyEmotional();
    return { passed: true, viewport: [innerWidth, innerHeight], menuRoundTripPreservedSvg: true, emotionalCategories, stages };
  } catch (error) {
    capture("failure");
    return { passed: false, viewport: [innerWidth, innerHeight],
      error: error instanceof Error ? error.stack : String(error), stages };
  }
})()
