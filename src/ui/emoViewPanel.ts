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
  identicalLines: {
    label: "Same word twice",
    hint: "32 of 195 labels carry the same word on both lines: 29 English-speaking countries plus the 3 lexicon gaps. one draws it once.",
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
    hint: "How countries sharing a pain category are joined. complete links all to all; gabriel and delaunay never cross themselves.",
  },
  leaderLines: {
    label: "Leader lines",
    hint: "A hairline from each country up to its own label, so a word over a crowded region is visibly attached. Takes the arc width and opacity, scaled by the two leader sliders.",
  },
  leaderSpread: {
    label: "Leaders spread",
    hint: "on grows the chosen category's leader lines out of the ground with the wavefront, instead of having them there from the start. The rest of the world is never part of a wave.",
  },
  leaderSpreadFrom: {
    label: "Leaders grow from",
    hint: "Which end of a growing leader moves. foot sends every one of them up out of the ground, which is what round v9 drew. split sends only the country you clicked up, and brings every other country's line down from its word instead.",
  },
  selectionStyle: {
    label: "Selection mark",
    hint: "wash lays white over the country. glow adds warm light instead, so its own choropleth colour brightens rather than being covered.",
  },
  selectionEmphasis: {
    label: "Selection emphasis",
    hint: "dim steps every other label back. bold leaves them alone and enlarges the selected category's labels instead. both does each.",
  },
  selectionSpreadEase: {
    label: "Spread ease",
    hint: "The shape of one country's own fade as the wavefront passes it. The front itself already travels at a constant speed, so linear here is a harder edge on the front rather than a different wave.",
  },
  legend: {
    label: "Category legend",
    hint: "The 14 pain categories listed down the left, each one clickable: it selects a country of that category at random, so everything behaves as it does from a click on the globe. It shares the left side with this panel, so use ?ev=2 to see it.",
  },
  legendRepeatClick: {
    label: "Repeat legend click",
    hint: "What a second click on the word whose category is already selected does. reroll picks another country of that category at random; clear puts the selection away instead. A click on a different word always selects, and a click while that category's network is still arriving always does nothing.",
  },
  colourMode: {
    label: "Colour",
    hint: "family groups the 14 into 5 violets and pinks. category gives all 14 their own hue. violet is a near-white ramp, separable side by side and white from a distance.",
  },
  declutterMode: {
    label: "Declutter",
    hint: "priority fades out a label whose box collides with a stronger-scoring one. Labels are never moved.",
  },
};

const SECTIONS: EmoSection[] = [
  {
    summary: "Language and interaction",
    defaultOpen: true,
    selects: ["labelMode", "englishText", "identicalLines", "clickMode"],
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
      { key: "labelDepthFade", label: "Depth fade", min: 0, max: 0.9, step: 0.05, decimals: 2, hint: "Extra transparency across the whole hemisphere, unlike Fade start which only acts at the limb. A label at the horizon keeps 1 minus this. Helps the crowding on the sides." },
      { key: "labelDepthFadeCurve", label: "Depth curve", min: 0.25, max: 4, step: 0.25, decimals: 2, hint: "Exponent on the depth fade above. 1 is what shipped, which is already quadratic in screen distance because 1 minus facing goes as the square of it. 0.5 is approximately linear in distance from the middle; 2 is a strong ease-in." },
      { key: "labelHalo", label: "Halo", min: 0, max: 0.5, step: 0.01, decimals: 2, hint: "Symmetric surround instead of the drop shadow, as a fraction of the font size. 0 keeps the shadow." },
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
    selects: ["networkMode", "worldGraph", "categoryGraph", "leaderLines", "leaderSpread", "leaderSpreadFrom", "selectionStyle", "selectionEmphasis", "selectionSpreadEase"],
    sliders: [
      { key: "kNeighbours", label: "Neighbours k", min: 1, max: 6, step: 1, decimals: 0, hint: "Nearest neighbours each country links to. Only used by the knn and random rules." },
      { key: "randomSeed", label: "Random seed", min: 1, max: 200, step: 1, decimals: 0, hint: "Which random world network to draw. Click does reshuffleNetwork steps this for you." },
      { key: "arcLift", label: "Arc lift", min: 1, max: 1.2, step: 0.005, decimals: 3, hint: "Arc radius at the far end of the zoom ramp. Arcs follow the labels in from there, so below Standoff far keeps them under the text at every zoom." },
      { key: "arcEndTrimDeg", label: "End trim", min: 0, max: 8, step: 0.1, decimals: 1, hint: "Degrees removed at each end, so a line stops short of the label it points at." },
      { key: "arcWidth", label: "Arc width", min: 0.0005, max: 0.012, step: 0.0005, decimals: 4, hint: "World units, so a fraction of the globe radius rather than pixels." },
      { key: "arcOpacity", label: "Arc opacity", min: 0.05, max: 1, step: 0.01, decimals: 2, hint: "Lower this before lowering width when the network reads as clutter." },
      { key: "leaderFoot", label: "Leader foot", min: 0.5, max: 1.05, step: 0.005, decimals: 3, hint: "Radius a leader line starts at. Scars dent the surface inward by up to 0.08, so a foot below that reaches the country at every depth and is cut by the globe's own depth. 1.004 sits on the undented sphere." },
      { key: "leaderFootEmoOnly", label: "Leader foot, emo layer", min: 0.9, max: 1.05, step: 0.002, decimals: 3, hint: "The same radius for the emotional-pain layer on its own, where the globe draws no surface and so writes no depth. A buried foot is not cut there and reaches out of the planet, so this one sits just outside the sphere the borders ride on. Has no effect in all-layers mode." },
      { key: "leaderWidthScale", label: "Leader width", min: 0.1, max: 1, step: 0.05, decimals: 2, hint: "Leader width as a fraction of the arc width. Below 1 makes the network the bolder of the two." },
      { key: "leaderOpacityScale", label: "Leader opacity", min: 0.1, max: 1, step: 0.05, decimals: 2, hint: "Leader opacity as a fraction of the arc opacity. Below 1 makes the network the more solid of the two." },
      { key: "leaderSelectedWidthScale", label: "Leader width, chosen", min: 1, max: 4, step: 0.1, decimals: 2, hint: "How much wider the chosen category's leader lines are than the rest, on top of Leader width. 1 makes them the same, which is what shipped." },
      { key: "leaderSelectedOpacityScale", label: "Leader opacity, chosen", min: 1, max: 4, step: 0.1, decimals: 2, hint: "The same for opacity, and the product is clamped at 1. With leaders resting at half the arc opacity, 2 makes the chosen ones solid." },
      { key: "selectionDim", label: "Selection dim", min: 0, max: 1, step: 0.01, decimals: 2, hint: "Opacity of every label except the selected one, with Click does set to selectNetwork." },
      { key: "selectionLift", label: "Selection lift", min: 0, max: 0.1, step: 0.005, decimals: 3, hint: "Extra radius for the selected category's labels, arcs and leader heads, in globe radii. Raises them clear of the rest and tends to paint them over their neighbours. It cannot put the arcs in front of the text: every DOM label paints over the WebGL canvas." },
      { key: "selectionFill", label: "Selection fill", min: 0, max: 0.6, step: 0.01, decimals: 2, hint: "Alpha of the wash on the selected category. 0 leaves only the outline. 43 microstates have no polygon and stay unmarked." },
      { key: "selectionSink", label: "Selection sink", min: 0, max: 1, step: 0.02, decimals: 2, hint: "How far every other category steps down toward the planet while one is selected, as a share of the label's own height above the surface. The inverse of Selection lift: the chosen category stays put and the world steps back from it, so zooming in and clicking does not push it out of frame. 1 lands them on the surface." },
      { key: "selectionMotionMs", label: "Motion ms", min: 0, max: 1600, step: 20, decimals: 0, hint: "How long the step down, the step up and the dim take. 0 is the instant jump that shipped. Ease-out cubic, retargeted from wherever a category currently is." },
      { key: "selectionSpreadMs", label: "Spread ms", min: 0, max: 2500, step: 50, decimals: 0, hint: "How long the network takes to grow outward from the country clicked, breadth first. Each country's label comes up as the front passes it. 0 draws it all at once, which is what shipped." },
      { key: "selectionLeaderMs", label: "Leader ms", min: 0, max: 1200, step: 20, decimals: 0, hint: "How long the clicked country's own leader line takes to reach its word before the network starts, and how long every other country's takes once the network reaches it. It is also the budget for taking the previous network apart, which happens while it grows. 0 removes the phase, which is what shipped." },
      { key: "selectionRetractSpeed", label: "Retract speed", min: 0, max: 20, step: 0.5, decimals: 1, hint: "How many times faster than its construction a network is taken apart when it is replaced or cleared. It is the same wave in reverse, so it unspreads toward the country it grew from and that country's leader is the last thing to go. 0 removes it instantly, which is what shipped." },
      { key: "selectionLeaderShare", label: "Leader share", min: 0, max: 0.9, step: 0.05, decimals: 2, hint: "How much of each depth step of the spread is reserved for the leader line coming down at the far end, rather than for the arc that reaches it. The next hop leaves only at the end of the step, so a country is never still being connected to while its own line is on the way down. 0.5 gives the two the same time; 0 is what shipped." },
      { key: "selectionSpreadWindow", label: "Spread window", min: 0.05, max: 3, step: 0.05, decimals: 2, hint: "How long one country takes to come up once the front reaches it, in depth steps. Wider is a gentler fade and a softer front; 0.5 is what shipped, and a five step sweep makes that about a tenth of the total." },
      { key: "selectionEmphasisScale", label: "Emphasis size", min: 1, max: 1.6, step: 0.01, decimals: 2, hint: "How much larger an emphasised label's main lines are drawn. 1.22 is what shipped. Only acts with Selection emphasis set to bold or both." },
      { key: "selectionEmphasisSecondScale", label: "Emphasis second", min: 1, max: 1.6, step: 0.01, decimals: 2, hint: "The same for the smaller English line under a native one. 1 leaves the subtitle where it is while the word above it grows." },
      { key: "selectionOutline", label: "Selection outline", min: 0, max: 8, step: 1, decimals: 0, hint: "Thickness of the border drawn round the selected category, in texels of the 2048 by 1024 map, about 1.7 screen pixels each. 0 draws none." },
      { key: "selectionMarkerDeg", label: "Marker, no polygon", min: 0, max: 3, step: 0.1, decimals: 1, hint: "Radius of the disc drawn for the 29 countries Natural Earth 1:110m has no polygon for, in degrees of great circle. 0 leaves them unmarked, which is what shipped." },
    ],
  },
  {
    summary: "Category legend",
    defaultOpen: false,
    selects: ["legend", "legendRepeatClick"],
    sliders: [
      { key: "legendFontPx", label: "Legend size", min: 9, max: 30, step: 0.5, decimals: 1, hint: "Legend text size in CSS pixels. Fixed on screen, so unlike the labels it does not follow the zoom ramp." },
      { key: "legendOpacity", label: "Legend opacity", min: 0.15, max: 1, step: 0.05, decimals: 2, hint: "How white the words are while nothing is selected. The chosen one then goes to full white and the rest take Selection dim on top of this." },
    ],
  },
  {
    summary: "Category shells",
    defaultOpen: false,
    selects: [],
    sliders: [
      { key: "multiplexSpread", label: "Shell spread", min: 0, max: 0.03, step: 0.001, decimals: 3, hint: "Radial gap between consecutive pain categories, in globe radii. Labels and their arcs rise together, so the globe gains 14 stratified layers. 0 is flat." },
    ],
  },
  {
    summary: "Appearance and density",
    defaultOpen: false,
    selects: ["colourMode", "declutterMode"],
    sliders: [
      { key: "density", label: "Density cap", min: 0, max: 195, step: 1, decimals: 0, hint: "Maximum labels drawn, weakest score dropped first. 0 means no cap." },
      { key: "declutterPad", label: "Declutter gap", min: -10, max: 14, step: 1, decimals: 0, hint: "Clear space demanded between two label boxes, in pixels. Negative lets them overlap, which keeps more on screen." },
    ],
  },
];

/**
 * The round after the highest one in the registry, for the suggested id in the copied snippet.
 *
 * Derived rather than written down: it was hardcoded to "v2-a_rename-me" and stayed that way
 * through rounds v3, v4 and v5, which is a suggestion that collides with three shipped presets.
 * A count or a name that has to be kept in step by hand is one that will not be.
 */
function nextRoundPresetId(): string {
  const rounds = EMO_PRESETS.map((p) => Number(/^v(\d+)-/.exec(p.id)?.[1] ?? 0));
  return `v${Math.max(0, ...rounds) + 1}-a_rename-me`;
}

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

  // Everything except the header scrolls, as one region, so the wheel does the same thing
  // wherever the pointer sits in the panel.
  //
  // The switcher used to sit outside this, on the reasoning that it is the control that matters
  // most and so should always be on screen. That held at five presets. At twenty the switcher
  // alone is 921px inside a 673px panel, and because a flex item whose overflow is `visible` has
  // its automatic minimum size resolve to its content, it could not shrink: it took the whole
  // column, collapsed the scroll box to zero height, and left 305px of controls unreachable.
  const scroll = document.createElement("div");
  scroll.className = "emo-view-panel__scroll";
  host.appendChild(scroll);

  // --- preset switcher ---
  const presetBlock = makeDetails("Views", true);
  scroll.appendChild(presetBlock.el);

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
        id: nextRoundPresetId(),
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
