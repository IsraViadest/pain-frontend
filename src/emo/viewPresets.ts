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
 * wrong with v4 and what to try instead. Round v6 answers four questions with one named change
 * each. Round v7 is the operator's third round: the answers to those four, plus the inversion of
 * the lift into a sink and the network spreading out from whatever is clicked. Round v8 varies
 * only how that spread arrives and whether the world steps back at all. The registry accumulates;
 * nothing here is ever edited.
 *
 * ROUND v9 IS THE OPERATOR'S FIFTH. Its base, `v9-a_base`, is openly a composite: v8-d, which
 * they judged ideal, plus the two things they asked for that are not variations. Every entry
 * after it is v9-a plus one named change, except `v9-f`, which carries two and says why.
 *
 * WHAT ROUND v9 INHERITS WITHOUT ASKING, and it is the largest such set yet, because all of it is
 * one report. The label overlay no longer takes pointer events at all: a label used to swallow
 * every wheel and every drag that began over it, because the canvas is not its ancestor, so zoom
 * and rotation were dead over most of the disc and the wheel then rubber-banded the page. A click
 * is resolved by hit testing instead, which also stops a decluttered label swallowing a click
 * meant for the one drawn over it, and puts the drag-slop test in front of selection as well as
 * clearing. The views panel contains its own overscroll rather than handing the rest of a wheel
 * to the document. And `?ev=2` is `?ev=1` with the controls closed, which is where the legend can
 * be seen at all, since both live on the left. None of it is a value, so no preset moves:
 * v8-d_hold-dim measured against a stash of the same commit differs at rest by a mean of 0.106
 * with a maximum delta of 2 of 255, and after a click by 0.009 and 2, where the same measurement
 * between a resting and a clicked frame reports 10.524 and 254.
 *
 * ONE CAPTURE RECIPE DIED WITH THAT FIX. `el.click()` on a label no longer selects anything,
 * because the handler now requires the event to have landed on the canvas. The gallery's
 * `--after-clicking-india` frames are taken with a pointerdown and a click dispatched on the
 * canvas at the label's own centre.
 *
 * ROUND v8 HAS NO BASE OF ITS OWN, ON PURPOSE. The operator changed no values this round: they
 * reported two defects and asked for variants of one thing. `v7-a_base` is therefore still the
 * base, and each v8 preset is v7-a plus one named change, except `v8-c`, which carries two and
 * says why in its own note. Adding a `v8-a_base` identical to `v7-a_base` would have put a second
 * name on one view, which is the opposite of what an append-only registry is for.
 *
 * WHAT ROUND v8 INHERITS WITHOUT ASKING. Two more fixes apply to every preset here, older ones
 * included. Select All no longer marks the words: `user-select: none` governs what a user gesture
 * may start and not what the browser's own Select All may do, so the page now removes the
 * selection at the event level instead. And the leader lines have a second foot for the
 * emotional-pain layer alone, where the globe writes no depth and so cannot cut a buried line
 * back to the surface; `leaderFoot: 0.7` was drawing 0.3 of a radius of spear out of the planet
 * there. Neither changes all-layers mode: v7-a re-shot at rest and settled after a click both
 * differ from their gallery frames by 0.00 percent.
 *
 * WHAT ROUND v7 SETTLES, so it is not asked again. The depth fade is cubic (v6-f). `selectionDim`
 * stays at 0.75, because 0.25 was judged too strong, which also leaves the second rendering pass
 * unbuilt. The lift is not the shape of the gesture: the chosen category holds its height and the
 * world steps back from it instead, because a lift pushes the thing being looked at out of frame
 * when the camera is close. The step is eased, not instant.
 *
 * WHAT ROUND v7 INHERITS WITHOUT ASKING. Two fixes apply to every preset here, older ones
 * included, because a fix is not a value: the page's chrome no longer takes a text selection, and
 * a selection is cleared when the globe leaves the emotional layer instead of staying drawn on
 * the environmental, physical and socio-economic ones. Every animated parameter defaults to 0, so
 * every preset that predates this round is unchanged. Verified two ways, because the gallery is
 * not a reliable baseline for the older frames: `v6-a` re-shot against its own gallery frames
 * comes out at 0.00 percent both at rest and after a click, and `v5-a`, whose gallery frame
 * differs by 19.43 percent through failure 32's scar banding, comes out at 0.00 percent against a
 * stash of the same commit without these changes.
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
  {
    id: "v7-a_base",
    title: "Round v7 base: the world steps back",
    note:
      "v6-f's cubic depth fade, which the operator chose, with the lift replaced by its inverse. " +
      "The clicked category holds its height and everything else sinks 0.4 of its own height " +
      "toward the planet over 320 ms, so zooming in and clicking no longer pushes the thing " +
      "being looked at out of frame: India moves 0.00 px, measured, while its neighbours move " +
      "4.7 px near the middle of the disc and 28 to 30 px at the limb. The network then grows " +
      "outward from that country breadth first over 900 ms, and each label comes up as the " +
      "front reaches it. Arcs raised from 1.060 to 1.100, which a measured 32.48 px label puts " +
      "on the lower third of the word and just above the leader tip at 1.098. The emphasis step " +
      "is cut from 1.22 to 1.12 and the English subtitle no longer grows at all.",
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
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0.4,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
    },
  },
  {
    id: "v7-b_arcs-lower",
    title: "Base, network just under the leader tip",
    note:
      "v7-a with arcLift at 1.090 rather than 1.100, which is the other side of a 0.010 radius, " +
      "about 5 screen pixels. The brief asked for two things that the measured label height " +
      "makes almost the same point: above the leader tip at 1.098, and on the lower third of the " +
      "word at 1.100. This is the reading that keeps the network clear of the text instead.",
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
      arcLift: 1.09,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0.4,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
    },
  },
  {
    id: "v7-c_big-type",
    title: "Base at the old emphasised size",
    note:
      "v7-a with the resting type at the size an emphasised label used to be drawn at: 14 by 1.22 " +
      "is 17.08, so 17 and 14.5 replace 14 and 12. The operator asked to see the default at the " +
      "boldened size. It is a real trade rather than a free improvement: bigger type is more " +
      "legible per label and collides more, and decluttering stays off through this round, so " +
      "every facing label is still drawn.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      selectionDim: 0.75,
      fontPxFar: 17,
      fontPxNear: 14.5,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0.4,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
    },
  },
  {
    id: "v7-d_sink-deep",
    title: "Base, the world steps further back",
    note:
      "v7-a with selectionSink at 0.65 rather than 0.4, so the unchosen categories give up nearly " +
      "two thirds of their height instead of two fifths. The separation is bought entirely at the " +
      "limb, where a radial move is in the plane of the screen; near the middle of the disc it is " +
      "along the view axis and shows as almost nothing whatever the value.",
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
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0.65,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
    },
  },
  {
    id: "v7-e_spread-fast",
    title: "Base, the network arrives sooner",
    note:
      "v7-a with the sweep at 450 ms and the step down at 220 ms. The brief said under two " +
      "seconds and maybe under one; this is the fast end of that. At four depth steps the " +
      "wavefront moves every 113 ms here against every 225 ms in v7-a, which is the difference " +
      "between reading the spread and simply noticing it.",
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
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0.4,
      selectionMotionMs: 220,
      selectionSpreadMs: 450,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
    },
  },
  {
    id: "v7-f_no-motion",
    title: "Base with nothing animated",
    note:
      "v7-a with both durations at 0, so the step down and the whole network land in one frame. " +
      "It exists so the animation is judged against its own absence rather than against the " +
      "older lift, the way v6-b did for the lift. At rest it is pixel identical to v7-a, which " +
      "is what makes it a fair control: only the gesture differs.",
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
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0.4,
      selectionMotionMs: 0,
      selectionSpreadMs: 0,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
    },
  },
  {
    id: "v8-a_spread-linear",
    title: "Round v8: the arrival ramp made linear",
    note:
      "v7-a with selectionSpreadEase set to linear. The wavefront was already linear in time, " +
      "so this is not a different wave: it is the shape of one country's own fade as the front " +
      "passes it. Measured at 250 ms intervals through a stretched sweep, this rises in equal " +
      "steps of 0.100 where the smooth version traces smoothstep, 0.028 0.104 0.215 0.352 0.500. " +
      "It starts and stops abruptly, which should read as a harder edge on the front.",
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
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0.4,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      selectionSpreadEase: "linear",
    },
  },
  {
    id: "v8-b_spread-gentle",
    title: "Round v8: a gentler arrival, three times as wide",
    note:
      "v7-a with selectionSpreadWindow at 1.5 rather than 0.5, keeping the smooth shape. Each " +
      "country takes three times as long to come up once the front reaches it, so more of the " +
      "category is part way up at any instant and the front reads as a soft gradient rather " +
      "than as an edge. The sweep still finishes in the same 900 ms; only the individual fades " +
      "overlap more.",
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
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0.4,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      selectionSpreadWindow: 1.5,
    },
  },
  {
    id: "v8-c_spread-linear-gentle",
    title: "Round v8: linear and gentle together",
    note:
      "The one preset in this round that carries two changes rather than one, and it is " +
      "deliberate: linear and gentler were offered as alternatives to each other, so the four " +
      "corners of the pair are what actually answers the question. v7-a is smooth and narrow, " +
      "v8-a is linear and narrow, v8-b is smooth and wide, and this is linear and wide.",
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
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0.4,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      selectionSpreadEase: "linear",
      selectionSpreadWindow: 1.5,
    },
  },
  {
    id: "v8-d_hold-dim",
    title: "Round v8: nothing steps back, everything dims a little more",
    note:
      "v7-a with the sink switched off and the dim deepened instead. Nothing outside the " +
      "chosen category moves at all, so every leader line keeps the length it had: measured, " +
      "131 of the 179 labels outside the category move under the 0.4 sink, up to 30.54 px at " +
      "the limb, and 0 of them move here. The separation is carried by opacity alone, at 0.55. " +
      "That value is a guess bracketed by two judgements rather than a measurement: 0.75 was " +
      "judged not enough this round, and 0.25 was judged too strong in round v6.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      fontPxFar: 14,
      fontPxNear: 12,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      selectionSink: 0,
      selectionDim: 0.55,
    },
  },
  {
    id: "v9-a_base",
    title: "Round v9: hold and dim, bigger type on approach, and the category legend",
    note:
      "The operator's fifth brief written as one view, and openly a composite of v8-d plus two " +
      "named changes. v8-d was chosen as ideal, so nothing about the selection moves: nothing " +
      "steps back, the separation is carried by opacity at 0.55, and the network still spreads " +
      "out from whatever is clicked over 900 ms. " +
      "THE ZOOM RAMP NOW INVERTS, which is the literal ask and is worth reading as deliberate: " +
      "fontPxNear rises from 12 to 20 while fontPxFar stays at 14, so labels GROW on approach " +
      "where every earlier preset shrank. It shows only inside the ramp, which starts at " +
      "cameraFar 2.2, so the gallery camera at 2.35 is outside it and cannot show the change; " +
      "1.6 is a camera that can. " +
      "The legend is the 14 category names down the left, each one clickable. It shares that side " +
      "with the views panel, so ?ev=2 is where it is actually looked at.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      fontPxFar: 14,
      fontPxNear: 20,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0,
      selectionDim: 0.55,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      legend: "on",
    },
  },
  {
    id: "v9-b_leader-bold",
    title: "Round v9: the chosen category's leader lines a little heavier",
    note:
      "v9-a with leaderSelectedWidthScale 1.5 and leaderSelectedOpacityScale 1.4, so the leaders " +
      "of the chosen category alone go from 0.00135 to 0.002025 in width and from 0.50 to 0.70 in " +
      "opacity. That is 68 percent of the network's own 0.003, so the network is still the bolder " +
      "of the two and the leaders have simply stopped being a hairline. The rest of the world's " +
      "leaders do not move.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      fontPxFar: 14,
      fontPxNear: 20,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0,
      selectionDim: 0.55,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      legend: "on",
      leaderSelectedWidthScale: 1.5,
      leaderSelectedOpacityScale: 1.4,
    },
  },
  {
    id: "v9-c_leader-bolder",
    title: "Round v9: the chosen leaders at exactly the network's weight",
    note:
      "The middle rung, and the one with a landmark behind it rather than a taste: at " +
      "leaderSelectedWidthScale 2.2 the chosen leaders are 0.00297 wide against the arcs' 0.003, " +
      "and at opacity scale 2 the product clamps to a solid 1. So the line up to a label and the " +
      "line across to its neighbour are the same line, and the whole selected structure reads as " +
      "one object.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      fontPxFar: 14,
      fontPxNear: 20,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0,
      selectionDim: 0.55,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      legend: "on",
      leaderSelectedWidthScale: 2.2,
      leaderSelectedOpacityScale: 2,
    },
  },
  {
    id: "v9-d_leader-boldest",
    title: "Round v9: the chosen leaders heavier than the network itself",
    note:
      "The far rung. leaderSelectedWidthScale 3 puts the chosen leaders at 0.00405 against the " +
      "arcs' 0.003, so they are 135 percent of the network and the attachment to the ground reads " +
      "as the stronger line. Deliberately past the point the operator asked for, because a ladder " +
      "that stops at the answer cannot show that it was the answer.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      fontPxFar: 14,
      fontPxNear: 20,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0,
      selectionDim: 0.55,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      legend: "on",
      leaderSelectedWidthScale: 3,
      leaderSelectedOpacityScale: 2,
    },
  },
  {
    id: "v9-e_leader-spread",
    title: "Round v9: the leader lines grow with the wavefront",
    note:
      "v9-a with leaderSpread on and nothing else. The arcs already spread out from the country " +
      "clicked; this makes the lines tying them to the ground do the same, so a country's whole " +
      "attachment arrives at once instead of the line standing under a label that has not come up " +
      "yet. Each leader grows out of the surface toward its label rather than appearing whole. " +
      "Best clicked rather than judged from a still: settled, this is pixel-identical to v9-a.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      fontPxFar: 14,
      fontPxNear: 20,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0,
      selectionDim: 0.55,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      legend: "on",
      leaderSpread: "on",
    },
  },
  {
    id: "v9-f_leader-spread-bold",
    title: "Round v9: growing and heavier together",
    note:
      "The one preset in this round carrying two changes, and it is deliberate: a hairline growing " +
      "out of the ground is the case where the growth is hardest to see, so the pair the operator " +
      "is most likely to want is the spread at a weight that can be followed. This is v9-e's " +
      "leaderSpread with v9-c's weights. If it works, v9-c and v9-e are what say which half did it.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      fontPxFar: 14,
      fontPxNear: 20,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0,
      selectionDim: 0.55,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      legend: "on",
      leaderSpread: "on",
      leaderSelectedWidthScale: 2.2,
      leaderSelectedOpacityScale: 2,
    },
  },
  {
    id: "v9-g_leader-only",
    title: "Round v9: the lines alone, with no mark on the countries",
    note:
      "The operator's third leader variant: heavier, solid leader lines and no colouring of the " +
      "country at all. selectionFill and selectionOutline both go to 0, so the glow and the two " +
      "texel border of every preset since v5-e are gone and the selection is carried entirely by " +
      "the lines, the labels and the opacity of everything else. It is also the only view here in " +
      "which the 43 microstates that have no polygon are not a special case, since nothing is " +
      "filled for anyone.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      fontPxFar: 14,
      fontPxNear: 20,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0,
      selectionOutline: 0,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0,
      selectionDim: 0.55,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      legend: "on",
      leaderSelectedWidthScale: 2.2,
      leaderSelectedOpacityScale: 2,
    },
  },
  {
    id: "v10-a_base",
    title: "Round v10: the sequence, and the boldest chosen lines",
    note:
      "The operator's sixth round, as one view. v9-f is the starting point, which is the spread " +
      "with heavier chosen leaders, and their choice of the boldest rung of the v9 ladder for those " +
      "leaders: leaderSelectedWidthScale 3 against the network's own 0.003. The country colours " +
      "stay, so this is v9-f and v9-d together rather than v9-g. On top of that is the whole " +
      "sequence: the clicked country's line goes up to its word over 260 ms, then the country " +
      "lights and the network starts; every country the network reaches has its line come down from " +
      "its word instead, over half of its own depth step, and lights when that line lands; and " +
      "clicking away or clicking another category takes the network apart in reverse at ten times " +
      "the speed, which is 116 ms for a full one against the 260 ms the next line takes to grow. " +
      "The whole gesture is 1160 ms.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      fontPxFar: 14,
      fontPxNear: 20,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0,
      selectionDim: 0.55,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      legend: "on",
      leaderSpread: "on",
      leaderSelectedWidthScale: 3,
      leaderSelectedOpacityScale: 2,
      leaderSpreadFrom: "split",
      selectionLeaderMs: 260,
      selectionLeaderShare: 0.5,
      selectionRetractSpeed: 10,
    },
  },
  {
    id: "v10-b_grow-from-foot",
    title: "Round v10: every line grows out of the ground",
    note:
      "leaderSpreadFrom back to foot, which is round v9's direction. It exists because the brief " +
      "says both things: twice in detail that the other countries' lines should come down from the " +
      "word, and once in a summary line that they should grow from the bottom. Two against one is " +
      "why v10-a splits them, and this is the other reading, so the answer can be had by looking " +
      "rather than by asking.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      fontPxFar: 14,
      fontPxNear: 20,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0,
      selectionDim: 0.55,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      legend: "on",
      leaderSpread: "on",
      leaderSelectedWidthScale: 3,
      leaderSelectedOpacityScale: 2,
      leaderSpreadFrom: "foot",
      selectionLeaderMs: 260,
      selectionLeaderShare: 0.5,
      selectionRetractSpeed: 10,
    },
  },
  {
    id: "v10-c_retract-slow",
    title: "Round v10: a teardown that can be followed",
    note:
      "selectionRetractSpeed 4 rather than 10. Ten times the build speed empties a full network in " +
      "116 ms, which is comfortably inside the next line's 260 ms and may be too fast to read as " +
      "anything but a cut. This takes 290 ms, which is longer than the line it hides behind, so the " +
      "last of the old network is still leaving as the new one begins. That overlap is the trade, " +
      "and it is why both exist.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      fontPxFar: 14,
      fontPxNear: 20,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0,
      selectionDim: 0.55,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      legend: "on",
      leaderSpread: "on",
      leaderSelectedWidthScale: 3,
      leaderSelectedOpacityScale: 2,
      leaderSpreadFrom: "split",
      selectionLeaderMs: 260,
      selectionLeaderShare: 0.5,
      selectionRetractSpeed: 4,
    },
  },
  {
    id: "v10-d_under-a-second",
    title: "Round v10: the whole gesture inside a second",
    note:
      "The operator's own bound from round v7 was under two seconds and ideally under one, and " +
      "v10-a is 1160 ms. This is 800: a 180 ms opening line and a 620 ms spread. Two numbers rather " +
      "than one, because they are one quantity split in the same proportion. The retract falls with " +
      "them, to 80 ms.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      fontPxFar: 14,
      fontPxNear: 20,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0,
      selectionDim: 0.55,
      selectionMotionMs: 320,
      selectionSpreadMs: 620,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      legend: "on",
      leaderSpread: "on",
      leaderSelectedWidthScale: 3,
      leaderSelectedOpacityScale: 2,
      leaderSpreadFrom: "split",
      selectionLeaderMs: 180,
      selectionLeaderShare: 0.5,
      selectionRetractSpeed: 10,
    },
  },
  {
    id: "v10-e_arc-led",
    title: "Round v10: more of the step to the arc",
    note:
      "selectionLeaderShare 0.3 rather than 0.5. The share decides how a depth step is divided " +
      "between the arc crossing to a country and that country's line coming down, and the " +
      "operator's words were that the two might take the same time. This gives the arc most of it, " +
      "so the wave travels visibly faster and each line drops more sharply. The ordering is " +
      "unchanged at any share: the next hop still leaves only once the line has landed.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      fontPxFar: 14,
      fontPxNear: 20,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0,
      selectionDim: 0.55,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      legend: "on",
      leaderSpread: "on",
      leaderSelectedWidthScale: 3,
      leaderSelectedOpacityScale: 2,
      leaderSpreadFrom: "split",
      selectionLeaderMs: 260,
      selectionLeaderShare: 0.3,
      selectionRetractSpeed: 10,
    },
  },
  {
    id: "v11-a_retract-2x",
    title: "Round v11: the teardown at twice the build rate",
    note:
      "selectionRetractSpeed 2 rather than 10, so a full network leaves in 580 ms rather than 116. " +
      "This round changed no values of the operator's own: it is three fixes, and the one thing left " +
      "to choose is how fast the reverse should run now that it can be seen at all. The ladder is " +
      "v10-a at 116 ms, v10-c at 290, this at 580 and v11-b at 1160. Their own constraint was that a " +
      "teardown finish inside the 260 ms the next selection's first line takes to grow, which only " +
      "v10-a meets; the rest let the old network still be leaving as the new one starts, which is " +
      "legible in a different way rather than wrong.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      fontPxFar: 14,
      fontPxNear: 20,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0,
      selectionDim: 0.55,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      legend: "on",
      leaderSpread: "on",
      leaderSelectedWidthScale: 3,
      leaderSelectedOpacityScale: 2,
      leaderSpreadFrom: "split",
      selectionLeaderMs: 260,
      selectionLeaderShare: 0.5,
      selectionRetractSpeed: 2,
    },
  },
  {
    id: "v11-b_retract-1x",
    title: "Round v11: the teardown at exactly the build rate",
    note:
      "selectionRetractSpeed 1, so taking a network apart takes exactly as long as building it: " +
      "1160 ms. The one value with a meaning rather than a feel, and the clearest view of the claim " +
      "that the reverse is the spread read backwards. Watch the leaders, the arcs and the marks, not " +
      "the type: the label sizes and the rest of the world stepping back forward run on " +
      "selectionMotionMs (320 ms) whatever the retract speed, so below about four times the build " +
      "they finish long before the network does.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      fontPxFar: 14,
      fontPxNear: 20,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0,
      selectionDim: 0.55,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      legend: "on",
      leaderSpread: "on",
      leaderSelectedWidthScale: 3,
      leaderSelectedOpacityScale: 2,
      leaderSpreadFrom: "split",
      selectionLeaderMs: 260,
      selectionLeaderShare: 0.5,
      selectionRetractSpeed: 1,
    },
  },
  {
    id: "v11-c_retract-half",
    title: "Round v11: the teardown slowed until it can be read",
    note:
      "selectionRetractSpeed 0.5, a 2320 ms teardown. It exists to be watched rather than chosen. " +
      "The order it shows is the one measured on v11-b: the deepest countries go first, each one's " +
      "leader line rising back into its word before the arcs that reached it are taken away, and the " +
      "country that was clicked last of all. At the shipped speed that whole sequence is 116 ms, " +
      "which is what the operator was reading as everything leaving at once.",
    params: {
      labelMode: "bilingual",
      identicalLines: "one",
      leaderLines: "on",
      clickMode: "selectNetwork",
      networkMode: "selected",
      categoryGraph: "delaunay",
      fontPxFar: 14,
      fontPxNear: 20,
      cameraFar: 2.2,
      cameraNear: 1.35,
      arcWidth: 0.003,
      arcOpacity: 1,
      arcLift: 1.1,
      leaderFoot: 0.7,
      leaderWidthScale: 0.45,
      leaderOpacityScale: 0.5,
      labelDepthFade: 0.45,
      labelDepthFadeCurve: 3,
      selectionStyle: "glow",
      selectionFill: 0.35,
      selectionOutline: 2,
      selectionEmphasis: "both",
      labelHalo: 0.16,
      selectionLift: 0,
      selectionSink: 0,
      selectionDim: 0.55,
      selectionMotionMs: 320,
      selectionSpreadMs: 900,
      selectionEmphasisScale: 1.12,
      selectionEmphasisSecondScale: 1,
      legend: "on",
      leaderSpread: "on",
      leaderSelectedWidthScale: 3,
      leaderSelectedOpacityScale: 2,
      leaderSpreadFrom: "split",
      selectionLeaderMs: 260,
      selectionLeaderShare: 0.5,
      selectionRetractSpeed: 0.5,
    },
  },
];

/**
 * Opens on the round v10 base: round v9's spread with the boldest chosen leader lines, and the
 * whole selection played as a sequence that reverses when it is cleared.
 *
 * This is a constant rather than a preset value, so changing it edits no shipped view.
 * `v1-c_bilingual`, `v4-a_base-bilingual`, `v5-a_base-delaunay`, `v6-a_base`, `v7-a_base` and
 * `v9-a_base` were the previous defaults and remain reachable by id, as everything here does.
 */
export const DEFAULT_EMO_PRESET_ID = "v10-a_base";

export function findEmoPreset(id: string): EmoPreset | undefined {
  return EMO_PRESETS.find((p) => p.id === id);
}

/** A preset's full parameter set: the defaults with its overrides applied. */
export function resolveEmoPresetParams(preset: EmoPreset): EmoViewParams {
  return { ...DEFAULT_EMO_PARAMS, ...preset.params };
}
