import {
  GLOBE_DEBUG_TUNE_DEFAULTS,
  type GlobeDebugLayerId,
  type GlobeDebugLayerState,
  type GlobeDebugTune,
  type GlobeView,
} from "./GlobeView";

const LAYER_UI: {
  id: GlobeDebugLayerId;
  label: string;
  hint?: string;
}[] = [
  { id: "glow", label: "Rim glow (sphere)", hint: "glow · larger additive shell" },
  { id: "globe", label: "Solid globe mesh", hint: "globe · MeshStandardMaterial" },
  {
    id: "stippleSubstrate",
    label: "Stipple substrate (opaque)",
    hint: "stippleSubstrate · land+ocean shell under dots",
  },
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
  { id: "wordCloud", label: "Word cloud sprites", hint: "emotionalWordsGroup" },
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

/**
 * Temporary HUD to toggle every globe layer (dev / `?globeDebug=1`).
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
  title.textContent = "Globe layers (debug)";
  host.appendChild(title);

  const intro = document.createElement("p");
  intro.className = "globe-debug-panel__intro";
  intro.textContent =
    "Toggle visibility. Italic rows = manual override (Reset restores app defaults).";
  host.appendChild(intro);

  const list = document.createElement("ul");
  list.className = "globe-debug-panel__list";
  host.appendChild(list);

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

  const tuneTitle = document.createElement("h3");
  tuneTitle.className = "globe-debug-panel__subtitle";
  tuneTitle.textContent = "Inner-shell tuning";
  host.appendChild(tuneTitle);

  const tuneIntro = document.createElement("p");
  tuneIntro.className = "globe-debug-panel__intro";
  tuneIntro.textContent =
    "Ocean fill = mesh behind dots (not canvas clear). ↑ ocean alpha min fills gaps.";
  host.appendChild(tuneIntro);

  const tuneForm = document.createElement("div");
  tuneForm.className = "globe-debug-panel__tune";
  host.appendChild(tuneForm);

  const tuneSliders: {
    key: keyof GlobeDebugTune;
    label: string;
    hint: string;
    min: number;
    max: number;
    step: number;
  }[] = [
    {
      key: "facingCullMin",
      label: "Facing cull min",
      hint: "Hide back/limb stipple (uFacingCullMin). Try 0.12–0.22.",
      min: -0.2,
      max: 0.35,
      step: 0.005,
    },
    {
      key: "hemisphereClipBias",
      label: "Hemisphere clip bias",
      hint: "More negative = clip more at limb (back coastlines bleed). Try -0.02 to -0.08.",
      min: -0.12,
      max: 0.02,
      step: 0.005,
    },
    {
      key: "scarDispScale",
      label: "Scar dent scale",
      hint: "Depth of dents (uScarDispScale). Lower = flatter.",
      min: 0,
      max: 0.12,
      step: 0.002,
    },
    {
      key: "scarDispBias",
      label: "Scar dent bias",
      hint: "Inward pull (uScarDispBias). Less negative = less recess.",
      min: -0.1,
      max: 0.02,
      step: 0.002,
    },
    {
      key: "oceanAlphaBoost",
      label: "Ocean alpha boost",
      hint: "↑ = less black between dots (uOceanAlphaBoost). Try 2–5.",
      min: 0.5,
      max: 8,
      step: 0.1,
    },
    {
      key: "oceanAlphaMin",
      label: "Ocean alpha min",
      hint: "Floor opacity for ocean dots (uOceanAlphaMin). Try 0.4–0.7.",
      min: 0,
      max: 1,
      step: 0.02,
    },
    {
      key: "substrateScale",
      label: "Substrate scale",
      hint: "Keep at 1.0 — warped substrate matches stipple; scale only for fine tuning.",
      min: 0.97,
      max: 1.01,
      step: 0.001,
    },
    {
      key: "substrateDepthInset",
      label: "Substrate depth inset",
      hint: "Depth-only pull inward so stipple/lines draw on top. Try 0.0001–0.0003.",
      min: 0,
      max: 0.001,
      step: 0.00001,
    },
    {
      key: "glowIntensity",
      label: "Rim glow intensity",
      hint: "uGlowIntensity on glow shell.",
      min: 0,
      max: 0.5,
      step: 0.01,
    },
  ];

  const tuneInputs: Partial<
    Record<keyof GlobeDebugTune, HTMLInputElement>
  > = {};

  for (const spec of tuneSliders) {
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
    tuneForm.appendChild(row);
    tuneInputs[spec.key] = range;

    range.addEventListener("input", () => {
      const v = Number(range.value);
      valSpan.textContent = v.toFixed(3);
      globe.setDebugTune({ [spec.key]: v });
    });
  }

  const landOnlyRow = document.createElement("label");
  landOnlyRow.className =
    "globe-debug-panel__tune-row globe-debug-panel__tune-row--check";
  const landOnlyCb = document.createElement("input");
  landOnlyCb.type = "checkbox";
  landOnlyCb.checked = GLOBE_DEBUG_TUNE_DEFAULTS.scarLandOnly >= 0.5;
  landOnlyCb.title =
    "Land dents only — off = land+ocean move together (reduces inner sphere)";
  const landOnlyText = document.createElement("span");
  landOnlyText.textContent =
    "Scar dents on land only (off = ocean + land move together)";
  landOnlyRow.append(landOnlyCb, landOnlyText);
  tuneForm.appendChild(landOnlyRow);
  landOnlyCb.addEventListener("change", () => {
    globe.setDebugTune({ scarLandOnly: landOnlyCb.checked ? 1 : 0 });
  });

  function syncTuneSliders(): void {
    const t = globe.getDebugTune();
    for (const spec of tuneSliders) {
      const range = tuneInputs[spec.key];
      if (!range) continue;
      range.value = String(t[spec.key]);
      const out = range.parentElement?.querySelector("output");
      if (out) out.textContent = Number(t[spec.key]).toFixed(3);
    }
    landOnlyCb.checked = t.scarLandOnly >= 0.5;
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
  });

  const syncBtn = document.createElement("button");
  syncBtn.type = "button";
  syncBtn.textContent = "Refresh state";
  syncBtn.addEventListener("click", () => refresh());

  buttonWrap.append(resetBtn, resetTuneBtn, logTuneBtn, syncBtn);
  host.appendChild(buttonWrap);
  syncTuneSliders();

  if (scarPreviewCanvas) {
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
  }

  refresh();
  const interval = window.setInterval(refresh, 800);

  return () => {
    window.clearInterval(interval);
    host.innerHTML = "";
    host.classList.remove("globe-debug-panel");
  };
}

export function shouldShowGlobeDebugPanel(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return new URLSearchParams(window.location.search).has("globeDebug");
  } catch {
    return false;
  }
}
