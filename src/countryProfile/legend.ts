import { SCAR_RELIEF_COLORS } from "../globe/scarReliefColors";
import { Color } from "three";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Relative field strength; cloud height is an artistic treatment, not a measured altitude. */
export function createEnvironmentalLegend(vertical = false): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("ui-legend__img");
  svg.setAttribute("viewBox", "0 0 184 136");
  svg.setAttribute("width", "184");
  svg.setAttribute("height", "136");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Temperature Change in coral above Emissions (CO2) in green. " +
    "Each field runs from lower to higher relative strength. Cloud height is artistic.");
  svg.setAttribute("fill", "currentColor");
  svg.style.color = "#ffffff";
  svg.style.fontFamily = "inherit";
  svg.style.fontSize = "14px";
  if (vertical) svg.dataset.orientation = "vertical";
  const defs = document.createElementNS(SVG_NS, "defs");
  svg.append(defs);
  const fields: {
    gradient: SVGLinearGradientElement;
    text: SVGTextElement;
    bar: SVGRectElement;
  }[] = [];

  for (const [index, [label, color, key]] of ([
    ["Temperature Change", "#d74846", "temperature"],
    ["Emissions (CO2)", "#b4ffd2", "co2"],
  ] as const).entries()) {
    const id = `country-profile-legend-${key}`;
    const gradient = document.createElementNS(SVG_NS, "linearGradient");
    gradient.id = id;
    for (const offset of [0, 1]) {
      const stop = document.createElementNS(SVG_NS, "stop");
      stop.setAttribute("offset", String(offset));
      stop.setAttribute("stop-color", color);
      stop.setAttribute("stop-opacity", String(offset));
      gradient.append(stop);
    }
    defs.append(gradient);
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("y", String(16 + index * 49));
    text.textContent = label;
    const bar = document.createElementNS(SVG_NS, "rect");
    bar.setAttribute("y", String(24 + index * 49));
    bar.setAttribute("width", "184");
    bar.setAttribute("height", "14");
    bar.setAttribute("rx", "7");
    bar.setAttribute("fill", `url(#${id})`);
    svg.append(text, bar);
    fields.push({ gradient, text, bar });
  }

  const annotations: SVGTextElement[] = [];
  for (const [label, x, y, anchor] of [
    ["min", 0, 110, "start"],
    ["max", 184, 110, "end"],
    ["relative field strength", 0, 132, "start"],
  ] as const) {
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(x));
    text.setAttribute("y", String(y));
    text.setAttribute("text-anchor", anchor);
    text.setAttribute("font-size", "11");
    text.textContent = label;
    svg.append(text);
    annotations.push(text);
  }
  const co2Endpoints = annotations.slice(0, 2).map(text => {
    const copy = text.cloneNode(true) as SVGTextElement;
    svg.append(copy);
    return copy;
  });

  const resize = (): void => {
    const portrait = vertical || window.innerWidth <= 768 && window.innerHeight >= window.innerWidth ||
      window.innerWidth <= 744 && window.innerHeight <= 500;
    const compact = !portrait && window.innerHeight <= 500;
    const layout = portrait ? "portrait" : compact ? "landscape" : "desktop";
    if (svg.dataset.layout === layout) return;
    svg.dataset.layout = layout;
    const width = portrait ? 72 : 184;
    const height = portrait ? 208 : compact ? 98 : 136;
    svg.toggleAttribute("data-stacked", portrait);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.style.fontSize = portrait ? "11px" : compact ? "12px" : "14px";
    for (const [index, { gradient, text, bar }] of fields.entries()) {
      gradient.setAttribute("x2", portrait ? "0%" : "100%");
      gradient.setAttribute("y1", portrait ? "100%" : "0%");
      text.setAttribute("x", "0");
      text.setAttribute("y", portrait ? "0" : String((compact ? 12 : 16) + index * (compact ? 35 : 49)));
      text.setAttribute("text-anchor", portrait ? "middle" : "start");
      text.replaceChildren();
      if (portrait) {
        text.setAttribute("transform", `translate(18, ${48 + index * 112}) rotate(-90)`);
        for (const [line, label] of (index === 0 ? ["Temperature", "Change"] : ["Emissions", "(CO2)"]).entries()) {
          const span = document.createElementNS(SVG_NS, "tspan");
          span.setAttribute("x", "0");
          span.setAttribute("y", String(line * 12));
          span.textContent = label + (line === 0 ? " " : "");
          text.append(span);
        }
      } else {
        text.removeAttribute("transform");
        text.textContent = index === 0 ? "Temperature Change" : "Emissions (CO2)";
      }
      bar.setAttribute("x", String(portrait ? 42 : 0));
      bar.setAttribute("y", String(portrait ? 8 + index * 112 : (compact ? 20 : 24) + index * (compact ? 35 : 49)));
      bar.setAttribute("width", String(portrait ? 12 : 184));
      bar.setAttribute("height", String(portrait ? 80 : compact ? 10 : 14));
      bar.setAttribute("rx", portrait ? "6" : compact ? "5" : "7");
    }
    for (const [index, text] of annotations.entries()) {
      text.setAttribute("font-size", portrait ? "6" : "11");
      text.setAttribute("x", String(portrait ? 48 : index === 1 ? 184 : 0));
      text.setAttribute("y", String(portrait ? index === 1 ? 6 : 94 :
        index === 2 ? 132 : compact ? 94 : 110));
      text.setAttribute("text-anchor", portrait ? "middle" : index === 1 ? "end" : "start");
      text.style.display = index === 2 && (portrait || compact) ? "none" : "";
    }
    for (const [index, text] of co2Endpoints.entries()) {
      text.setAttribute("font-size", "6");
      text.setAttribute("x", "48");
      text.setAttribute("y", index === 1 ? "118" : "206");
      text.setAttribute("text-anchor", "middle");
      text.style.display = portrait ? "" : "none";
    }
  };
  svg.addEventListener("resize", resize);
  resize();
  return svg;
}

/** Compact physical scale matching the generated environmental and socioeconomic legends. */
export function createPhysicalLegend(
  palette: keyof typeof SCAR_RELIEF_COLORS = "coral",
  sizeMode: boolean | "recessed-small" = false,
): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("ui-legend__img");
  svg.dataset.orientation = "vertical";
  svg.setAttribute("viewBox", "0 0 92 170");
  svg.setAttribute("width", "92");
  svg.setAttribute("height", "170");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Global health conditions. Minimum at the top, maximum at the " +
    "bottom of the dotted V. Dot diameter follows the active scar-size mapping; " +
    "these enlarged samples show relative sizes, not map pixel sizes.");
  svg.setAttribute("fill", "currentColor");
  svg.style.color = "#ffffff";
  svg.style.fontFamily = "inherit";
  const [low, high] = SCAR_RELIEF_COLORS[palette];
  const title = document.createElementNS(SVG_NS, "text");
  title.setAttribute("transform", "translate(12, 90) rotate(-90)");
  title.setAttribute("text-anchor", "middle");
  title.setAttribute("font-size", "11");
  title.textContent = "Global health conditions";
  const dots = document.createElementNS(SVG_NS, "g");
  for (let row = 0; row <= 16; row++) {
    const depth = row / 16;
    const size = sizeMode === "recessed-small" ? 1.5 - .75 * depth :
      1 + (sizeMode ? depth : 0);
    // Same smoothstep and linear-light palette mixing as the relief shader.
    const t = Math.max(0, Math.min(1, (depth * (128 / 255) - .02) / .30));
    const color = new Color(high).lerp(new Color(low), t * t * (3 - 2 * t));
    const radius = 1.5 * size;
    for (const side of 22 * (1 - depth) < radius + .1 ? [0] : [-1, 1]) {
      const dot = document.createElementNS(SVG_NS, "circle");
      dot.dataset.depth = String(depth);
      dot.setAttribute("cx", String(48 + side * 22 * (1 - depth)));
      dot.setAttribute("cy", String(32 + depth * 116));
      dot.setAttribute("r", String(radius));
      dot.setAttribute("fill", `#${color.getHexString()}`);
      dots.append(dot);
    }
  }
  const caps = document.createElementNS(SVG_NS, "g");
  const topRadius = sizeMode === "recessed-small" ? 2.25 : 1.5;
  caps.dataset.physicalCaps = "true";
  for (const x of [16, 21, 75, 80]) {
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", String(x));
    dot.setAttribute("cy", "32");
    dot.setAttribute("r", String(topRadius));
    dot.setAttribute("fill", `#${high.toString(16).padStart(6, "0")}`);
    caps.append(dot);
  }
  const higher = document.createElementNS(SVG_NS, "text");
  higher.setAttribute("x", "56");
  higher.setAttribute("y", "22");
  higher.setAttribute("text-anchor", "middle");
  higher.setAttribute("font-size", "11");
  higher.textContent = "min";
  const lower = document.createElementNS(SVG_NS, "text");
  lower.setAttribute("x", "56");
  lower.setAttribute("y", "166");
  lower.setAttribute("text-anchor", "middle");
  lower.setAttribute("font-size", "11");
  lower.textContent = "max";
  const diagram = document.createElementNS(SVG_NS, "g");
  diagram.setAttribute("transform", "translate(8, 0)");
  diagram.append(dots, caps);
  svg.append(title, diagram, higher, lower);
  return svg;
}

/** Resolved pattern samples use the same alpha and contrast mapping as the globe. */
export function createSocioeconomicLegend(
  minimumAlpha: number,
  style: "color" | "hatch" | "woven",
  contrast = 0.25,
  vertical = false,
  missingStyle?: "diagonal" | "cross",
  gdpPerCapita = false,
): SVGSVGElement {
  const q = Math.round(255 * minimumAlpha) / 255;
  if (!Number.isFinite(minimumAlpha) || minimumAlpha < 0 || q >= 1) {
    throw new Error("Socioeconomic legend needs a finite, nonsaturated minimum alpha");
  }
  if (!Number.isFinite(contrast) || contrast < 0 || contrast > 1) {
    throw new RangeError("Socioeconomic legend contrast must be in [0, 1]");
  }
  const element = <K extends keyof SVGElementTagNameMap>(
    tag: K, attributes: Record<string, string | number> = {},
  ): SVGElementTagNameMap[K] => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
    return node;
  };
  const svg = element("svg", { class: "ui-legend__img", role: "img", fill: "currentColor" });
  if (vertical) svg.dataset.orientation = "vertical";
  svg.style.color = "#ffffff";
  svg.style.fontFamily = "inherit";
  svg.setAttribute("aria-label", "Socioeconomic continuous relative signal, lower to higher. " +
    (style === "color" ? "Stronger yellow represents higher values. " :
      "Pattern swatches are examples of the same continuous value shown by the color strip, " +
      "not discrete bins or separate quantities. ") +
    "Zero uses the visible minimum. " + (missingStyle
      ? "A neutral gray hatch means data unavailable, not zero."
      : "The empty outline means data unavailable, not zero."));
  if (gdpPerCapita) svg.setAttribute("aria-label",
    "GDP per capita, World Bank 2024, current US dollars per person. Inverted logarithmic scale: " +
    "lower GDP per person gives stronger yellow. Gray hatching means unavailable, not zero. " +
    "This is an artistic socioeconomic proxy, not a measured pain score.");
  const defs = element("defs");
  svg.append(defs);
  const gradient = element("linearGradient", { id: "country-profile-socioeconomic-scale" });
  gradient.append(
    element("stop", { offset: 0, "stop-color": "#ffff00", "stop-opacity": minimumAlpha }),
    element("stop", { offset: 1, "stop-color": "#ffff00", "stop-opacity": 1 }),
  );
  defs.append(gradient);
  let missingFill = "none";
  if (missingStyle) {
    const missingPattern = element("pattern", { id: "country-profile-socioeconomic-missing",
      width: 6, height: 6, patternUnits: "userSpaceOnUse", "data-missing": missingStyle });
    missingPattern.append(element("rect", { width: 6, height: 6, fill: "#707070",
      "fill-opacity": 0.42 }));
    const lines = missingStyle === "cross" ? "M-1 1L1-1M0 6L6 0M5 7L7 5M-1 5L1 7M0 0L6 6M5-1L7 1" :
      "M-1 1L1-1M0 6L6 0M5 7L7 5";
    missingPattern.append(element("path", { d: lines, stroke: "#dcdcdc",
      "stroke-opacity": 0.62, "stroke-width": 1 }));
    defs.append(missingPattern);
    missingFill = "url(#country-profile-socioeconomic-missing)";
  }
  const continuous = element("rect", { fill: "url(#country-profile-socioeconomic-scale)" });
  svg.append(continuous);
  const swatches = (style === "color" ? [] : [0, 0.25, 0.5, 0.75, 1]).map((value, index) => {
    const alpha = Math.round(255 * (minimumAlpha + (1 - minimumAlpha) * value)) / 255;
    const swatch = element("rect", { fill: "#ffff00", "fill-opacity": alpha });
    if (style !== "color") {
      const v = Math.max(0, Math.min(1, (alpha - q) / (1 - q)));
      const duty = style === "woven" ? 1 - Math.sqrt(1 - v) : v;
      const low = alpha - contrast * (1 - q) * v;
      const high = low + contrast * (1 - q);
      const id = `country-profile-socioeconomic-${style}-${index}`;
      const pattern = element("pattern", { id, width: 8, height: 8,
        patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
      pattern.append(element("rect", { width: 8, height: 8,
        fill: "#ffff00", "fill-opacity": low }));
      // One path fills the woven union once; separate translucent strokes would brighten crossings.
      const vertical = `M0 0H${8 * duty}V8H0Z`;
      const horizontal = style === "woven" ? `M0 0H8V${8 * duty}H0Z` : "";
      pattern.append(element("path", { d: vertical + horizontal, fill: "#ffff00",
        "fill-opacity": low < 1 ? (high - low) / (1 - low) : 0 }));
      defs.append(pattern);
      swatch.setAttribute("fill", `url(#${id})`);
      swatch.removeAttribute("fill-opacity");
    }
    svg.append(swatch);
    return swatch;
  });
  const labels = [gdpPerCapita ? "GDP/person 2024" : "Country based wealth (GDP)",
    gdpPerCapita ? "min / richer" : "min", gdpPerCapita ? "max / poorer" : "max",
    style === "color" ? "continuous relative signal" : "same continuous value; examples", "no data"].map((label) => {
    const text = element("text");
    text.textContent = label;
    svg.append(text);
    return text;
  });
  const missing = element("path", { d: "M1 5C0 1 7 0 11 2C17 2 17 9 12 11C7 13 0 10 1 5Z",
    fill: missingFill, stroke: "currentColor", "stroke-width": 1 });
  svg.append(missing);
  const resize = (): void => {
    const portrait = vertical || window.innerWidth <= 768 && window.innerHeight >= window.innerWidth ||
      window.innerWidth <= 744 && window.innerHeight <= 500;
    const compact = !portrait && window.innerHeight <= 500;
    const layout = portrait ? "portrait" : compact ? "landscape" : "desktop";
    if (svg.dataset.layout === layout) return;
    svg.dataset.layout = layout;
    const width = portrait ? 72 : 184, height = compact ? 98 : 136;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    gradient.setAttribute("x2", portrait ? "0%" : "100%");
    gradient.setAttribute("y1", portrait ? "100%" : "0%");
    continuous.setAttribute("x", String(portrait ? style === "color" ? 42 : 35 : 0));
    continuous.setAttribute("y", String(portrait ? 23 :
      style === "color" ? compact ? 20 : 26 : compact ? 16 : 20));
    continuous.setAttribute("width", String(portrait ? style === "color" ? 18 : 4 : 184));
    continuous.setAttribute("height", String(portrait ? 80 :
      style === "color" ? compact ? 14 : 18 : compact ? 3 : 4));
    for (const [index, swatch] of swatches.entries()) {
      swatch.setAttribute("x", String(portrait ? 42 : index * 184 / 5));
      swatch.setAttribute("y", String(portrait ? 23 + (4 - index) * 16 : compact ? 20 : 26));
      swatch.setAttribute("width", String(portrait ? 18 : 184 / 5));
      swatch.setAttribute("height", String(portrait ? 16 : compact ? 14 : 18));
    }
    const positions = portrait ? [[0, 0], [51, 116], [51, 17], [0, 0], [26, 134]] :
      [[0, compact ? 12 : 16], [0, compact ? 54 : 64], [184, compact ? 54 : 64],
        [0, 88], [24, compact ? 94 : 128]];
    for (const [index, text] of labels.entries()) {
      text.setAttribute("x", String(positions[index]![0]));
      text.setAttribute("y", String(positions[index]![1]));
      text.setAttribute("font-size", String(index === 0 ? portrait ? 11 : compact ? 12 : 14 : 11));
      text.setAttribute("text-anchor", portrait && index <= 2 ? "middle" : index === 2 ? "end" : "start");
      text.style.display = index === 3 && (portrait || compact) ? "none" : "";
      if (index === 0 && portrait) text.setAttribute("transform", "translate(12, 63) rotate(-90)");
      else text.removeAttribute("transform");
      if (index === 0 && !gdpPerCapita) {
        text.setAttribute("font-size", "11");
        text.replaceChildren();
        if (portrait) {
          for (const [line, label] of ["Country based", "wealth (GDP)"].entries()) {
            const span = element("tspan", { x: 0, y: line * 12 });
            span.textContent = label;
            text.append(span);
          }
        } else text.textContent = "Country based wealth (GDP)";
      }
    }
    missing.setAttribute("transform", `translate(${portrait ? 7 : 0}, ${portrait ? 123 : compact ? 83 : 117})`);
  };
  svg.addEventListener("resize", resize);
  resize();
  return svg;
}
