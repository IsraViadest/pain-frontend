/**
 * Switcher and live tuning panel for the emotional-pain label views.
 *
 * Two jobs. It steps between the named presets in the append-only registry, which is the durable
 * record of every version built; and it drives every EmoViewParams field live, so a new view is
 * found by dragging rather than by edit-and-reload. "Copy preset JSON" closes that loop: it emits
 * exactly the object literal to paste into viewPresets.ts, so a view found by dragging becomes a
 * permanent, reachable preset.
 *
 * The controls are generated from SECTIONS, so a parameter added in a later phase costs one entry
 * there rather than a new block of DOM code. Styling reuses the globe debug panel's classes; only
 * the outer positioning is new, in emo.css.
 *
 * The panel never touches GlobeView. It reports a preset and a parameter set through `onChange`,
 * and main.ts decides what that means for the scene.
 */
import { formatTuneValue, makeDetails } from "../globe/globeDebugPanel";
import { buildEmoViewUrl } from "../emo/emoViewConfig";
import {
  DEFAULT_EMO_PARAMS,
  EMO_ENUM_VALUES,
  diffEmoParams,
  type EmoEnumKey,
  type EmoNumberKey,
  type EmoViewParams,
} from "../emo/viewParams";
import {
  EMO_PRESETS,
  findEmoPreset,
  resolveEmoPresetParams,
  type EmoPreset,
} from "../emo/viewPresets";

interface EmoSliderSpec {
  key: EmoNumberKey;
  label: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
  hint: string;
}

interface EmoSection {
  summary: string;
  defaultOpen: boolean;
  selects: EmoEnumKey[];
  sliders: EmoSliderSpec[];
}

const ENUM_UI: Record<EmoEnumKey, { label: string; hint: string }> = {
  labelMode: {
    label: "Language",
    hint: "focal shows English inside the camera cone and native outside it.",
  },
  englishText: {
    label: "English text",
    hint: "The category label, or the gloss of the native term. 155 of 195 differ, and glosses are much longer.",
  },
  clickMode: {
    label: "Click does",
    hint: "toggleLanguage swaps one label. selectNetwork shows that country's category network. reshuffleNetwork redraws a new random world network.",
  },
  networkMode: {
    label: "Network",
    hint: "all draws every category at once. selected draws only the clicked country's category. connected joins the whole world by proximity until you click.",
  },
  worldGraph: {
    label: "World graph",
    hint: "mst, rng, gabriel and delaunay never cross themselves and are always connected, sparsest to densest. knn and random can cross.",
  },
  categoryGraph: {
    label: "Category graph",
    hint: "How countries sharing a pain category are joined. complete links all of them to all.",
  },
  colourMode: {
    label: "Colour",
    hint: "family groups the 14 categories into 5 bright violets and pinks. category gives all 14 their own hue.",
  },
};

const SECTIONS: EmoSection[] = [
  {
    summary: "Language and interaction",
    defaultOpen: true,
    selects: ["labelMode", "englishText", "clickMode"],
    sliders: [],
  },
  {
    summary: "Zoom ramp",
    defaultOpen: false,
    selects: [],
    sliders: [
      { key: "cameraFar", label: "Camera far", min: 1.5, max: 5, step: 0.05, decimals: 2, hint: "Camera distance treated as fully zoomed out." },
      { key: "cameraNear", label: "Camera near", min: 1.05, max: 3, step: 0.05, decimals: 2, hint: "Camera distance treated as fully zoomed in." },
      { key: "standoffFar", label: "Standoff far", min: 1, max: 1.4, step: 0.005, decimals: 3, hint: "Label height when far. Globe radius is 1; the incumbent sprites sit at 1.11." },
      { key: "standoffNear", label: "Standoff near", min: 1, max: 1.4, step: 0.005, decimals: 3, hint: "Label height when near. Below the far value, so labels descend toward their country." },
      { key: "fontPxFar", label: "Font px far", min: 6, max: 28, step: 0.5, decimals: 1, hint: "Label size in CSS pixels when far." },
      { key: "fontPxNear", label: "Font px near", min: 6, max: 28, step: 0.5, decimals: 1, hint: "Label size when near." },
      { key: "secondLineScale", label: "Second line", min: 0.4, max: 1, step: 0.01, decimals: 2, hint: "English line size as a fraction of the native line. Bilingual only." },
    ],
  },
  {
    summary: "Limb and fade",
    defaultOpen: false,
    selects: [],
    sliders: [
      { key: "facingMin", label: "Facing min", min: -0.2, max: 0.6, step: 0.01, decimals: 2, hint: "Hide a label once it faces this far from the camera. 0 is the horizon." },
      { key: "fadeStart", label: "Fade start", min: 0, max: 0.9, step: 0.01, decimals: 2, hint: "Facing value at which a label reaches full opacity." },
      { key: "edgeDesaturation", label: "Edge grey", min: 0, max: 1, step: 0.01, decimals: 2, hint: "How far a label greys out toward the limb. 0 keeps full colour." },
    ],
  },
  {
    summary: "Focal cone",
    defaultOpen: false,
    selects: [],
    sliders: [
      { key: "focalConeDeg", label: "Cone", min: 0, max: 90, step: 1, decimals: 0, hint: "Half-angle of the English cone around the camera axis." },
      { key: "focalBlendDeg", label: "Blend", min: 0, max: 45, step: 1, decimals: 0, hint: "Width of the band where the cone hands over to native." },
    ],
  },
  {
    summary: "Network arcs",
    defaultOpen: false,
    selects: ["networkMode", "worldGraph", "categoryGraph"],
    sliders: [
      { key: "kNeighbours", label: "Neighbours k", min: 1, max: 6, step: 1, decimals: 0, hint: "Nearest neighbours each country links to. Only used by the knn and random rules." },
      { key: "randomSeed", label: "Random seed", min: 1, max: 200, step: 1, decimals: 0, hint: "Which random world network to draw. Click does reshuffleNetwork steps this for you." },
      { key: "arcLift", label: "Arc lift", min: 1, max: 1.2, step: 0.005, decimals: 3, hint: "Radius the arcs ride at. Keep below the label standoff or they cross the text." },
      { key: "arcEndTrimDeg", label: "End trim", min: 0, max: 8, step: 0.1, decimals: 1, hint: "Degrees removed at each end, so a line stops short of the label it points at." },
      { key: "arcWidth", label: "Arc width", min: 0.0005, max: 0.012, step: 0.0005, decimals: 4, hint: "World units, so a fraction of the globe radius rather than pixels." },
      { key: "arcOpacity", label: "Arc opacity", min: 0.05, max: 1, step: 0.01, decimals: 2, hint: "Lower this before lowering width when the network reads as clutter." },
      { key: "selectionDim", label: "Selection dim", min: 0, max: 1, step: 0.01, decimals: 2, hint: "Opacity of every label except the selected one, with Click does set to selectNetwork." },
      { key: "selectionFill", label: "Selection fill", min: 0, max: 0.6, step: 0.01, decimals: 2, hint: "Alpha of the wash on the selected country. 43 microstates have no polygon and stay unfilled." },
    ],
  },
  {
    summary: "Appearance and density",
    defaultOpen: false,
    selects: ["colourMode"],
    sliders: [
      { key: "density", label: "Density cap", min: 0, max: 195, step: 1, decimals: 0, hint: "Maximum labels drawn, weakest score dropped first. 0 means no cap." },
    ],
  },
];

/** A hotkey typed into a text field is text, not a shortcut. */
function hotkeyTargetIgnoresShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.closest("[contenteditable=true]") !== null;
}

/**
 * Build the panel into `host`. Mounted once for the page lifetime, behind the same opt-in gate
 * as the views themselves, so there is nothing to tear down.
 *
 * Returns a handle for the one case where something outside the panel has to change a value:
 * clicking the globe to reshuffle the random network. The panel stays the single owner of the
 * parameter state, so its controls cannot drift out of step with what is drawn.
 */
export function mountEmoViewPanel(
  host: HTMLElement,
  options: {
    initialPresetId: string;
    initialParams: EmoViewParams;
    onChange: (preset: EmoPreset, params: EmoViewParams) => void;
    /** Hide the panel to clear the view. The entry button brings it back. */
    onMinimise: () => void;
  },
): { setParam: (key: EmoNumberKey, value: number) => void } {
  host.classList.add("globe-debug-panel");
  host.innerHTML = "";

  let presetId = options.initialPresetId;
  let params: EmoViewParams = { ...options.initialParams };

  const ranges = new Map<EmoNumberKey, HTMLInputElement>();
  const readouts = new Map<EmoNumberKey, HTMLOutputElement>();
  const selects = new Map<EmoEnumKey, HTMLSelectElement>();
  const presetRadios = new Map<string, HTMLInputElement>();

  const header = document.createElement("div");
  header.className = "emo-view-panel__header";
  host.appendChild(header);

  const title = document.createElement("h2");
  title.className = "globe-debug-panel__title";
  title.textContent = "Emotional pain label views";

  const minimise = document.createElement("button");
  minimise.type = "button";
  minimise.className = "emo-view-panel__minimise";
  minimise.textContent = "\u00d7";
  minimise.title = "Hide the panel. [ and ] keep stepping between views while it is hidden; the Views button, bottom left, brings it back.";
  minimise.setAttribute("aria-label", "Hide the views panel");
  minimise.addEventListener("click", () => options.onMinimise());

  header.append(title, minimise);

  // --- preset switcher ---
  const presetBlock = makeDetails("Views", true);
  host.appendChild(presetBlock.el);

  const presetIntro = document.createElement("p");
  presetIntro.className = "globe-debug-panel__intro";
  presetIntro.textContent =
    "[ and ] step through the list, and keep working while the panel is hidden. " +
    "Presets are append-only: a shipped one is never edited.";
  presetBlock.body.appendChild(presetIntro);

  const presetList = document.createElement("ul");
  presetList.className = "globe-debug-panel__list";
  presetBlock.body.appendChild(presetList);

  const noteEl = document.createElement("p");
  noteEl.className = "globe-debug-panel__tune-hint";
  presetBlock.body.appendChild(noteEl);

  for (const preset of EMO_PRESETS) {
    const li = document.createElement("li");
    li.className = "globe-debug-panel__item";
    const row = document.createElement("label");
    row.className = "globe-debug-panel__row";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "emo-preset";
    radio.value = preset.id;

    const text = document.createElement("span");
    text.className = "globe-debug-panel__label";
    text.textContent = preset.title;

    const code = document.createElement("code");
    code.className = "globe-debug-panel__code";
    code.textContent = preset.id;

    row.append(radio, text, code);
    li.appendChild(row);
    presetList.appendChild(li);
    presetRadios.set(preset.id, radio);

    radio.addEventListener("change", () => {
      if (radio.checked) selectPreset(preset.id);
    });
  }

  // --- parameter controls ---
  // Everything below the switcher scrolls. The switcher itself does not: it is the control
  // that matters most, and the parameter list only grows as later phases add to it.
  const scroll = document.createElement("div");
  scroll.className = "emo-view-panel__scroll";
  host.appendChild(scroll);

  for (const section of SECTIONS) {
    const block = makeDetails(section.summary, section.defaultOpen);
    scroll.appendChild(block.el);

    for (const key of section.selects) {
      const row = document.createElement("label");
      row.className = "globe-debug-panel__tune-row";

      const head = document.createElement("span");
      head.className = "globe-debug-panel__tune-head";
      head.textContent = ENUM_UI[key].label;

      const select = document.createElement("select");
      select.className = "globe-debug-panel__tune-select";
      for (const value of EMO_ENUM_VALUES[key]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      }

      const hint = document.createElement("span");
      hint.className = "globe-debug-panel__tune-hint";
      hint.textContent = ENUM_UI[key].hint;

      row.append(head, select, hint);
      block.body.appendChild(row);
      selects.set(key, select);

      select.addEventListener("change", () => {
        Object.assign(params, { [key]: select.value });
        emit();
      });
    }

    for (const spec of section.sliders) {
      const row = document.createElement("label");
      row.className = "globe-debug-panel__tune-row";

      const head = document.createElement("span");
      head.className = "globe-debug-panel__tune-head";
      head.textContent = `${spec.label} `;
      const readout = document.createElement("output");
      readout.className = "globe-debug-panel__tune-val";
      head.appendChild(readout);

      const range = document.createElement("input");
      range.type = "range";
      range.min = String(spec.min);
      range.max = String(spec.max);
      range.step = String(spec.step);

      const hint = document.createElement("span");
      hint.className = "globe-debug-panel__tune-hint";
      hint.textContent = spec.hint;

      row.append(head, range, hint);
      block.body.appendChild(row);
      ranges.set(spec.key, range);
      readouts.set(spec.key, readout);

      range.addEventListener("input", () => {
        const value = Number(range.value);
        Object.assign(params, { [spec.key]: value });
        readout.textContent = formatTuneValue(value, spec.decimals);
        emit();
      });
    }
  }

  // --- actions ---
  const actions = document.createElement("div");
  actions.className = "globe-debug-panel__actions";
  scroll.appendChild(actions);

  const reloadBtn = document.createElement("button");
  reloadBtn.type = "button";
  reloadBtn.className = "globe-debug-panel__action";
  reloadBtn.textContent = "Reload with these";
  reloadBtn.title = "Reload the page on a URL that reproduces this exact view from a cold load";
  actions.appendChild(reloadBtn);
  reloadBtn.addEventListener("click", () => {
    window.location.href = buildEmoViewUrl(presetId, params);
  });

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "globe-debug-panel__action";
  resetBtn.textContent = "Reset to preset";
  actions.appendChild(resetBtn);
  resetBtn.addEventListener("click", () => selectPreset(presetId));

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "globe-debug-panel__action";
  copyBtn.textContent = "Copy preset JSON";
  actions.appendChild(copyBtn);

  const snippet = document.createElement("textarea");
  snippet.className = "emo-view-panel__snippet";
  snippet.readOnly = true;
  snippet.rows = 8;
  snippet.hidden = true;
  scroll.appendChild(snippet);

  copyBtn.addEventListener("click", () => {
    // Only the fields that differ from the defaults, because that is exactly the shape of an
    // EmoPreset's `params`. Paste it into viewPresets.ts and the view becomes permanent.
    const text = JSON.stringify(
      {
        id: "v2-a_rename-me",
        title: "Rename me",
        note: "What this preset varies, and why it exists.",
        params: diffEmoParams(DEFAULT_EMO_PARAMS, params),
      },
      null,
      2,
    );
    // Shown as well as copied: the clipboard is refused in some contexts, and a value you can
    // read is worth more than one that silently did not arrive.
    snippet.value = text;
    snippet.hidden = false;
    void navigator.clipboard?.writeText(text).catch(() => {
      /* insecure context or permission denied; the textarea still has it */
    });
  });

  function currentPreset(): EmoPreset {
    return findEmoPreset(presetId) ?? EMO_PRESETS[0];
  }

  function emit(): void {
    options.onChange(currentPreset(), { ...params });
  }

  /** Push `params` into every control, after a preset switch. */
  function syncControls(): void {
    for (const [key, range] of ranges) {
      range.value = String(params[key]);
      const readout = readouts.get(key);
      const decimals = SECTIONS.flatMap((s) => s.sliders).find((s) => s.key === key)?.decimals ?? 2;
      if (readout) readout.textContent = formatTuneValue(params[key], decimals);
    }
    for (const [key, select] of selects) select.value = params[key];
  }

  function selectPreset(id: string): void {
    const preset = findEmoPreset(id);
    if (!preset) return;
    presetId = id;
    params = resolveEmoPresetParams(preset);
    const radio = presetRadios.get(id);
    if (radio) radio.checked = true;
    noteEl.textContent = preset.note;
    snippet.hidden = true;
    syncControls();
    emit();
  }

  function stepPreset(delta: number): void {
    const index = EMO_PRESETS.findIndex((p) => p.id === presetId);
    const next = (index + delta + EMO_PRESETS.length) % EMO_PRESETS.length;
    const preset = EMO_PRESETS[next];
    if (preset) selectPreset(preset.id);
  }

  window.addEventListener("keydown", (ev) => {
    if (ev.key !== "[" && ev.key !== "]") return;
    if (hotkeyTargetIgnoresShortcut(ev.target)) return;
    ev.preventDefault();
    stepPreset(ev.key === "]" ? 1 : -1);
  });

  // Reflect the URL-resolved state without re-resolving the preset, so a tweaked
  // `?emoParams=` survives the panel opening on top of it.
  const initial = presetRadios.get(presetId);
  if (initial) initial.checked = true;
  noteEl.textContent = currentPreset().note;
  syncControls();

  return {
    setParam(key: EmoNumberKey, value: number): void {
      Object.assign(params, { [key]: value });
      const range = ranges.get(key);
      if (range) range.value = String(value);
      const readout = readouts.get(key);
      const decimals = SECTIONS.flatMap((s) => s.sliders).find((s) => s.key === key)?.decimals ?? 2;
      if (readout) readout.textContent = formatTuneValue(value, decimals);
      emit();
    },
  };
}
