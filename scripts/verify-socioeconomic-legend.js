/* Live continuous scale, pattern examples, missingness, and responsive input routing. */
(async () => {
  const factories = [];
  try {
    const check = (condition, message) => { if (!condition) throw Error(message); };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const { createSocioeconomicLegend } = await import("/src/countryProfile/legend.ts");
    const context = document.createElement("canvas").getContext("2d");
    for (const style of ["color", "hatch", "woven"]) for (const contrast of [0, 0.10, 0.25]) {
      const sample = createSocioeconomicLegend(0.25, style, contrast);
      const name = `${style}, contrast ${contrast}`;
      const opacities = [...sample.querySelectorAll("*")].flatMap((node) => [...node.attributes]
        .filter((attribute) => /(^|-)opacity$/.test(attribute.name)).map((attribute) => Number(attribute.value)));
      check(opacities.every((value) => Number.isFinite(value) && value >= 0 && value <= 1),
        name + ": nonfinite or out-of-range opacity");
      const ends = [...sample.querySelectorAll("linearGradient stop")]
        .map((stop) => Number(stop.getAttribute("stop-opacity")));
      check(ends.length === 2 && ends[0] === 0.25 && ends[1] === 1,
        name + ": continuous scale lost its zero/full endpoints");
      const patterns = [...sample.querySelectorAll("pattern")];
      check(style === "color" ? patterns.length === 0 : patterns.length >= 2,
        name + ": pattern examples missing or color scale discretized");
      let zeroAlpha = ends[0], fullAlpha = ends[1];
      if (patterns.length) {
        const zero = patterns[0], full = patterns.at(-1);
        zeroAlpha = Number(zero.querySelector("rect").getAttribute("fill-opacity"));
        const base = Number(full.querySelector("rect").getAttribute("fill-opacity"));
        const overlay = Number(full.querySelector("path").getAttribute("fill-opacity"));
        fullAlpha = base + (1 - base) * overlay;
        check(zeroAlpha === 64 / 255 &&
          !context.isPointInPath(new Path2D(zero.querySelector("path").getAttribute("d")), 4, 4),
        name + ": zero swatch acquired pattern ink or lost its visible minimum");
        check(Math.abs(fullAlpha - 1) < 1e-12 &&
          context.isPointInPath(new Path2D(full.querySelector("path").getAttribute("d")), 7, 7),
        name + ": full-value swatch is not fully filled and opaque");
      }
      check(sample.querySelector(':scope > path[fill="none"][stroke]') &&
        [...sample.querySelectorAll("text")].some((text) => text.textContent === "no data") &&
        sample.getAttribute("aria-label").includes("not zero"), name + ": missing is not distinct from zero");
      factories.push({ style, contrast, zeroAlpha, fullAlpha,
        opacityRange: [Math.min(...opacities), Math.max(...opacities)] });
    }
    const missingLegend = createSocioeconomicLegend(0.25, "hatch", 0.1, true, "diagonal");
    check(missingLegend.querySelector('pattern[data-missing="diagonal"]') &&
      missingLegend.querySelector(':scope > path[fill^="url("]') &&
      missingLegend.getAttribute("aria-label").includes("gray hatch"),
    "Missing-data hatch is absent from the socioeconomic legend");
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Socio-economic Pain").click();
    const host = document.querySelector("#ui-legend");
    for (let attempt = 0; attempt < 240; attempt++) {
      await sleep(25);
      if (host.dataset.layer === "socioecopain" && host.querySelector("svg") &&
          Math.abs(new DOMMatrixReadOnly(getComputedStyle(host).transform).m41) < 0.01) break;
    }
    const svg = host.querySelector("svg");
    check(svg && host.dataset.layer === "socioecopain", "Generated scale unavailable");
    const bounds = svg.getBBox(), box = svg.viewBox.baseVal;
    check(bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= box.width + 1 &&
      bounds.y + bounds.height <= box.height + 1, "Legend content clips outside its viewBox");
    const stops = [...svg.querySelectorAll("linearGradient stop")];
    check(stops.length === 2 && stops[0].getAttribute("stop-color") === "#ffff00" &&
      Number(stops[0].getAttribute("stop-opacity")) > 0 &&
      Number(stops[1].getAttribute("stop-opacity")) === 1, "Continuous alpha endpoints missing");
    check(svg.getAttribute("aria-label").includes("not zero"), "Missingness description absent");
    const rect = host.getBoundingClientRect();
    const share = document.querySelector("#ui-share-pain").getBoundingClientRect();
    const overlaps = rect.left < share.right && rect.right > share.left &&
      rect.top < share.bottom && rect.bottom > share.top;
    check(!overlaps, "Legend overlaps share action");
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const wheel = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 0 });
    hit.dispatchEvent(wheel);
    check(wheel.defaultPrevented, "Read-only legend intercepted the globe wheel");
    return { passed: true, factories, continuousScale: true, missingIsNotZero: true,
      bounds: [bounds.x, bounds.y, bounds.width, bounds.height], viewBox: [box.width, box.height],
      overlap: overlaps, wheelReachesGlobe: true, viewport: [innerWidth, innerHeight] };
  } catch (error) {
    return { passed: false, error: String(error.stack ?? error), factories };
  }
})()
