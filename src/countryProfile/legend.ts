const SVG_NS = "http://www.w3.org/2000/svg";

/** Relative field strength; cloud height is an artistic treatment, not a measured altitude. */
export function createEnvironmentalLegend(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("ui-legend__img");
  svg.setAttribute("viewBox", "0 0 184 136");
  svg.setAttribute("width", "184");
  svg.setAttribute("height", "136");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Temperature in coral and CO₂ in green. " +
    "Each field runs from lower to higher relative strength. Cloud height is artistic.");
  svg.setAttribute("fill", "currentColor");
  svg.style.color = "#ffffff";
  svg.style.fontFamily = "inherit";
  svg.style.fontSize = "14px";
  const defs = document.createElementNS(SVG_NS, "defs");
  svg.append(defs);
  const fields: {
    gradient: SVGLinearGradientElement;
    text: SVGTextElement;
    bar: SVGRectElement;
  }[] = [];

  for (const [index, [label, color, key]] of ([
    ["Temperature", "#d74846", "temperature"],
    ["CO₂", "#69c99c", "co2"],
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
    ["lower", 0, 110, "start"],
    ["higher", 184, 110, "end"],
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

  const resize = (): void => {
    const portrait = window.innerWidth <= 768 && window.innerHeight >= window.innerWidth;
    const compact = !portrait && window.innerHeight <= 500;
    const layout = portrait ? "portrait" : compact ? "landscape" : "desktop";
    if (svg.dataset.layout === layout) return;
    svg.dataset.layout = layout;
    const width = portrait ? 72 : 184;
    const height = compact ? 98 : 136;
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
      if (portrait) text.setAttribute("transform", `translate(${27 + index * 36}, 72) rotate(-90)`);
      else text.removeAttribute("transform");
      bar.setAttribute("x", String(portrait ? index * 36 : 0));
      bar.setAttribute("y", String(portrait ? 22 : (compact ? 20 : 24) + index * (compact ? 35 : 49)));
      bar.setAttribute("width", String(portrait ? 12 : 184));
      bar.setAttribute("height", String(portrait ? 98 : compact ? 10 : 14));
      bar.setAttribute("rx", portrait ? "6" : compact ? "5" : "7");
    }
    for (const [index, text] of annotations.entries()) {
      text.setAttribute("x", String(portrait ? 36 : index === 1 ? 184 : 0));
      text.setAttribute("y", String(portrait ? index === 1 ? 12 : 134 :
        index === 2 ? 132 : compact ? 94 : 110));
      text.setAttribute("text-anchor", portrait ? "middle" : index === 1 ? "end" : "start");
      text.style.display = index === 2 && (portrait || compact) ? "none" : "";
    }
  };
  svg.addEventListener("resize", resize);
  resize();
  return svg;
}
