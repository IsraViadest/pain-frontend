/**
 * Opt-in dev HUD: layer visibility toggles + tuning sliders for GlobeView.
 * Mounted from main.ts when ?globeDebug=1 or localStorage pain-globe-debug=1.
 * Not shown in production builds unless that opt-in is enabled.
 */
import {
  GLOBE_DEBUG_TUNE_DEFAULTS,
  type Co2HazeTune,
  type GlobeDebugLayerId,
  type GlobeDebugLayerState,
  type GlobeDebugTune,
  type GlobeHeatTune,
  type GlobeMarkerTune,
  type GlobeView,
  type TempHeatTune,
} from "./GlobeView";

const LAYER_UI: {
  id: GlobeDebugLayerId;
  label: string;
  hint?: string;
}[] = [
  { id: "glow", label: "Rim glow (sphere)", hint: "glow · larger additive shell" },
  { id: "globe", label: "Solid globe mesh", hint: "globe · MeshStandardMaterial" },
  { id: "stipple", label: "Stipple (all points)", hint: "pointsStipple" },
  {
    id: "stippleLand",
    label: "Stipple — land only",
    hint: "shader uShowLand · dents inward in scar mode",
  },
  {
    id: "stippleOcean",
    label: "Stipple — ocean only",
    hint: "shader uShowOcean · stays at base radius",
  },
  { id: "coastlines", label: "Coast outlines", hint: "bordersOutlines coast" },
  {
    id: "countryBorders",
    label: "Country borders",
    hint: "bordersOutlines inner",
  },
  { id: "markers", label: "Pain markers", hint: "markersGroup · points mode" },
  { id: "multiplex", label: "Multiplex graph", hint: "multiplexGroup" },
  { id: "wordCloud", label: "Word cloud sprites", hint: "textLayerGroup" },
  {
    id: "scarDisplacement",
    label: "Scar dents (GPU)",
    hint: "uScarActive · not a mesh",
  },
  {
    id: "heatOverlay",
    label: "Heat tint (GPU)",
    hint: "uHeatActive · land stipple only",
  },
  {
    id: "hemisphereClip",
    label: "Hemisphere cull",
    hint: "stipple: facing shader · borders/markers: clip plane",
  },
  { id: "lights", label: "Lights (all)", hint: "ambient + key + fill" },
];

function layerLabel(meta: (typeof LAYER_UI)[number]): string {
  return meta.label;
}

type TuneSliderSpec = {
  key: keyof GlobeDebugTune;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  /** Display decimals (blur radii → 0). */
  decimals?: number;
};

const TUNE_SECTIONS: {
  summary: string;
  defaultOpen: boolean;
  sliders: TuneSliderSpec[];
}[] = [
  {
    summary: "Clip & rim glow",
    defaultOpen: false,
    sliders: [
      {
        key: "facingCullMin",
        label: "Facing cull min",
        hint: "Stipple limb discard. Negative keeps more rim dots.",
        min: -0.2,
        max: 0.35,
        step: 0.005,
      },
      {
        key: "hemisphereClipBias",
        label: "Hemisphere clip bias",
        hint: "Clip plane offset (world units along view); more negative = harder limb cut.",
        min: -0.5,
        max: 0.2,
        step: 0.005,
      },
      {
        key: "glowIntensity",
        label: "Rim glow intensity",
        hint: "uGlowIntensity on rim sphere.",
        min: 0,
        max: 0.6,
        step: 0.01,
      },
    ],
  },
  {
    summary: "Stipple & GPU scar",
    defaultOpen: false,
    sliders: [
      {
        key: "scarDispScale",
        label: "Scar dent scale (GPU)",
        hint: "Radial depth from height map.",
        min: 0,
        max: 0.2,
        step: 0.002,
      },
      {
        key: "scarDispBias",
        label: "Scar dent bias (GPU)",
        hint: "Adds constant radial offset.",
        min: -0.1,
        max: 0.02,
        step: 0.002,
      },
      {
        key: "oceanAlphaBoost",
        label: "Ocean alpha boost",
        hint: "Ocean stipple sprite opacity multiplier.",
        min: 0.2,
        max: 8,
        step: 0.05,
      },
      {
        key: "oceanAlphaMin",
        label: "Ocean alpha min",
        hint: "Floor opacity for ocean dots.",
        min: 0,
        max: 1,
        step: 0.01,
      },
    ],
  },
  {
    summary: "Scar height map (CPU stamp)",
    defaultOpen: false,
    sliders: [
      {
        key: "scarStampRadiusMin",
        label: "Stamp radius min (px)",
        hint: "Floor footprint on 1000×482 texture.",
        min: 1,
        max: 32,
        step: 1,
        decimals: 0,
      },
      {
        key: "scarStampRadiusMul",
        label: "Stamp footprint scale",
        hint: ">1 widens bumps (smoother, less sharp detail); <1 sharper / spikier.",
        min: 0.15,
        max: 4,
        step: 0.05,
      },
      {
        key: "scarStampPeakMul",
        label: "Stamp depth mul",
        hint: "Brightness of each dent before GPU scale (detail vs strength).",
        min: 0.2,
        max: 2.5,
        step: 0.05,
      },
      {
        key: "scarFalloffSigma",
        label: "Stamp falloff σ",
        hint: "Gaussian shoulder exp(−t²σ); ↑ sharper peak, ↓ softer dish.",
        min: 0.5,
        max: 12,
        step: 0.05,
      },
      {
        key: "scarBlurPass1Radius",
        label: "Blur pass 1 (px)",
        hint: "0 = off. Wider smoothing (flattens, merges bumps).",
        min: 0,
        max: 12,
        step: 1,
        decimals: 0,
      },
      {
        key: "scarBlurPass2Radius",
        label: "Blur pass 2 (px)",
        hint: "Second box blur after pass 1; 0 = off.",
        min: 0,
        max: 12,
        step: 1,
        decimals: 0,
      },
    ],
  },
];

type MarkerTuneSliderSpec = {
  key: keyof GlobeMarkerTune;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  decimals?: number;
};

const MARKER_TUNE_SLIDERS: MarkerTuneSliderSpec[] = [
  {
    key: "radius",
    label: "Marker radius",
    hint: "Instance scale × unit sphere geometry (0.018); default radius 0.006.",
    min: 0.005,
    max: 0.05,
    step: 0.001,
  },
  {
    key: "roughness",
    label: "Roughness",
    hint: "MeshStandardMaterial roughness.",
    min: 0,
    max: 1,
    step: 0.01,
    decimals: 2,
  },
  {
    key: "metalness",
    label: "Metalness",
    hint: "MeshStandardMaterial metalness.",
    min: 0,
    max: 1,
    step: 0.01,
    decimals: 2,
  },
  {
    key: "opacity",
    label: "Opacity",
    hint: "Material opacity; < 1 enables transparent.",
    min: 0,
    max: 1,
    step: 0.01,
    decimals: 2,
  },
  {
    key: "emissiveBase",
    label: "Emissive intensity",
    hint: "Emissive floor (min 0.25 — ensures low-intensity points stay visible)",
    min: 0.25,
    max: 1,
    step: 0.01,
    decimals: 2,
  },
];

type HeatTuneSliderSpec = {
  key: keyof GlobeHeatTune;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  decimals?: number;
};

const HEAT_MAP_TUNE_SLIDERS: HeatTuneSliderSpec[] = [
  {
    key: "peakPower",
    label: "Peak power (exponent)",
    hint: "How much low-intensity areas show up — higher = only the most intense areas appear red, lower = more areas show color",
    min: 0.5,
    max: 3,
    step: 0.1,
    decimals: 1,
  },
  {
    key: "peakFloor",
    label: "Peak floor",
    hint: "Minimum color contribution — 0 means zero-intensity areas show nothing, higher means all areas show some color",
    min: 0,
    max: 0.5,
    step: 0.01,
    decimals: 2,
  },
  {
    key: "heatStrength",
    label: "Heat strength",
    hint: "How strongly the red color replaces the base globe color — higher = more vivid red coverage",
    min: 0.5,
    max: 5,
    step: 0.1,
    decimals: 2,
  },
];

type Co2HazeTuneSliderSpec = {
  key: keyof Co2HazeTune;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  decimals?: number;
};

const CO2_HAZE_TUNE_SLIDERS: Co2HazeTuneSliderSpec[] = [
  {
    key: "stampRadiusBase",
    label: "Stamp radius base",
    hint: "Base stamp radius in texture pixels (before intensity scaling).",
    min: 1,
    max: 20,
    step: 1,
    decimals: 0,
  },
  {
    key: "stampRadiusSpan",
    label: "Stamp radius span",
    hint: "Extra stamp radius at full intensity (px).",
    min: 1,
    max: 30,
    step: 1,
    decimals: 0,
  },
  {
    key: "blurPass1Radius",
    label: "Blur pass 1",
    hint: "First box-blur radius (px).",
    min: 0,
    max: 10,
    step: 1,
    decimals: 0,
  },
  {
    key: "blurPass2Radius",
    label: "Blur pass 2",
    hint: "Second box-blur radius (px).",
    min: 0,
    max: 10,
    step: 1,
    decimals: 0,
  },
  {
    key: "maxAlpha",
    label: "Max alpha",
    hint: "Cap on densest texel alpha (0–255).",
    min: 0,
    max: 255,
    step: 5,
    decimals: 0,
  },
  {
    key: "alphaThreshold",
    label: "Alpha threshold",
    hint: "Normalized values below this become fully transparent.",
    min: 0,
    max: 0.5,
    step: 0.01,
    decimals: 2,
  },
];

type TempHeatTuneSliderSpec = {
  key: keyof TempHeatTune;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  decimals?: number;
};

const TEMP_HEAT_TUNE_SLIDERS: TempHeatTuneSliderSpec[] = [
  {
    key: "stampRadiusBase",
    label: "Stamp radius base",
    hint: "Base stamp radius in texture pixels (before intensity scaling).",
    min: 1,
    max: 20,
    step: 1,
    decimals: 0,
  },
  {
    key: "stampRadiusSpan",
    label: "Stamp radius span",
    hint: "Extra stamp radius at full intensity (px).",
    min: 0,
    max: 20,
    step: 1,
    decimals: 0,
  },
  {
    key: "blurPass1Radius",
    label: "Blur pass 1",
    hint: "First box-blur radius (px); 0 skips the pass.",
    min: 0,
    max: 10,
    step: 1,
    decimals: 0,
  },
  {
    key: "blurPass2Radius",
    label: "Blur pass 2",
    hint: "Second box-blur radius (px); 0 skips the pass.",
    min: 0,
    max: 10,
    step: 1,
    decimals: 0,
  },
  {
    key: "heatStrength",
    label: "Heat strength",
    hint: "How strongly the Temperature shell opacity is scaled (multiplies the breathing base).",
    min: 0,
    max: 2,
    step: 0.05,
    decimals: 2,
  },
];

/** Sliders flattened for sync (`Scar …` section checkbox lives separately). */
const ALL_TUNING_SLIDER_SPECS = TUNE_SECTIONS.flatMap((s) => s.sliders);

function formatTuneValue(value: number, decimals: number): string {
  if (decimals <= 0) return String(Math.round(value));
  return value.toFixed(decimals);
}

function makeDetails(summaryText: string, defaultOpen: boolean): {
  el: HTMLDetailsElement;
  body: HTMLElement;
} {
  const details = document.createElement("details");
  details.className = "globe-debug-panel__details";
  details.open = defaultOpen;
  const summary = document.createElement("summary");
  summary.className = "globe-debug-panel__details-summary";
  summary.textContent = summaryText;
  const body = document.createElement("div");
  body.className = "globe-debug-panel__details-body";
  details.append(summary, body);
  return { el: details, body };
}

/**
 * Full globe layer / tuning UI. Mount once; show/hide via `#globe-debug-toggle` in `main.ts`.
 */
export function mountGlobeDebugPanel(
  globe: GlobeView,
  host: HTMLElement,
  scarPreviewCanvas?: HTMLCanvasElement | null,
): () => void {
  host.classList.add("globe-debug-panel");
  host.innerHTML = "";

  const title = document.createElement("h2");
  title.className = "globe-debug-panel__title";
  title.textContent = "Globe debug";
  host.appendChild(title);

  const layersBlock = makeDetails("Layer visibility", false);
  const layerIntro = document.createElement("p");
  layerIntro.className = "globe-debug-panel__intro";
  layerIntro.textContent =
    "Toggle visibility. Italic = manual override (Reset overrides restores app defaults).";
  layersBlock.body.appendChild(layerIntro);

  const list = document.createElement("ul");
  list.className = "globe-debug-panel__list";

  const rowById = new Map<GlobeDebugLayerId, HTMLLabelElement>();

  for (const meta of LAYER_UI) {
    const li = document.createElement("li");
    li.className = "globe-debug-panel__item";

    const label = document.createElement("label");
    label.className = "globe-debug-panel__row";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.layerId = meta.id;

    const text = document.createElement("span");
    text.className = "globe-debug-panel__label";
    text.textContent = layerLabel(meta);

    const code = document.createElement("code");
    code.className = "globe-debug-panel__code";
    code.textContent = meta.hint ?? meta.id;

    label.append(cb, text);
    li.append(label, code);
    list.appendChild(li);
    rowById.set(meta.id, label);

    cb.addEventListener("change", () => {
      globe.setDebugLayerVisible(meta.id, cb.checked);
      refresh();
    });
  }

  layersBlock.body.appendChild(list);
  host.appendChild(layersBlock.el);

  const tuningIntro = document.createElement("p");
  tuningIntro.className = "globe-debug-panel__intro globe-debug-panel__intro--below-layers";
  tuningIntro.textContent =
    "Tuning grouped below. Changing scar height-map values rebuilds the CPU texture (scar / multiplex mode).";
  host.appendChild(tuningIntro);

  const tuneInputs: Partial<
    Record<keyof GlobeDebugTune, HTMLInputElement>
  > = {};

  let landOnlyCheckboxRef: HTMLInputElement | null = null;

  for (const section of TUNE_SECTIONS) {
    const block = makeDetails(section.summary, section.defaultOpen);

    if (section.summary === "Stipple & GPU scar") {
      const landOnlyRow = document.createElement("label");
      landOnlyRow.className =
        "globe-debug-panel__tune-row globe-debug-panel__tune-row--check";
      const landOnlyCb = document.createElement("input");
      landOnlyCb.type = "checkbox";
      landOnlyCb.checked =
        GLOBE_DEBUG_TUNE_DEFAULTS.scarLandOnly >= 0.5;
      landOnlyCb.title =
        "Land dents only — off = land+ocean move together (reduces inner sphere)";
      const landOnlyText = document.createElement("span");
      landOnlyText.textContent =
        "Scar dents on land only (off = ocean + land together)";
      landOnlyRow.append(landOnlyCb, landOnlyText);
      block.body.appendChild(landOnlyRow);
      landOnlyCheckboxRef = landOnlyCb;
      landOnlyCb.addEventListener("change", () => {
        globe.setDebugTune({ scarLandOnly: landOnlyCb.checked ? 1 : 0 });
      });
    }

    for (const spec of section.sliders) {
      const row = document.createElement("label");
      row.className = "globe-debug-panel__tune-row";

      const head = document.createElement("span");
      head.className = "globe-debug-panel__tune-head";
      const valSpan = document.createElement("output");
      valSpan.className = "globe-debug-panel__tune-val";

      const range = document.createElement("input");
      range.type = "range";
      range.min = String(spec.min);
      range.max = String(spec.max);
      range.step = String(spec.step);

      const hint = document.createElement("span");
      hint.className = "globe-debug-panel__tune-hint";
      hint.textContent = spec.hint;

      head.textContent = `${spec.label} `;
      head.append(valSpan);
      row.append(head, range, hint);
      block.body.appendChild(row);
      tuneInputs[spec.key] = range;

      const decimals = spec.decimals ?? 3;

      range.addEventListener("input", () => {
        const v = Number(range.value);
        valSpan.textContent = formatTuneValue(v, decimals);
        globe.setDebugTune({ [spec.key]: v });
      });
    }

    if (section.summary === "Scar height map (CPU stamp)" && scarPreviewCanvas) {
      const scarHint = document.createElement("p");
      scarHint.className = "globe-debug-panel__hint globe-debug-panel__hint--nested";
      scarHint.textContent = "Preview (128 = flat)";
      block.body.appendChild(scarHint);
      scarPreviewCanvas.classList.add("scar-map-preview");
      block.body.appendChild(scarPreviewCanvas);
      globe.setScarMapPreviewCanvas(scarPreviewCanvas);
    }

    host.appendChild(block.el);
  }

  const heatMapTuneBlock = makeDetails("Heat map", false);
  const heatMapTuneIntro = document.createElement("p");
  heatMapTuneIntro.className =
    "globe-debug-panel__intro globe-debug-panel__intro--nested";
  heatMapTuneIntro.textContent =
    "Scar / multiplex land stipple tint — peak sliders rebuild the CPU heat texture live.";
  heatMapTuneBlock.body.appendChild(heatMapTuneIntro);

  const heatTuneInputs: Partial<
    Record<keyof GlobeHeatTune, HTMLInputElement>
  > = {};

  for (const spec of HEAT_MAP_TUNE_SLIDERS) {
    const row = document.createElement("label");
    row.className = "globe-debug-panel__tune-row";

    const head = document.createElement("span");
    head.className = "globe-debug-panel__tune-head";
    const valSpan = document.createElement("output");
    valSpan.className = "globe-debug-panel__tune-val";

    const range = document.createElement("input");
    range.type = "range";
    range.min = String(spec.min);
    range.max = String(spec.max);
    range.step = String(spec.step);

    const hint = document.createElement("span");
    hint.className = "globe-debug-panel__tune-hint";
    hint.textContent = spec.hint;

    head.textContent = `${spec.label} `;
    head.append(valSpan);
    row.append(head, range, hint);
    heatMapTuneBlock.body.appendChild(row);
    heatTuneInputs[spec.key] = range;

    const decimals = spec.decimals ?? 3;

    range.addEventListener("input", () => {
      const v = Number(range.value);
      valSpan.textContent = formatTuneValue(v, decimals);
      globe.setHeatTune({ [spec.key]: v });
    });
  }

  const resetHeatTuneBtn = document.createElement("button");
  resetHeatTuneBtn.type = "button";
  resetHeatTuneBtn.className = "globe-debug-panel__action";
  resetHeatTuneBtn.textContent = "Reset heat map";
  resetHeatTuneBtn.addEventListener("click", () => {
    globe.resetHeatTune();
    syncHeatTuneSliders();
  });
  heatMapTuneBlock.body.appendChild(resetHeatTuneBtn);
  host.appendChild(heatMapTuneBlock.el);

  const co2HazeTuneBlock = makeDetails("CO2 Haze", false);
  const co2HazeTuneIntro = document.createElement("p");
  co2HazeTuneIntro.className =
    "globe-debug-panel__intro globe-debug-panel__intro--nested";
  co2HazeTuneIntro.textContent =
    "Gray additive shell from category === CO2 — sliders update knobs; Rebuild applies (CPU stamp can be slow on large Env layers).";
  co2HazeTuneBlock.body.appendChild(co2HazeTuneIntro);

  const co2HazeTuneInputs: Partial<
    Record<keyof Co2HazeTune, HTMLInputElement>
  > = {};

  for (const spec of CO2_HAZE_TUNE_SLIDERS) {
    const row = document.createElement("label");
    row.className = "globe-debug-panel__tune-row";

    const head = document.createElement("span");
    head.className = "globe-debug-panel__tune-head";
    const valSpan = document.createElement("output");
    valSpan.className = "globe-debug-panel__tune-val";

    const range = document.createElement("input");
    range.type = "range";
    range.min = String(spec.min);
    range.max = String(spec.max);
    range.step = String(spec.step);

    const hint = document.createElement("span");
    hint.className = "globe-debug-panel__tune-hint";
    hint.textContent = spec.hint;

    head.textContent = `${spec.label} `;
    head.append(valSpan);
    row.append(head, range, hint);
    co2HazeTuneBlock.body.appendChild(row);
    co2HazeTuneInputs[spec.key] = range;

    const decimals = spec.decimals ?? 3;

    range.addEventListener("input", () => {
      const v = Number(range.value);
      valSpan.textContent = formatTuneValue(v, decimals);
      globe.setCo2HazeTune({ [spec.key]: v });
    });
  }

  const rebuildCo2HazeBtn = document.createElement("button");
  rebuildCo2HazeBtn.type = "button";
  rebuildCo2HazeBtn.className = "globe-debug-panel__action";
  rebuildCo2HazeBtn.textContent = "Rebuild";
  rebuildCo2HazeBtn.addEventListener("click", () => {
    globe.rebuildCo2Haze();
  });
  co2HazeTuneBlock.body.appendChild(rebuildCo2HazeBtn);
  host.appendChild(co2HazeTuneBlock.el);

  const tempHeatTuneBlock = makeDetails("Temperature Heat", false);
  const tempHeatTuneIntro = document.createElement("p");
  tempHeatTuneIntro.className =
    "globe-debug-panel__intro globe-debug-panel__intro--nested";
  tempHeatTuneIntro.textContent =
    "Red additive shell from category === Temperature — sliders update stamp/blur; Rebuild applies (CPU stamp can be slow on large Env layers). Heat strength scales shell opacity live.";
  tempHeatTuneBlock.body.appendChild(tempHeatTuneIntro);

  const tempHeatTuneInputs: Partial<
    Record<keyof TempHeatTune, HTMLInputElement>
  > = {};

  for (const spec of TEMP_HEAT_TUNE_SLIDERS) {
    const row = document.createElement("label");
    row.className = "globe-debug-panel__tune-row";

    const head = document.createElement("span");
    head.className = "globe-debug-panel__tune-head";
    const valSpan = document.createElement("output");
    valSpan.className = "globe-debug-panel__tune-val";

    const range = document.createElement("input");
    range.type = "range";
    range.min = String(spec.min);
    range.max = String(spec.max);
    range.step = String(spec.step);

    const hint = document.createElement("span");
    hint.className = "globe-debug-panel__tune-hint";
    hint.textContent = spec.hint;

    head.textContent = `${spec.label} `;
    head.append(valSpan);
    row.append(head, range, hint);
    tempHeatTuneBlock.body.appendChild(row);
    tempHeatTuneInputs[spec.key] = range;

    const decimals = spec.decimals ?? 3;

    range.addEventListener("input", () => {
      const v = Number(range.value);
      valSpan.textContent = formatTuneValue(v, decimals);
      globe.setTempHeatTune({ [spec.key]: v });
    });
  }

  const rebuildTempHeatBtn = document.createElement("button");
  rebuildTempHeatBtn.type = "button";
  rebuildTempHeatBtn.className = "globe-debug-panel__action";
  rebuildTempHeatBtn.textContent = "Rebuild";
  rebuildTempHeatBtn.addEventListener("click", () => {
    globe.rebuildTempHeat();
  });
  tempHeatTuneBlock.body.appendChild(rebuildTempHeatBtn);
  host.appendChild(tempHeatTuneBlock.el);

  const markerTuneBlock = makeDetails("Markers", false);
  const markerTuneIntro = document.createElement("p");
  markerTuneIntro.className =
    "globe-debug-panel__intro globe-debug-panel__intro--nested";
  markerTuneIntro.textContent =
    "Pain marker InstancedMesh — material updates live; radius rebuilds instance matrices.";
  markerTuneBlock.body.appendChild(markerTuneIntro);

  const showMarkersRow = document.createElement("label");
  showMarkersRow.className =
    "globe-debug-panel__tune-row globe-debug-panel__tune-row--check";
  const showMarkersCb = document.createElement("input");
  showMarkersCb.type = "checkbox";
  showMarkersCb.checked = globe.getMarkersDebugEnabled();
  const showMarkersText = document.createElement("span");
  showMarkersText.textContent = "Show point markers (debug only)";
  showMarkersRow.append(showMarkersCb, showMarkersText);
  markerTuneBlock.body.appendChild(showMarkersRow);
  showMarkersCb.addEventListener("change", () => {
    globe.setMarkersDebugEnabled(showMarkersCb.checked);
  });

  const markerTuneInputs: Partial<
    Record<keyof GlobeMarkerTune, HTMLInputElement>
  > = {};

  for (const spec of MARKER_TUNE_SLIDERS) {
    const row = document.createElement("label");
    row.className = "globe-debug-panel__tune-row";

    const head = document.createElement("span");
    head.className = "globe-debug-panel__tune-head";
    const valSpan = document.createElement("output");
    valSpan.className = "globe-debug-panel__tune-val";

    const range = document.createElement("input");
    range.type = "range";
    range.min = String(spec.min);
    range.max = String(spec.max);
    range.step = String(spec.step);

    const hint = document.createElement("span");
    hint.className = "globe-debug-panel__tune-hint";
    hint.textContent = spec.hint;

    head.textContent = `${spec.label} `;
    head.append(valSpan);
    row.append(head, range, hint);
    markerTuneBlock.body.appendChild(row);
    markerTuneInputs[spec.key] = range;

    const decimals = spec.decimals ?? 3;

    range.addEventListener("input", () => {
      const v = Number(range.value);
      valSpan.textContent = formatTuneValue(v, decimals);
      globe.setMarkerTune({ [spec.key]: v });
    });
  }

  const resetMarkerTuneBtn = document.createElement("button");
  resetMarkerTuneBtn.type = "button";
  resetMarkerTuneBtn.className = "globe-debug-panel__action";
  resetMarkerTuneBtn.textContent = "Reset markers";
  resetMarkerTuneBtn.addEventListener("click", () => {
    globe.resetMarkerTune();
    syncMarkerTuneSliders();
  });
  markerTuneBlock.body.appendChild(resetMarkerTuneBtn);
  host.appendChild(markerTuneBlock.el);

  const borderTuneBlock = makeDetails("Borders", false);
  const borderTuneIntro = document.createElement("p");
  borderTuneIntro.className =
    "globe-debug-panel__intro globe-debug-panel__intro--nested";
  borderTuneIntro.textContent =
    "Coast/country line shell — uniform group scale (slightly above unit globe to reduce z-fighting).";
  borderTuneBlock.body.appendChild(borderTuneIntro);

  const borderScaleRow = document.createElement("label");
  borderScaleRow.className = "globe-debug-panel__tune-row";
  const borderScaleHead = document.createElement("span");
  borderScaleHead.className = "globe-debug-panel__tune-head";
  const borderScaleVal = document.createElement("output");
  borderScaleVal.className = "globe-debug-panel__tune-val";
  const borderScaleRange = document.createElement("input");
  borderScaleRange.type = "range";
  borderScaleRange.min = "0.99";
  borderScaleRange.max = "1.01";
  borderScaleRange.step = "0.0001";
  const borderScaleHint = document.createElement("span");
  borderScaleHint.className = "globe-debug-panel__tune-hint";
  borderScaleHint.textContent =
    "bordersOutlines.group.scale.setScalar — default 0.99.";
  borderScaleHead.textContent = "Shell scale ";
  borderScaleHead.append(borderScaleVal);
  borderScaleRow.append(borderScaleHead, borderScaleRange, borderScaleHint);
  borderTuneBlock.body.appendChild(borderScaleRow);

  borderScaleRange.addEventListener("input", () => {
    const v = Number(borderScaleRange.value);
    borderScaleVal.textContent = formatTuneValue(v, 4);
    globe.setBorderShellScale(v);
  });

  const resetBorderTuneBtn = document.createElement("button");
  resetBorderTuneBtn.type = "button";
  resetBorderTuneBtn.className = "globe-debug-panel__action";
  resetBorderTuneBtn.textContent = "Reset borders";
  resetBorderTuneBtn.addEventListener("click", () => {
    globe.resetBorderShellScale();
    syncBorderTuneSliders();
  });
  borderTuneBlock.body.appendChild(resetBorderTuneBtn);
  host.appendChild(borderTuneBlock.el);

  function syncTuneSliders(): void {
    const t = globe.getDebugTune();
    for (const spec of ALL_TUNING_SLIDER_SPECS) {
      const range = tuneInputs[spec.key];
      if (!range) continue;
      range.value = String(t[spec.key]);
      const out = range.parentElement?.querySelector("output");
      const decimals = spec.decimals ?? 3;
      if (out)
        out.textContent = formatTuneValue(Number(t[spec.key]), decimals);
    }
    if (landOnlyCheckboxRef)
      landOnlyCheckboxRef.checked = t.scarLandOnly >= 0.5;
  }

  function syncMarkerTuneSliders(): void {
    const t = globe.getMarkerTune();
    for (const spec of MARKER_TUNE_SLIDERS) {
      const range = markerTuneInputs[spec.key];
      if (!range) continue;
      range.value = String(t[spec.key]);
      const out = range.parentElement?.querySelector("output");
      const decimals = spec.decimals ?? 3;
      if (out)
        out.textContent = formatTuneValue(Number(t[spec.key]), decimals);
    }
  }

  function syncBorderTuneSliders(): void {
    const v = globe.getBorderShellScale();
    borderScaleRange.value = String(v);
    borderScaleVal.textContent = formatTuneValue(v, 4);
  }

  function syncHeatTuneSliders(): void {
    const t = globe.getHeatTune();
    for (const spec of HEAT_MAP_TUNE_SLIDERS) {
      const range = heatTuneInputs[spec.key];
      if (!range) continue;
      range.value = String(t[spec.key]);
      const out = range.parentElement?.querySelector("output");
      const decimals = spec.decimals ?? 3;
      if (out)
        out.textContent = formatTuneValue(Number(t[spec.key]), decimals);
    }
  }

  function syncCo2HazeTuneSliders(): void {
    const t = globe.getCo2HazeTune();
    for (const spec of CO2_HAZE_TUNE_SLIDERS) {
      const range = co2HazeTuneInputs[spec.key];
      if (!range) continue;
      range.value = String(t[spec.key]);
      const out = range.parentElement?.querySelector("output");
      const decimals = spec.decimals ?? 3;
      if (out)
        out.textContent = formatTuneValue(Number(t[spec.key]), decimals);
    }
  }

  function syncTempHeatTuneSliders(): void {
    const t = globe.getTempHeatTune();
    for (const spec of TEMP_HEAT_TUNE_SLIDERS) {
      const range = tempHeatTuneInputs[spec.key];
      if (!range) continue;
      range.value = String(t[spec.key]);
      const out = range.parentElement?.querySelector("output");
      const decimals = spec.decimals ?? 3;
      if (out)
        out.textContent = formatTuneValue(Number(t[spec.key]), decimals);
    }
  }

  const buttonWrap = document.createElement("div");
  buttonWrap.className = "globe-debug-panel__actions";

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.textContent = "Reset overrides";
  resetBtn.addEventListener("click", () => {
    globe.resetDebugLayerOverrides();
    refresh();
  });

  const resetTuneBtn = document.createElement("button");
  resetTuneBtn.type = "button";
  resetTuneBtn.textContent = "Reset tuning";
  resetTuneBtn.addEventListener("click", () => {
    globe.resetDebugTune();
    syncTuneSliders();
  });

  const logTuneBtn = document.createElement("button");
  logTuneBtn.type = "button";
  logTuneBtn.textContent = "Log tuning";
  logTuneBtn.addEventListener("click", () => {
    console.info("[globe debug tune]", globe.getDebugTune());
    console.log("[markerTune]", globe.getMarkerTune());
    console.log("[heatTune]", globe.getHeatTune());
    console.log("[co2HazeTune]", globe.getCo2HazeTune());
    console.log("[borderShellScale]", globe.getBorderShellScale());
    console.log("[tempHeatTune]", globe.getTempHeatTune());
  });

  const syncBtn = document.createElement("button");
  syncBtn.type = "button";
  syncBtn.textContent = "Refresh state";
  syncBtn.addEventListener("click", () => refresh());

  buttonWrap.append(resetBtn, resetTuneBtn, logTuneBtn, syncBtn);
  host.appendChild(buttonWrap);
  syncTuneSliders();
  syncMarkerTuneSliders();
  syncBorderTuneSliders();
  syncHeatTuneSliders();
  syncCo2HazeTuneSliders();
  syncTempHeatTuneSliders();

  if (
    scarPreviewCanvas &&
    !host.querySelector("canvas.scar-map-preview")
  ) {
    const hint = document.createElement("p");
    hint.className = "globe-debug-panel__hint";
    hint.textContent = "Scar height map (128 = flat):";
    host.appendChild(hint);
    scarPreviewCanvas.classList.add("scar-map-preview");
    host.appendChild(scarPreviewCanvas);
    globe.setScarMapPreviewCanvas(scarPreviewCanvas);
  }

  function applyState(state: GlobeDebugLayerState): void {
    const label = rowById.get(state.id);
    if (!label) return;
    const cb = label.querySelector<HTMLInputElement>("input[type=checkbox]");
    if (!cb) return;
    cb.checked = state.visible;
    cb.disabled = !state.available;
    label.classList.toggle("globe-debug-panel__row--override", state.overridden);
    label.classList.toggle("globe-debug-panel__row--unavailable", !state.available);
    const code = label.parentElement?.querySelector(".globe-debug-panel__code");
    if (code) {
      const auto = state.available
        ? `auto: ${state.autoVisible ? "on" : "off"}`
        : "not loaded";
      code.textContent = `${LAYER_UI.find((m) => m.id === state.id)?.hint ?? state.id} · ${auto}`;
    }
  }

  function refresh(): void {
    for (const state of globe.getDebugLayerStates()) {
      applyState(state);
    }
    syncTuneSliders();
    syncMarkerTuneSliders();
    syncBorderTuneSliders();
  }

  refresh();
  const interval = window.setInterval(refresh, 800);

  return () => {
    window.clearInterval(interval);
    host.innerHTML = "";
    host.classList.remove("globe-debug-panel");
  };
}

const GLOBE_DEBUG_LS_KEY = "pain-globe-debug";

/**
 * Opt-in: show bottom-right Debug control (does not mount the panel until opened).
 * Enable with `?globeDebug=1` or `localStorage.setItem("pain-globe-debug", "1")` then reload.
 */
export function shouldShowGlobeDebugPanel(): boolean {
  try {
    if (localStorage.getItem(GLOBE_DEBUG_LS_KEY) === "1") return true;
  } catch {
    /* private mode / quota */
  }
  try {
    const v = new URLSearchParams(window.location.search).get("globeDebug");
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}
