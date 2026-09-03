/**
 * Append-only registry of named emotional-pain label views.
 *
 * THE RULE: once a preset is committed, its `params` are never edited. Adjust a view by adding
 * a new preset, not by changing an existing one. That is what makes every version reachable
 * forever, which is the point of the whole exercise; a screenshot gallery is a convenience on
 * top of this list, not the record itself.
 *
 * Naming is `v{round}-{letter}_{slug}`, from the figure-design-rounds convention. Round v1 holds
 * the control, the four language modes and the first networks. Round v2 is the network-shape
 * round: the non-crossing density ladder, a random network for contrast, and two category
 * variants. The registry accumulates; nothing here is ever edited.
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
  {
    id: "v1-h_connected-bilingual",
    title: "Connected world, click for category",
    note:
      "Bilingual labels over one connected network. At rest the arcs ignore the pain category " +
      "and join every country to its nearest neighbours, plus the shortest bridges needed to " +
      "make it a single component, so no country is left out. Click a country and the view " +
      "switches to its category's network alone.",
    params: {
      labelMode: "bilingual",
      networkMode: "connected",
      clickMode: "selectNetwork",
    },
  },
  {
    id: "v2-a_world-mst",
    title: "World: spanning tree",
    note:
      "The sparsest connected network that exists: 194 edges, no cycles, no crossings, median " +
      "arc 5 degrees. Every country reachable from every other by exactly one path.",
    params: { labelMode: "bilingual", networkMode: "connected", worldGraph: "mst", clickMode: "selectNetwork" },
  },
  {
    id: "v2-b_world-rng",
    title: "World: relative neighbourhood",
    note:
      "233 edges, no crossings. Joins two countries only when no third is closer to both of " +
      "them, which reads as the skeleton of the landmasses.",
    params: { labelMode: "bilingual", networkMode: "connected", worldGraph: "rng", clickMode: "selectNetwork" },
  },
  {
    id: "v2-c_world-gabriel",
    title: "World: Gabriel graph",
    note:
      "360 edges, no crossings. Denser than the neighbourhood skeleton and still every edge has " +
      "an empty circle on it. The middle of the density ladder.",
    params: { labelMode: "bilingual", networkMode: "connected", worldGraph: "gabriel", clickMode: "selectNetwork" },
  },
  {
    id: "v2-d_world-delaunay",
    title: "World: full triangulation",
    note:
      "579 edges, the densest network that still never crosses itself: the spherical Delaunay " +
      "triangulation, obtained as the convex hull of the 195 label points.",
    params: { labelMode: "bilingual", networkMode: "connected", worldGraph: "delaunay", clickMode: "selectNetwork" },
  },
  {
    id: "v2-e_world-random",
    title: "World: random, click to reshuffle",
    note:
      "Partners picked at random rather than by distance, then bridged into one component. It " +
      "crosses itself heavily, which is the point of having it beside the others. Click anywhere " +
      "on a label for the next seed.",
    params: { labelMode: "bilingual", networkMode: "connected", worldGraph: "random", clickMode: "reshuffleNetwork" },
  },
  {
    id: "v2-f_category-complete",
    title: "Category: all to all",
    note:
      "Click a country and every other country sharing its pain category joins it, all to all " +
      "rather than nearest-neighbour. The densest reading of what a category contains.",
    params: { labelMode: "bilingual", networkMode: "selected", categoryGraph: "complete", clickMode: "selectNetwork", arcOpacity: 0.35 },
  },
  {
    id: "v3-a_declutter-priority",
    title: "Declutter: no overlap",
    note:
      "The same bilingual pair, with any label whose box collides with a stronger-scoring one " +
      "faded out instead of drawn over. Labels are never moved. 61 of 144 survive at the " +
      "gallery camera, with zero collisions left, and a hidden label stops swallowing clicks.",
    params: { labelMode: "bilingual", declutterMode: "priority" },
  },
  {
    id: "v3-b_declutter-dense",
    title: "Declutter: allowed to touch",
    note:
      "The same rule with the required gap set to minus 6 pixels, so labels may overlap a " +
      "little rather than not at all. 77 survive instead of 61: more of the world is named, " +
      "and some pairs collide. The legibility-versus-coverage trade, as one number.",
    params: { labelMode: "bilingual", declutterMode: "priority", declutterPad: -6 },
  },
  {
    id: "v2-g_category-k6",
    title: "Category: k=6",
    note:
      "The same category networks at six neighbours instead of three, for comparison against " +
      "v1-e (k=3) and v1-f (k=1).",
    params: { labelMode: "bilingual", networkMode: "all", kNeighbours: 6 },
  },
];

/**
 * Opens on the bilingual pair, which is the treatment the operator judged best on 2026-09-03.
 */
export const DEFAULT_EMO_PRESET_ID = "v1-c_bilingual";

export function findEmoPreset(id: string): EmoPreset | undefined {
  return EMO_PRESETS.find((p) => p.id === id);
}

/** A preset's full parameter set: the defaults with its overrides applied. */
export function resolveEmoPresetParams(preset: EmoPreset): EmoViewParams {
  return { ...DEFAULT_EMO_PARAMS, ...preset.params };
}
