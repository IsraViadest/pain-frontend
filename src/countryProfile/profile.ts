import "./countryProfile.css";
import { proportionalAreaScale, type CountryPainProfile } from "./data";
import type { CountryProfilePreset } from "./presets";

const SVG_NS = "http://www.w3.org/2000/svg";
const textMeasureContext = document.createElement("canvas").getContext("2d");

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

function missingHatch(id: string): string {
  return `<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse">
    <rect width="12" height="12" fill="#707070" fill-opacity=".52" />
    <path d="M-3 3L3-3M0 12L12 0M9 15L15 9" stroke="#dcdcdc"
      stroke-opacity=".72" stroke-width="1.5" />
  </pattern>`;
}

function createSignalMetric(options: {
  key: "physical" | "socioeconomic";
  caption: string;
  color: string;
  shape: (typeof SHAPES)["physical" | "socioeconomic"];
  inset: number;
  compact: boolean;
  missingPattern: boolean;
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
  const valueFill = options.compact && options.key === "physical"
    ? "url(#country-profile-physical-dots)" : options.color;
  fill.style.fill = valueFill;
  const defs = document.createElementNS(SVG_NS, "defs");
  if (options.compact && options.key === "physical") {
    defs.innerHTML = `<pattern id="country-profile-physical-dots" width="16" height="16"
      patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="3.5"
      fill="${options.color}"/><circle cx="12" cy="12" r="3.5"
      fill="${options.color}"/></pattern>`;
  }
  const missingId = `country-profile-${options.key}-missing-hatch`;
  if (options.missingPattern) defs.insertAdjacentHTML("beforeend", missingHatch(missingId));
  if (defs.childElementCount > 0) svg.append(defs);
  svg.append(fill, outline);

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
      const missingValue = signal.value === null;
      fill.style.fill = missingValue && options.missingPattern ? `url(#${missingId})` : valueFill;
      const scale = options.inset * (missingValue && options.missingPattern
        ? 1 : proportionalAreaScale(signal.value));
      fill.style.transform = `scale(${scale.toFixed(4)})`;
      missing.hidden = signal.value !== null;
      element.dataset.missing = signal.value === null ? "true" : "false";
      element.setAttribute("aria-label", describeSignal(options.caption, signal));
    },
  };
}

function createEnvironmentalMetric(compact: boolean, inset: number, missingPattern: boolean): {
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
  const unavailableOutline = svgPath("country-profile__empty-outline", SHAPES.environmental.path);
  unavailableOutline.style.display = "none";
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
    </pattern>
    ${missingPattern ? missingHatch("country-profile-environmental-missing-hatch") : ""}`;
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
  svg.append(defs, temperature, grain, cells, outline, co2, unavailableOutline);

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
      const temperatureMissing = profile.temperature.value === null;
      const co2Missing = profile.co2.value === null;
      const tempScale = inset * (temperatureMissing && missingPattern
        ? 1 : proportionalAreaScale(profile.temperature.value));
      temperature.style.fill = temperatureMissing && missingPattern
        ? "url(#country-profile-environmental-missing-hatch)" : "";
      temperature.style.transform = `scale(${tempScale.toFixed(4)})`;
      grain.style.transform = temperature.style.transform;
      cells.style.transform = temperature.style.transform;
      grain.style.display = cells.style.display = temperatureMissing ? "none" : "";
      co2.style.stroke = co2Missing && missingPattern ? "#a8a8a8" : "";
      co2.style.strokeDasharray = co2Missing && missingPattern ? "8 5" : "";
      co2.style.opacity = co2Missing
        ? missingPattern ? "0.72" : "0"
        : Math.max(compact ? 0.10 : 0.12, Math.min(1, profile.co2.value!)).toFixed(3);
      const unavailable = temperatureMissing && co2Missing;
      if (compact) {
        outline.style.display = co2Missing ? "none" : "";
        unavailableOutline.style.display = unavailable && !missingPattern ? "" : "none";
      }
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
  private readonly items = document.createElement("div");
  private readonly environmental: ReturnType<typeof createEnvironmentalMetric>;
  private readonly physical: ReturnType<typeof createSignalMetric>;
  private readonly socioeconomic: ReturnType<typeof createSignalMetric>;
  private readonly transitionMs: number;
  private readonly paintedSpacing: boolean;
  private readonly centerEnglishTerm: boolean;
  private readonly softReveal: boolean;
  private currentLayer = "";
  private transitionRevision = 0;
  private transitionTimer: number | null = null;
  private profile: CountryPainProfile | null = null;
  private preview: CountryPainProfile | null = null;
  private suppressed = false;
  private boundsObserver: ResizeObserver | null = null;
  private readonly obstacles: HTMLElement[] = [];

  private syncPaintedSpacing(): void {
    if (!this.paintedSpacing) return;
    const metrics = [this.emotional, this.environmental.element, this.physical.element,
      this.socioeconomic.element];
    for (const metric of metrics.slice(1)) metric.style.marginLeft = "0px";
    this.englishTerm.style.transform = "";
    const visibleRect = (elements: readonly Element[]): { left: number; right: number } | null => {
      const rects = elements.flatMap((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0
          ? [rect] : [];
      });
      return rects.length ? {
        left: Math.min(...rects.map((rect) => rect.left)),
        right: Math.max(...rects.map((rect) => rect.right)),
      } : null;
    };
    if (this.centerEnglishTerm) {
      const native = this.nativeTerm.getBoundingClientRect();
      const english = this.englishTerm.getBoundingClientRect();
      if (native.width > 0 && english.width > 0) {
        const offset = native.left + native.width / 2 - english.left - english.width / 2;
        this.englishTerm.style.transform = `translateX(${offset.toFixed(3)}px)`;
      }
    }
    if (this.currentLayer !== "all-layers") return;
    const context = textMeasureContext;
    if (!context) return;
    context.font = getComputedStyle(this.countryName).font;
    const target = context.measureText("n").width;
    this.host.style.setProperty("--cp-painted-gap", `${target.toFixed(3)}px`);
    const bounds = [
      () => visibleRect([this.nativeTerm, this.englishTerm]),
      ...metrics.slice(1).map((metric) => () => visibleRect(
        [...metric.querySelectorAll(".country-profile__outline, .country-profile__empty-outline")],
      )),
    ];
    for (let index = 1; index < metrics.length; index++) {
      const previous = bounds[index - 1]!();
      const current = bounds[index]!();
      if (!previous || !current) continue;
      metrics[index]!.style.marginLeft = `${(target - (current.left - previous.right)).toFixed(3)}px`;
    }
  }

  private syncBounds = (): void => {
    this.syncPaintedSpacing();
    const profileRect = this.host.getBoundingClientRect();
    const nativeRect = this.nativeTerm.getBoundingClientRect();
    const left = nativeRect.width > 0 ? Math.min(profileRect.left, nativeRect.left) : profileRect.left;
    const right = nativeRect.width > 0 ? Math.max(profileRect.right, nativeRect.right) : profileRect.right;
    const besideProfile = profileRect.width > 0 && innerHeight <= 500 && innerWidth > innerHeight;
    for (const [id, space] of [["emo-legend", left - 28],
      ["ui-layer-stack", innerWidth - right - 28]] as const) {
      const host = document.getElementById(id);
      if (besideProfile) host?.style.setProperty("--profile-side-space", `${Math.max(0, space)}px`);
      else host?.style.removeProperty("--profile-side-space");
    }
    if (profileRect.width === 0) return;
    let bottom = 24;
    for (const element of this.obstacles) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (rect.width === 0 || rect.height === 0 || rect.right <= 0 || rect.left >= innerWidth ||
          style.visibility === "hidden" || Number(style.opacity) === 0) continue;
      if ((innerWidth > 768 || innerWidth > innerHeight) &&
          (rect.right <= left - 8 || rect.left >= right + 8)) continue;
      bottom = Math.max(bottom, innerHeight - rect.top + 12);
    }
    this.host.style.setProperty("--cp-bottom", `${bottom}px`);
  };

  constructor(
    appRoot: HTMLElement,
    preset: CountryProfilePreset,
    layerId: string,
  ) {
    appRoot.toggleAttribute("data-cp-fit-controls", preset.fitShortScreenControls === true);
    const compact = preset.layout === "compact";
    const inset = compact ? preset.glyphInset ?? 0.88 : 1;
    const missingPattern = preset.profileMissingPattern === true;
    this.environmental = createEnvironmentalMetric(compact, inset, missingPattern);
    this.physical = createSignalMetric({ key: "physical", caption: "physical", color: "#e4184b",
      shape: SHAPES.physical, compact, inset, missingPattern });
    this.socioeconomic = createSignalMetric({ key: "socioeconomic", caption: preset.socioeconomicDataset
      ? "GDP per capita 2024, inverted logarithmic display (lower GDP gives higher signal)"
      : "socioeconomic",
      color: "#d9d438", shape: SHAPES.socioeconomic, compact, inset, missingPattern });
    this.host.id = "country-profile";
    this.host.className = "country-profile";
    this.host.dataset.layout = preset.layout;
    this.host.dataset.preset = preset.id;
    this.host.dataset.environmentalGlyph = preset.environmentalGlyph ?? "simple";
    this.host.dataset.compactSize = preset.compactSize ?? "medium";
    this.host.dataset.caption = preset.emotionalCaption ?? "quiet";
    this.host.dataset.profileSpacing = preset.profileSpacing ?? "slots";
    this.host.dataset.profileGlow = preset.profileGlow ?? "none";
    this.host.dataset.profileReveal = preset.profileReveal ?? "none";
    this.host.dataset.profileOrder = preset.profileOrder ?? "country-first";
    this.host.dataset.profileHardOutline = preset.profileHardOutline === false ? "false" : "true";
    this.host.dataset.profilePlate = preset.profilePlate ?? "fixed";
    this.paintedSpacing = preset.profileSpacing === "painted-n";
    this.centerEnglishTerm = preset.centerEnglishTerm === true;
    this.softReveal = preset.profileReveal === "soft";
    this.host.style.setProperty("--country-profile-plate", String(preset.plateOpacity ?? 0.36));
    this.host.style.setProperty("--country-profile-native", String(preset.nativeOpacity ?? 0.72));
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
    this.items.className = "country-profile__items";

    this.emotional.className = "country-profile__emotional";
    this.emotional.dataset.indicator = "emotional";
    this.emotional.setAttribute("role", "img");
    this.nativeTerm.className = "country-profile__native";
    this.nativeTerm.dir = "auto";
    this.englishTerm.className = "country-profile__english";
    this.emotional.append(this.nativeTerm, this.englishTerm);
    this.items.append(
      this.emotional,
      this.environmental.element,
      this.physical.element,
      this.socioeconomic.element,
    );
    this.host.append(this.countryName, divider, this.items);
    appRoot.append(this.host);
    if (compact) {
      this.boundsObserver = new ResizeObserver(this.syncBounds);
      this.boundsObserver.observe(this.nativeTerm);
      for (const id of ["ui-share-pain", "ui-legend", "emo-legend", "ui-bottom-left"]) {
        const element = document.getElementById(id);
        if (element) {
          this.obstacles.push(element);
          this.boundsObserver.observe(element);
          element.addEventListener("transitionend", this.syncBounds);
        }
      }
      window.addEventListener("resize", this.syncBounds);
      this.syncBounds();
      void document.fonts.ready.then(() => {
        if (this.host.isConnected) this.syncBounds();
      });
    }
    this.setLayer(layerId);
  }

  setLayer(layerId: string): void {
    if (layerId === this.currentLayer) {
      if (this.transitionTimer !== null) {
        window.clearTimeout(this.transitionTimer);
        this.transitionTimer = null;
        this.transitionRevision++;
        this.host.dataset.transition = "in";
      }
      return;
    }
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
    if (this.boundsObserver) this.syncBounds();
  }

  setProfile(profile: CountryPainProfile | null): void {
    this.profile = profile;
    this.host.hidden = !this.preview && (profile === null || this.suppressed);
    if (!profile) return;
    this.countryName.textContent = profile.countryName.toLocaleLowerCase("en");
    const emotionMissing = profile.emotional.value === null;
    this.emotional.dataset.missing = String(emotionMissing);
    this.nativeTerm.textContent = emotionMissing
      ? profile.emotional.filteredOut ? "filtered out" : "no data" : profile.emotional.nativeTerm;
    this.nativeTerm.lang = profile.emotional.language;
    this.nativeTerm.className =
      `country-profile__native emo-sc-${profile.emotional.script}`;
    const duplicate =
      profile.emotional.nativeTerm.trim().toLowerCase() ===
      profile.emotional.englishTerm.trim().toLowerCase();
    this.englishTerm.textContent = profile.emotional.englishTerm;
    this.englishTerm.hidden = duplicate || emotionMissing;
    this.emotional.setAttribute(
      "aria-label",
      emotionMissing ? profile.emotional.filteredOut
        ? "Emotional pain: all categories excluded" : "Emotional pain: data unavailable" :
      `Emotional pain: ${profile.emotional.nativeTerm}; ` +
        `English: ${profile.emotional.englishTerm}; normalized signal ` +
        `${Math.round(profile.emotional.value! * 100)} of 100`,
    );
    this.environmental.update(profile);
    this.physical.update(profile);
    this.socioeconomic.update(profile);
    if (this.boundsObserver) this.syncBounds();
  }

  setSuppressed(suppressed: boolean): void {
    const reveal = this.suppressed && !suppressed && this.profile !== null && this.softReveal &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.suppressed = suppressed;
    this.host.hidden = !this.preview && (this.profile === null || suppressed);
    if (this.boundsObserver) this.syncBounds();
    if (suppressed) delete this.host.dataset.revealing;
    else if (reveal) {
      delete this.host.dataset.revealing;
      void this.host.offsetWidth;
      this.host.dataset.revealing = "true";
    }
  }

  /** Heading-only destination preview, without changing selection, metrics, or the network. */
  setPreview(profile: CountryPainProfile | null): void {
    this.preview = profile;
    this.host.dataset.stage = profile ? "heading" : "full";
    this.host.hidden = !profile && (this.profile === null || this.suppressed);
    this.countryName.textContent = (profile?.countryName ?? this.profile?.countryName ?? "").toLocaleLowerCase("en");
    if (this.boundsObserver) this.syncBounds();
  }

  setAutoplay(autoplay: boolean): void {
    this.host.setAttribute("aria-live", autoplay ? "off" : "polite");
  }

  destroy(): void {
    if (this.transitionTimer !== null) window.clearTimeout(this.transitionTimer);
    this.boundsObserver?.disconnect();
    for (const element of this.obstacles) element.removeEventListener("transitionend", this.syncBounds);
    window.removeEventListener("resize", this.syncBounds);
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
