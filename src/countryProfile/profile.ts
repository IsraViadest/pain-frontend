import "./countryProfile.css";
import { proportionalAreaScale, type CountryPainProfile } from "./data";
import type { CountryProfilePreset } from "./presets";

const SVG_NS = "http://www.w3.org/2000/svg";

const SHAPES = {
  environmental: {
    viewBox: "0 0 247 176",
    path:
      "M151.845 134.462C110.549 130.888 49.8217 155.73 26.2148 113.618" +
      "C10.6676 87.5319 20.8169 31.9187 66.044 40.3921" +
      "C151.253 73.741 132.02 47.1205 204.071 48.604" +
      "C227.386 52.7132 234.728 75.525 217.575 89.6707" +
      "C198.123 108.267 186.453 135.471 151.854 134.453Z",
  },
  physical: {
    viewBox: "0 0 183 90",
    path:
      "M0.866 45.777C-1.795 30.345 0.866 24.706 20.387 3.339" +
      "C24.409 -1.113 40.203 -1.113 47.301 3.339" +
      "C54.399 7.79 56.163 19.041 78.968 24.038" +
      "C104.699 29.677 93.44 11.648 108.524 4.822" +
      "C123.607 -2.003 149.043 0.074 163.535 17.88" +
      "C178.027 35.686 193.407 75.453 169.746 85.543" +
      "C146.085 95.634 112.368 86.73 57.653 77.234" +
      "C2.937 67.737 3.528 61.208 0.866 45.777Z",
  },
  socioeconomic: {
    viewBox: "0 0 143 91",
    path:
      "M34.099 14.36C16.516 29.743 17.886 29.514 4.184 52.015" +
      "C-19.338 89.67 76.347 97.017 105.578 85.537" +
      "C134.808 74.057 149.88 47.652 138.919 33.876" +
      "C127.957 20.1 111.743 14.36 95.301 5.635" +
      "C78.859 -3.09 51.684 -1.024 34.099 14.36Z",
  },
} as const;

type Signal = { value: number | null; pointCount: number };

function describeSignal(name: string, signal: Signal): string {
  if (signal.value === null) return `${name}: data unavailable`;
  const normalized = Math.round(Math.max(0, Math.min(1, signal.value)) * 100);
  const points = signal.pointCount === 1 ? "source point" : "source points";
  return `${name}: peak normalized signal ${normalized} of 100 from ` +
    `${signal.pointCount} ${points}`;
}

function svgPath(className: string, path: string): SVGPathElement {
  const element = document.createElementNS(SVG_NS, "path");
  element.setAttribute("class", className);
  element.setAttribute("d", path);
  element.setAttribute("vector-effect", "non-scaling-stroke");
  return element;
}

function createSignalMetric(options: {
  key: "physical" | "socioeconomic";
  caption: string;
  color: string;
  shape: (typeof SHAPES)["physical" | "socioeconomic"];
}): {
  element: HTMLElement;
  update: (profile: CountryPainProfile) => void;
} {
  const element = document.createElement("div");
  element.className = "country-profile__metric";
  element.dataset.indicator = options.key;
  element.setAttribute("role", "img");

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", options.shape.viewBox);
  svg.setAttribute("aria-hidden", "true");
  const outline = svgPath("country-profile__outline", options.shape.path);
  const fill = svgPath("country-profile__fill", options.shape.path);
  fill.style.fill = options.color;
  svg.append(outline, fill);

  const caption = document.createElement("span");
  caption.className = "country-profile__caption";
  caption.textContent = options.caption;
  const missing = document.createElement("span");
  missing.className = "country-profile__missing";
  missing.textContent = "no data";
  element.append(svg, caption, missing);

  return {
    element,
    update(profile): void {
      const signal = profile[options.key];
      fill.style.transform = `scale(${proportionalAreaScale(signal.value).toFixed(4)})`;
      missing.hidden = signal.value !== null;
      element.dataset.missing = signal.value === null ? "true" : "false";
      element.setAttribute("aria-label", describeSignal(options.caption, signal));
    },
  };
}

function createEnvironmentalMetric(): {
  element: HTMLElement;
  update: (profile: CountryPainProfile) => void;
} {
  const element = document.createElement("div");
  element.className = "country-profile__metric";
  element.dataset.indicator = "environmental";
  element.setAttribute("role", "img");

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", SHAPES.environmental.viewBox);
  svg.setAttribute("aria-hidden", "true");
  const outline = svgPath("country-profile__outline", SHAPES.environmental.path);
  const co2 = svgPath("country-profile__co2", SHAPES.environmental.path);
  const temperature = svgPath(
    "country-profile__fill country-profile__temperature",
    SHAPES.environmental.path,
  );
  const defs = document.createElementNS(SVG_NS, "defs");
  defs.innerHTML = `
    <pattern id="country-profile-grain" width="18" height="18" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="5" r="2.2" fill="rgba(255,255,255,.62)" />
      <circle cx="13" cy="12" r="1.3" fill="rgba(255,255,255,.42)" />
    </pattern>
    <pattern id="country-profile-cells" width="18" height="15.6" patternUnits="userSpaceOnUse">
      <path d="M4.5 0H13.5L18 7.8L13.5 15.6H4.5L0 7.8Z"
        fill="none" stroke="rgba(255,255,255,.48)" stroke-width="1.4" />
    </pattern>`;
  const grain = svgPath(
    "country-profile__environment-texture country-profile__environment-texture--grain",
    SHAPES.environmental.path,
  );
  grain.style.fill = "url(#country-profile-grain)";
  const cells = svgPath(
    "country-profile__environment-texture country-profile__environment-texture--cells",
    SHAPES.environmental.path,
  );
  cells.style.fill = "url(#country-profile-cells)";
  svg.append(defs, outline, co2, temperature, grain, cells);

  const caption = document.createElement("span");
  caption.className = "country-profile__caption";
  caption.textContent = "temperature · CO₂";
  const missing = document.createElement("span");
  missing.className = "country-profile__missing";
  missing.textContent = "no data";
  element.append(svg, caption, missing);

  return {
    element,
    update(profile): void {
      const tempScale = proportionalAreaScale(profile.temperature.value);
      temperature.style.transform = `scale(${tempScale.toFixed(4)})`;
      grain.style.transform = temperature.style.transform;
      cells.style.transform = temperature.style.transform;
      co2.style.opacity = profile.co2.value === null
        ? "0"
        : Math.max(0.12, Math.min(1, profile.co2.value)).toFixed(3);
      const unavailable = profile.temperature.value === null && profile.co2.value === null;
      missing.hidden = !unavailable;
      element.dataset.missing = unavailable ? "true" : "false";
      element.setAttribute(
        "aria-label",
        `${describeSignal("Temperature", profile.temperature)}; ` +
          describeSignal("CO2", profile.co2),
      );
    },
  };
}

/** Display-only selected-country profile. Presentation controls are added in Phase 5. */
export class CountryProfileView {
  private readonly host = document.createElement("section");
  private readonly countryName = document.createElement("h2");
  private readonly nativeTerm = document.createElement("span");
  private readonly englishTerm = document.createElement("span");
  private readonly emotional = document.createElement("div");
  private readonly environmental = createEnvironmentalMetric();
  private readonly physical = createSignalMetric({
    key: "physical",
    caption: "physical",
    color: "#e4184b",
    shape: SHAPES.physical,
  });
  private readonly socioeconomic = createSignalMetric({
    key: "socioeconomic",
    caption: "socioeconomic",
    color: "#d9d438",
    shape: SHAPES.socioeconomic,
  });
  private readonly transitionMs: number;
  private currentLayer = "";
  private transitionRevision = 0;
  private transitionTimer: number | null = null;
  private profile: CountryPainProfile | null = null;
  private suppressed = false;

  constructor(
    appRoot: HTMLElement,
    preset: Pick<
      CountryProfilePreset,
      "id" | "layout" | "transitionMs" | "environmentalGlyph"
    >,
    layerId: string,
  ) {
    this.host.id = "country-profile";
    this.host.className = "country-profile";
    this.host.dataset.layout = preset.layout;
    this.host.dataset.preset = preset.id;
    this.host.dataset.environmentalGlyph = preset.environmentalGlyph ?? "simple";
    this.host.hidden = true;
    this.host.setAttribute("role", "region");
    this.host.setAttribute("aria-label", "Selected country pain profile");
    this.host.setAttribute("aria-live", "polite");
    this.transitionMs = preset.transitionMs ?? 0;
    this.host.style.setProperty(
      "--country-profile-fade-ms",
      `${this.transitionMs / 2}ms`,
    );

    this.countryName.className = "country-profile__country";
    const divider = document.createElement("div");
    divider.className = "country-profile__divider";
    const items = document.createElement("div");
    items.className = "country-profile__items";

    this.emotional.className = "country-profile__emotional";
    this.emotional.dataset.indicator = "emotional";
    this.emotional.setAttribute("role", "img");
    this.nativeTerm.className = "country-profile__native";
    this.nativeTerm.dir = "auto";
    this.englishTerm.className = "country-profile__english";
    this.emotional.append(this.nativeTerm, this.englishTerm);
    items.append(
      this.emotional,
      this.environmental.element,
      this.physical.element,
      this.socioeconomic.element,
    );
    this.host.append(this.countryName, divider, items);
    appRoot.append(this.host);
    this.setLayer(layerId);
  }

  setLayer(layerId: string): void {
    if (layerId === this.currentLayer) return;
    const revision = ++this.transitionRevision;
    if (this.transitionTimer !== null) window.clearTimeout(this.transitionTimer);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (this.host.hidden || this.transitionMs === 0 || reduceMotion) {
      this.applyLayer(layerId);
      this.host.dataset.transition = "in";
      return;
    }
    this.host.dataset.transition = "out";
    this.transitionTimer = window.setTimeout(() => {
      if (revision !== this.transitionRevision) return;
      this.applyLayer(layerId);
      this.host.dataset.transition = "in";
      this.transitionTimer = null;
    }, this.transitionMs / 2);
  }

  private applyLayer(layerId: string): void {
    this.currentLayer = layerId;
    this.host.dataset.layer = layerId;
    const all = layerId === "all-layers";
    this.emotional.hidden = !all && layerId !== "emopain";
    this.environmental.element.hidden = !all && layerId !== "envpain";
    this.physical.element.hidden = !all && layerId !== "physpain";
    this.socioeconomic.element.hidden = !all && layerId !== "socioecopain";
  }

  setProfile(profile: CountryPainProfile | null): void {
    this.profile = profile;
    this.host.hidden = profile === null || this.suppressed;
    if (!profile) return;
    this.countryName.textContent = profile.countryName;
    this.nativeTerm.textContent = profile.emotional.nativeTerm;
    this.nativeTerm.lang = profile.emotional.language;
    this.nativeTerm.className =
      `country-profile__native emo-sc-${profile.emotional.script}`;
    const duplicate =
      profile.emotional.nativeTerm.trim().toLowerCase() ===
      profile.emotional.englishTerm.trim().toLowerCase();
    this.englishTerm.textContent = profile.emotional.englishTerm;
    this.englishTerm.hidden = duplicate;
    this.emotional.setAttribute(
      "aria-label",
      `Emotional pain: ${profile.emotional.nativeTerm}; ` +
        `English: ${profile.emotional.englishTerm}; normalized signal ` +
        `${Math.round(profile.emotional.value * 100)} of 100`,
    );
    this.environmental.update(profile);
    this.physical.update(profile);
    this.socioeconomic.update(profile);
  }

  setSuppressed(suppressed: boolean): void {
    this.suppressed = suppressed;
    this.host.hidden = this.profile === null || suppressed;
  }

  setAutoplay(autoplay: boolean): void {
    this.host.setAttribute("aria-live", autoplay ? "off" : "polite");
    if (autoplay) this.host.setAttribute("aria-roledescription", "carousel");
    else this.host.removeAttribute("aria-roledescription");
  }

  destroy(): void {
    if (this.transitionTimer !== null) window.clearTimeout(this.transitionTimer);
    this.host.remove();
  }
}

/** Create the selected opening-round profile view. */
export function createCountryProfileView(
  appRoot: HTMLElement,
  layerId: string,
  preset: CountryProfilePreset,
): CountryProfileView {
  return new CountryProfileView(appRoot, preset, layerId);
}
