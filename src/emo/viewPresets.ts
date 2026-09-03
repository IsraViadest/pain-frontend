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
 * variants. Round v3 is the density round: the overlap rule, and the category shells. Round v4 is
 * the operator's round, built from a written brief (docs/emo-views/brief.md) and from the choices
 * made against it. Round v5 is the operator's second round, built from their own list of what was
 * wrong with v4 and what to try instead. The registry accumulates; nothing here is ever edited.
 *
 * WHAT ROUND v5 INHERITS WITHOUT ASKING. Four defects were fixed in the code rather than in a
 * parameter, so they apply to every preset here including the older ones: arcs no longer bead at
 * their segment joins, labels paint in depth order instead of score order, the selection mark
 * follows the scar-dented surface instead of floating on an undented sphere, and a leader line
 * can run through the surface to the country's centre. Only the last of those is opt-in, because
 * it has a sensible other value. A preset is a set of values, and a fix is not a value.
 *
 * WHAT THE OPERATOR RULED OUT BEFORE THIS ROUND, so it is not re-proposed: a resting world
 * network of any shape, on the grounds that joining countries by proximity alone says nothing
 * (v4-b and v4-c stay reachable), and the all-to-all category network as too dense (v4-f, same).
 * The category networks of v4-d and v4-e are the starting point instead.
 *
 * ROUND v4 AND THE ONE-NAMED-CHANGE RULE. That rule was suspended for round v1 only, which is
 * recorded here rather than claimed again: v1 shipped four language modes and the first networks
 * together. Round v4 does not inherit the exemption. Its first entry, `v4-a_base-bilingual`, is
 * openly a composite, because it is the operator's brief written as a single view rather than a
 * comparison; every entry after it is `v4-a` plus one named change, and says which.
 *
 * WHAT ROUND v4 DELIBERATELY DOES NOT CONTAIN. The halo, the area-ordered declutter priority, and
 * radial label displacement were all proposed in the brief with measurements, and were not chosen.
 * They are recorded there, not here. Focal mode and the overlap rule are switched off throughout
 * this round by instruction.
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
    id: "v2-g_category-k6",
    title: "Category: k=6",
    note:
      "The same category networks at six neighbours instead of three, for comparison against " +
      "v1-e (k=3) and v1-f (k=1).",
    params: { labelMode: "bilingual", networkMode: "all", kNeighbours: 6 },
  },  {
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
    id: "v3-c_multiplex-shells",
    title: "Multiplex: 14 category shells",
    note:
      "Every category network drawn at once, each on its own shell, with its labels riding the " +
      "same shell above it. Shell order is the category number 01 to 14, deliberately not a " +
      "semantic ordering. Arcs now follow the labels' zoom ramp, so the layers hold together " +
      "as the camera comes in instead of crossing over each other.",
    params: { labelMode: "bilingual", networkMode: "all", multiplexSpread: 0.012, arcWidth: 0.0015, arcOpacity: 0.4 },
  },
  {
    id: "v3-d_multiplex-declutter",
    title: "Multiplex, decluttered",
    note:
      "The shells with the overlap rule on. Stratifying by category moves labels apart on " +
      "screen as well as in radius, so this is the pairing that shows whether the shells buy " +
      "legibility or only depth.",
    params: { labelMode: "bilingual", networkMode: "all", multiplexSpread: 0.012, arcWidth: 0.0015, arcOpacity: 0.4, declutterMode: "priority" },
  },
  {
    id: "v4-a_base-bilingual",
    title: "Base: bilingual, attached, gentle zoom",
    note:
      "The round's baseline, and openly a composite rather than one named change: bilingual with " +
      "the duplicate English line collapsed, a leader line from every label down to its own " +
      "country, a much gentler zoom ramp (14px to 12px, and it only begins once you are inside " +
      "2.2 radii rather than 2.8), and a selection that steps the rest of the world back to 75% " +
      "instead of 25%. No world network at rest; click a country for its category.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
    },
  },
  {
    id: "v4-b_world-gabriel",
    title: "World network: Gabriel",
    note:
      "v4-a plus a resting network over every country, as the Gabriel graph: 360 edges, no " +
      "crossings, one component. The sparser of the two non-crossing options left open.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "connected",
      worldGraph: "gabriel",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
    },
  },
  {
    id: "v4-c_world-delaunay",
    title: "World network: full triangulation",
    note:
      "The same as v4-b with the world network as the full spherical Delaunay triangulation: 579 " +
      "edges, still no crossings, the densest planar network there is. The denser of the two.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "connected",
      worldGraph: "delaunay",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
    },
  },
  {
    id: "v4-d_category-gabriel",
    title: "Category network: Gabriel",
    note:
      "v4-a with the clicked category joined by its own Gabriel graph instead of k=3 nearest " +
      "neighbours. 275 edges across the 14 categories, none of them crossing.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "gabriel",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
    },
  },
  {
    id: "v4-e_category-delaunay",
    title: "Category network: triangulated",
    note:
      "The same with the clicked category triangulated: 501 edges over the 14 categories, which " +
      "is exactly 3n-6 summed over them, and still nothing crosses.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
    },
  },
  {
    id: "v4-f_category-complete",
    title: "Category network: all to all",
    note:
      "The same with every member of the clicked category joined to every other, 1427 edges over " +
      "the 14. The densest reading of what a category contains, and the one that crosses most.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "complete",
      selectionDim: 0.75,
      arcOpacity: 0.35,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
    },
  },
  {
    id: "v4-g_violet-flat",
    title: "Near-white violet tint",
    note:
      "v4-a with the near-white violet ramp: one band from violet through orchid to pink, so two " +
      "categories side by side are told apart while the set still reads as white from a distance. " +
      "Measured, it takes glyph saturation from 5.4% to 10.9%.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      colourMode: "violet",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
    },
  },
  {
    id: "v4-h_multiplex-violet",
    title: "Multiplex: closer labels, wider shells",
    note:
      "v4-g plus the 14 category shells, re-proportioned as asked: the labels sit closer to the " +
      "surface (1.06 rather than 1.11) and the layers are pushed further apart (0.018 rather than " +
      "0.012). arcLift drops to 1.03 to stay under the text, since the arc radius is a share of " +
      "the label's height and a lower standoff would otherwise lift the arcs through it.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "all",
      colourMode: "violet",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      standoffFar: 1.06,
      standoffNear: 1.012,
      arcLift: 1.03,
      multiplexSpread: 0.018,
      arcWidth: 0.0015,
      arcOpacity: 0.4,
    },
  },
  {
    id: "v4-i_multiplex-wide",
    title: "Multiplex: shells further apart",
    note:
      "v4-h at a shell spread of 0.028 rather than 0.018, so the fourteenth category rides at " +
      "1.42 instead of 1.29. The stratification is unmistakable and the globe reads as an onion; " +
      "the pair exists to show how far apart the layers want to be.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "all",
      colourMode: "violet",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      standoffFar: 1.06,
      standoffNear: 1.012,
      arcLift: 1.03,
      multiplexSpread: 0.028,
      arcWidth: 0.0015,
      arcOpacity: 0.4,
    },
  },
  {
    id: "v5-a_base-delaunay",
    title: "Base: opaque network, attached labels, depth fade",
    note:
      "The round's baseline, and openly a composite rather than one named change, because it is " +
      "the operator's list written as a single view. v4-e plus four things they asked for: the " +
      "network opaque and slightly bolder, which is also what removes the last of the bead " +
      "chain at the arc joins; leader lines at 45% of its width and 50% of its opacity, so the " +
      "two read as different kinds of line; a leader foot at 0.7 so the line runs through the " +
      "dented surface to the country's centre; and a depth fade that thins the labels receding " +
      "toward the horizon, which is where they pile up.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
    },
  },
  {
    id: "v5-b_base-gabriel",
    title: "Base, sparser category network",
    note:
      "v5-a with the clicked category joined by Gabriel instead of the full triangulation: 275 " +
      "edges over the 14 rather than 501. The sparser half of the pair the operator preferred.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "gabriel",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
    },
  },
  {
    id: "v5-c_mark-glow",
    title: "Selection brightens the country's own colour",
    note:
      "v5-a with the selection adding warm light to the country instead of laying white over " +
      "it, so its existing choropleth colour brightens rather than being covered. The alpha " +
      "rises from 0.18 to 0.4 in the same breath, because additive and normal blending are not " +
      "on one scale and 0.18 of added light is invisible: one change, two fields.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      selectionStyle: "glow",
      selectionFill: 0.4,
    },
  },
  {
    id: "v5-d_mark-outline",
    title: "Selection thickens the border instead of filling",
    note:
      "v5-a with no wash at all and a 3 texel outline round every country in the category, about " +
      "5 screen pixels at the gallery camera. The country keeps its own colour untouched and is " +
      "marked by its edge.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      selectionFill: 0,
      selectionOutline: 3,
    },
  },
  {
    id: "v5-e_mark-both",
    title: "Selection glows and is outlined",
    note:
      "v5-a with both treatments at once: a warm glow inside a 2 texel outline. The third of the " +
      "three the operator asked to compare.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
    },
  },
  {
    id: "v5-f_emphasis-bold",
    title: "Selection enlarges its category instead of dimming the rest",
    note:
      "v5-a with nothing dimmed. The clicked category's labels go from 14px weight 600 to " +
      "17.1px weight 800 and every other label is left exactly as it was, measured on painted " +
      "styles. selectionDim is inert here and is left at 0.75 rather than removed, so the " +
      "difference from v5-a is one field.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      selectionEmphasis: "bold",
    },
  },
  {
    id: "v5-g_emphasis-both",
    title: "Selection enlarges its category and dims the rest",
    note:
      "v5-a with both: the category enlarged and everything else stepped back to 75%. The " +
      "strongest of the three selection readings, and the one to check for whether emphasis and " +
      "dimming together are more than either alone or simply too much.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      selectionEmphasis: "both",
    },
  },
  {
    id: "v5-h_halo",
    title: "Halo instead of drop shadow",
    note:
      "v5-a with a symmetric halo at 16% of the font size replacing the directional drop shadow, " +
      "which darkens below a glyph and leaves its top edge unprotected over the bright " +
      "choropleth. Proposed in the round v4 brief, previewed, and not chosen then; shown here " +
      "because the operator asked to see it, and with every facing label drawn rather than the " +
      "decluttered subset the preview used. The preview's exact CSS was never recorded, so this " +
      "is the brief's design and not a reproduction of that image.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelHalo: 0.16,
    },
  },
  {
    id: "v5-i_depth-fade-strong",
    title: "Base, stronger depth fade",
    note:
      "v5-a with the depth fade raised from 0.45 to 0.7, so a label at the horizon keeps 30% of " +
      "its opacity rather than 55%. The far side of the trade between reading the whole globe " +
      "and reading the part of it facing you.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.7,
    },
  },
  {
    id: "v6-a_base",
    title: "Base: the lift, the glow, the outline, the halo",
    note:
      "The round's baseline, and openly a composite because the operator's list is one. " +
      "v5-e_mark-both plus the three things chosen or asked for after round v5: the " +
      "category's labels enlarge and the rest dim rather than either alone, a symmetric " +
      "halo at 16 percent of the font size in place of the drop shadow, and the selected " +
      "category lifted 0.04 radii clear of the rest. The lift moves the clicked category's " +
      "13 visible labels by 7 px near the middle of the disc and 20 to 29 px toward the " +
      "limb, with their leader lines and arcs following. It does not put the network in " +
      "front of the other text and nothing can: every DOM label paints over the WebGL " +
      "canvas at every radius. What it does buy is order among the labels, measured as " +
      "selected labels covered by a non-selected one falling from 3 of 13 to 1 of 13.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0.04,
    },
  },
  {
    id: "v6-b_no-lift",
    title: "Base without the lift",
    note:
      "v6-a with selectionLift back at 0, so the lift can be judged against its own absence " +
      "rather than against a preset that differs in three other ways as well. Everything " +
      "else, the glow, the outline, the halo and the enlarged category, is identical.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
    },
  },
  {
    id: "v6-c_dim-strong",
    title: "Base, everything else stepped well back",
    note:
      "v6-a with selectionDim at 0.25 rather than 0.75, which is what rounds v1 to v3 used. " +
      "It matters more than its position in this list suggests: the complaint it answers is " +
      "that an arc crossing an unselected label is cut at the glyph strokes, and a label " +
      "faint enough stops breaking the line that crosses it. If this is enough, the second " +
      "2D rendering pass that would actually draw the network above the text never needs " +
      "building.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      selectionDim: 0.25,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0.04,
    },
  },
  {
    id: "v6-d_fade-linear",
    title: "Base, depth fade linear in screen distance",
    note:
      "v6-a with labelDepthFadeCurve at 0.5. The shipped fade is linear in 1 minus facing, " +
      "which is about the square of the distance from the centre of the disc, so this " +
      "exponent is what makes it approximately linear in that distance instead. Measured " +
      "across 144 visible labels it takes the mean painted opacity from 0.772 to 0.690, " +
      "dimming every one of them, while the limb barely moves because the limb fade " +
      "dominates there. This is the reading of the request that fades the middle distance " +
      "more.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0.04,
      labelDepthFadeCurve: 0.5,
    },
  },
  {
    id: "v6-e_fade-quadratic",
    title: "Base, depth fade eased",
    note:
      "v6-a with labelDepthFadeCurve at 2, quadratic in 1 minus facing and so roughly " +
      "quartic in distance from the middle. Mean painted opacity rises from 0.772 to 0.852 " +
      "and the centre of the disc reaches a full 1.000, so the fade concentrates into the " +
      "outer ring. This is the reading where the difference of the difference grows, which " +
      "is how the operator described what they wanted.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0.04,
      labelDepthFadeCurve: 2,
    },
  },
  {
    id: "v6-f_fade-cubic",
    title: "Base, depth fade eased harder",
    note:
      "v6-a with labelDepthFadeCurve at 3. Mean painted opacity 0.890, and the fade is " +
      "pushed into an even narrower band at the limb. The far end of the same trade as " +
      "v6-e, kept so the three curves bracket the choice rather than offering two points on " +
      "it.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      selectionDim: 0.75,
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0.04,
      labelDepthFadeCurve: 3,
    },
  },
];

/**
 * Opens on the round v6 base: the round v5 mark the operator chose, the emphasis they chose, the
 * halo they adopted, and the lift they asked for, all at once.
 *
 * This is a constant rather than a preset value, so changing it edits no shipped view.
 * `v1-c_bilingual`, `v4-a_base-bilingual` and `v5-a_base-delaunay` were the previous defaults and
 * remain reachable by id, as everything here does.
 */
export const DEFAULT_EMO_PRESET_ID = "v6-a_base";

export function findEmoPreset(id: string): EmoPreset | undefined {
  return EMO_PRESETS.find((p) => p.id === id);
}

/** A preset's full parameter set: the defaults with its overrides applied. */
export function resolveEmoPresetParams(preset: EmoPreset): EmoViewParams {
  return { ...DEFAULT_EMO_PARAMS, ...preset.params };
}
