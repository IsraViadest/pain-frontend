/**
 * Append-only registry of named emotional-pain label views.
 *
 * THE RULE: once a preset is committed, its `params` are never edited. Adjust a view by adding
 * a new preset, not by changing an existing one. That is what makes every version reachable
 * forever, which is the point of the whole exercise; a screenshot gallery is a convenience on
 * top of this list, not the record itself.
 *
 * Naming is `v{round}-{letter}_{slug}`, from the figure-design-rounds convention. Round v1 opens
 * here with the control and the four language modes, and continues in the opening round with
 * letters e onward, so the registry accumulates rather than restarting.
 *
 * THE CONTROL CONFOUNDS TWO CHANGES AT ONCE. `v1-control_english-sprites` is the incumbent
 * canvas word cloud, which draws 174 countries under the old database `word` (15 sets, 10 of
 * them "neutral"). Every other preset draws 195 countries under the recomputed 14-category rule.
 * Renderer and dataset therefore both differ, so a difference between the control and any
 * candidate cannot be attributed to either alone.
 */
import { DEFAULT_EMO_PARAMS, type EmoViewParams } from "./viewParams";

export interface EmoPreset {
  /** `v{round}-{letter}_{slug}`. Stable forever: it is the URL and the gallery filename. */
  id: string;
  title: string;
  /** What this preset varies and why it exists. Shown under the switcher. */
  note: string;
  /** Overrides on DEFAULT_EMO_PARAMS; anything unset keeps the default. */
  params: Partial<EmoViewParams>;
  /**
   * The control renders the incumbent sprite word cloud and hides this layer entirely. Kept as
   * a flag rather than a copy of the sprite code, which lives in GlobeView and is not broken.
   */
  useIncumbentSprites?: boolean;
}

export const EMO_PRESETS: EmoPreset[] = [
  {
    id: "v1-control_english-sprites",
    title: "Control: incumbent sprites",
    note:
      "What the globe ships today: canvas sprites, English only, fixed height. 174 countries " +
      "under the old database word. Differs from every candidate in renderer and dataset at once.",
    params: {},
    useIncumbentSprites: true,
  },
  {
    id: "v1-a_english-dom",
    title: "English, DOM overlay",
    note:
      "The renderer swap on its own: same English category words, now browser-shaped text that " +
      "descends toward its country and shrinks as the camera approaches.",
    params: { labelMode: "english" },
  },
  {
    id: "v1-b_native",
    title: "Native language",
    note:
      "Each country's pain category in its own primary language, across 20 scripts. Click a " +
      "label to swap it to English, click again to swap back.",
    params: { labelMode: "native", clickMode: "toggleLanguage" },
  },
  {
    id: "v1-c_bilingual",
    title: "Bilingual pair",
    note:
      "Native term above, English category below at 72% size and reduced opacity. No italic " +
      "anywhere: most Noto script faces have none and synthetic oblique breaks Arabic and Indic.",
    params: { labelMode: "bilingual" },
  },
  {
    id: "v1-d_focal",
    title: "Focal: English at the centre",
    note:
      "English inside a 26 degree cone around the camera axis, native outside it, so the globe " +
      "reads in your language where you are looking and in its own everywhere else.",
    params: { labelMode: "focal", clickMode: "toggleLanguage" },
  },
  {
    id: "v1-e_native-network-k3",
    title: "Network, k=3",
    note:
      "Every country joined to its 3 nearest neighbours in the same pain category, as arcs that " +
      "follow the sphere. 388 edges; 13% of them cross more than a quarter of the globe, because " +
      "the categories are scattered rather than regional.",
    params: { labelMode: "native", networkMode: "all" },
  },
  {
    id: "v1-f_native-network-k1",
    title: "Network, k=1",
    note:
      "The same network at k=1: 136 edges, 3% of them long. Kept beside k=3 because the pair is " +
      "the clearest evidence of what neighbour count costs in legibility.",
    params: { labelMode: "native", networkMode: "all", kNeighbours: 1 },
  },
  {
    id: "v1-g_select-network",
    title: "Click to select a network",
    note:
      "Click a country to reveal only its category's network, fill it, and read it in both " +
      "languages while every other label dims. Click it again to clear. Not in the gallery: a " +
      "selection is a gesture, and no URL captures it.",
    params: { labelMode: "native", networkMode: "selected", clickMode: "selectNetwork" },
  },
];

/** Opens on the plain DOM English view, the closest candidate to what the globe ships today. */
export const DEFAULT_EMO_PRESET_ID = "v1-a_english-dom";

export function findEmoPreset(id: string): EmoPreset | undefined {
  return EMO_PRESETS.find((p) => p.id === id);
}

/** A preset's full parameter set: the defaults with its overrides applied. */
export function resolveEmoPresetParams(preset: EmoPreset): EmoViewParams {
  return { ...DEFAULT_EMO_PARAMS, ...preset.params };
}
