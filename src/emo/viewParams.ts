import type { EmoCategoryGraph, EmoWorldGraph } from "./graphs";

/**
 * Every tunable of the emotional-pain label views, in one object.
 *
 * A named preset is a partial override of these defaults (see viewPresets.ts). Presets are
 * append-only: once shipped, a preset's values are never edited, so an older design stays
 * reachable for comparison. Adjust behaviour by adding a preset, not by changing these numbers.
 */
export interface EmoViewParams {
  /** Which language a label shows. `focal` renders English near the camera axis, native elsewhere. */
  labelMode: "english" | "native" | "bilingual" | "focal";
  /** Which English string to use: the short category label, or the gloss of the native term. */
  englishText: "category" | "gloss";
  /**
   * What a bilingual label does when both of its lines carry the same word.
   *
   * 32 of the 195 countries are in that position: 29 whose primary language is English, plus the
   * 3 lexicon gaps that fall back to it. `one` draws the native line alone rather than printing
   * "Grief" above "Grief". It frees no room, measured; it just stops the label saying it twice.
   */
  identicalLines: "both" | "one";
  /**
   * What a click does. These compete for the same target, so a preset picks one.
   * `reshuffleNetwork` redraws a random world network with the next seed.
   */
  clickMode: "off" | "toggleLanguage" | "selectNetwork" | "reshuffleNetwork";

  /** Label standoff above the globe surface (globe radius = 1) when the camera is far / near. */
  standoffFar: number;
  standoffNear: number;
  /** Camera distances mapped to the far / near ends of the standoff and size ramps. */
  cameraFar: number;
  cameraNear: number;
  /** Label size in CSS pixels at the far / near ends of the ramp. */
  fontPxFar: number;
  fontPxNear: number;
  /** Second line size, as a fraction of the first, in bilingual mode. */
  secondLineScale: number;

  /** Hide a label once its direction faces this far away from the camera. */
  facingMin: number;
  /** Facing values at which a label reaches full / zero opacity. */
  fadeStart: number;
  /** How grey a label goes at the limb, 0 keeps full colour. */
  edgeDesaturation: number;
  /**
   * Extra transparency with distance from the viewer, on top of the limb fade above.
   *
   * `fadeStart` only acts in the last stretch before a label is culled, so labels stay at full
   * strength across most of the disc and the ones receding toward the horizon compete on equal
   * terms with the ones facing the camera. This is a plain ramp across the whole hemisphere
   * instead: at the centre a label keeps full opacity, and at the horizon it keeps 1 minus this.
   * 0 is the behaviour of every preset that predates it.
   */
  labelDepthFade: number;
  /**
   * Exponent applied to `(1 - facing)` before the depth fade above multiplies it.
   *
   * THE SHIPPED FADE IS ALREADY ACCELERATING, by more than it looks. `1 - facing` is
   * `1 - cos(theta)`, which is about `theta^2 / 2`, and the screen distance from the centre of
   * the disc is `rho = R sin(theta)`. So the fade that reads as linear is already quadratic in
   * distance from the middle. That makes 0.5 the approximately-linear option, 1 what shipped,
   * and 2 a strong ease-in. Default 1, so no preset that predates it moves.
   */
  labelDepthFadeCurve: number;
  /**
   * Halo width as a fraction of the font size, replacing the directional drop shadow.
   *
   * The shipped `text-shadow: 0 1px 3px` darkens below a glyph and leaves its top edge
   * unprotected, which is weakest over the bright choropleth. Above 0 this becomes a symmetric
   * surround at this fraction of the current font size. 0 keeps the drop shadow, so every preset
   * that predates it is unchanged.
   */
  labelHalo: number;

  /** Half-angle in degrees of the focal cone used by `labelMode: "focal"`. */
  focalConeDeg: number;
  /** Width of the blend band at the cone edge, in degrees. */
  focalBlendDeg: number;

  /**
   * Which arcs are drawn. `all` and `selected` link countries sharing a pain category.
   * `connected` links the whole world by proximity while nothing is clicked, and switches to the
   * clicked country's category network once something is.
   */
  networkMode: "off" | "all" | "selected" | "connected";
  /**
   * How the classifier-agnostic world network is built. `mst`, `rng`, `gabriel` and `delaunay`
   * are guaranteed not to cross themselves; `knn` and `random` are not. See graphs.ts.
   */
  worldGraph: EmoWorldGraph;
  /**
   * How countries inside one pain category are joined. `complete` links all of them to all;
   * `gabriel` and `delaunay` are the same non-crossing rules the world graph offers, computed
   * over that category's own points.
   */
  categoryGraph: EmoCategoryGraph;
  /** How many nearest neighbours each country links to, for the two kNN-based rules. */
  kNeighbours: number;
  /** Seed for `worldGraph: "random"`, so a random network is still reproducible. */
  randomSeed: number;
  /**
   * Radius the arcs ride at when the camera is at the far stop. They follow the same zoom ramp
   * as the labels from there, keeping their share of the height above the surface, so keeping
   * this below `standoffFar` keeps the arcs under the text at every zoom. See layout.ts.
   */
  arcLift: number;
  /** Degrees of arc removed at each end, so a line stops short of the label it points at. */
  arcEndTrimDeg: number;
  /** Arc width in world units, so it is a fraction of the globe radius rather than pixels. */
  arcWidth: number;
  arcOpacity: number;
  /**
   * A hairline from each country up to its own label, so a word floating over a crowded region
   * is visibly attached to the country it names. Takes `arcWidth` and `arcOpacity` scaled by the
   * two `leader*Scale` values below.
   */
  leaderLines: "off" | "on";
  /**
   * Radius the leader line starts at, in globe radii.
   *
   * In all-layers mode the pain scars dent the surface inward, and a foot sitting just above the
   * undented sphere then leaves a visible gap between the line and the land it points at. The
   * depth is inferred rather than read: the misplaced selection wash showed a parallax of roughly
   * 50 px at about 1000 px per radius and 33 degrees off axis, which puts the surface near 0.92
   * there. GlobeView's scar field is private, so this is an estimate from what was drawn. A foot below the deepest
   * dent closes that gap at every depth, because the globe writes depth before these lines draw
   * and clips whatever falls inside it. The line therefore runs to the country's centre through
   * the surface, and only the part outside the surface is ever seen.
   */
  leaderFoot: number;
  /**
   * The same radius for the emotional-pain layer on its own, where the globe draws no surface.
   *
   * TWO FEET, BECAUSE THERE ARE TWO GLOBES. `leaderFoot` works by being buried: the line starts
   * below the deepest scar dent and the globe's own depth write cuts away everything inside the
   * surface. That depends on something being there to write depth, and in all-layers mode the
   * base mesh is exactly that, an invisible mask at 0.994 of the warped shell. On the emotional
   * layer alone the mesh is hidden outright, `GLOBE_SHELL_VISIBLE_IN_SCAR_MODE` is false and the
   * display mode is not `texture`, so nothing writes depth and the whole buried length draws.
   * At `leaderFoot: 0.7` that is 0.3 of a radius of line reaching out of the planet, which is
   * what the operator saw as spears crossing the disc.
   *
   * So this layer gets a foot that needs no mask: just outside the undented sphere the borders
   * are drawn on, which lands the tip on the country rather than through it.
   */
  leaderFootEmoOnly: number;
  /**
   * Leader width and opacity as fractions of the network's own, so the two read as different
   * kinds of line rather than as one line of two lengths. 1 makes them identical, which is how
   * every preset that predates these behaved.
   */
  leaderWidthScale: number;
  leaderOpacityScale: number;
  /**
   * The same two, again, for the leader lines of the pain category that is currently chosen.
   *
   * Multipliers on top of the pair above rather than replacements for it, so 1 and 1 are exactly
   * the behaviour of every preset that predates them and a preset says how much heavier the
   * chosen category's lines are, not how heavy they are. The opacity product is clamped at 1, so
   * a view whose leaders rest at half the network's opacity reaches solid at 2.
   *
   * WHICH LINES THESE ARE IS READ FROM THE MOTION, NEVER TRACKED LOCALLY. Membership is the
   * category being chosen OR still taking itself apart.
   *
   * THE SECOND HALF OF THAT IS NOT REDUNDANT, AND ONLY A SLOW RETREAT SHOWS IT. Emphasis fades
   * over `selectionMotionMs` while a retreat runs at `selectionRetractSpeed` times the build, and
   * nothing ties the two together. At ten times the build a full retreat is 116 ms and finishes
   * inside the 320 ms fade, which is why `emphasisOf(category) > 0` was enough for three rounds;
   * at one time it is 1160 ms, the fade ends first, and every heavy line in the category would
   * snap back to its whole length at the ordinary weight while the arcs and the marks carried on
   * leaving. The lines belong to the wave for as long as the wave exists.
   *
   * On deselect the weight still steps rather than eases, now at the instant the wave is dropped
   * rather than at the instant emphasis reaches 0.
   */
  leaderSelectedWidthScale: number;
  leaderSelectedOpacityScale: number;
  /**
   * Whether the chosen category's leader lines grow with the wavefront instead of being there
   * from the start.
   *
   * The arcs already spread; this makes the lines that tie them to their countries do the same,
   * so a country's whole attachment arrives at once rather than the line waiting under a label
   * that has not come up yet. Each leader grows out of the ground toward its label as the front
   * passes, rather than appearing whole: `arrivalOf` scales the head between the foot and where
   * it would otherwise be. A leader whose country the wave has not reached is not written at
   * all, because a zero-length segment still paints its round cap as a dot on the surface.
   *
   * `off` is the behaviour of every preset that predates it. Only the chosen category is ever
   * affected: the rest of the world's leader lines are not part of a wave.
   */
  leaderSpread: "off" | "on";
  /**
   * Which end of a growing leader line moves, once `leaderSpread` is on.
   *
   * `foot` grows every one of them out of the ground toward its word, which is what round v9
   * shipped. `split` grows only the country that was clicked that way, and grows every other
   * country's line downward from its word to the ground instead, which is the operator's reading:
   * the first line is the gesture leaving the country you chose, and every line after it is the
   * network arriving at a country and reaching down to claim it.
   *
   * The direction is the only difference. The line occupies the same space either way, and at
   * either end of the growth the picture is identical, so this can only be judged in motion.
   */
  leaderSpreadFrom: "foot" | "split";
  /** Opacity multiplier applied to every label except the selected one. */
  selectionDim: number;
  /**
   * Extra radius given to the labels, arcs and leader-line heads of the selected pain category,
   * in globe radii, while a selection is active.
   *
   * WHAT IT DOES AND WHAT IT CANNOT DO. It raises the selected category clear of the rest, and
   * because a label's paint order is bucketed on `radius * facing`, a lifted label also tends to
   * paint over its unlifted neighbours. It does not put the network in front of the text: the
   * labels are DOM above a transparent WebGL canvas, so every label paints over every arc at
   * every radius. See PROGRESS.md 21.2, recorded there as failure 33.
   *
   * The step is instant. An eased one cannot be a single number per layer, because clicking a
   * second category mid-transition needs the first to fall while the second rises, which is
   * per-category state in three layers rather than one scalar.
   *
   * 0 is the behaviour of every preset that predates it.
   */
  selectionLift: number;
  /** Alpha of the wash filling the countries of the selected pain category. */
  selectionFill: number;
  /**
   * How far every OTHER pain category steps down toward the planet while one is selected, as a
   * fraction of the label's own height above the surface.
   *
   * THE INVERSE OF THE LIFT, AND THE OPERATOR'S PREFERRED READING OF IT. `selectionLift` raises
   * the chosen category, which pushes it out of frame when the camera is close: the thing being
   * looked at is the thing that moves. This lowers everything else instead, so the chosen
   * category stays exactly where it was and the world steps back from it.
   *
   * A FRACTION, NOT A RADIUS, and deliberately unlike `selectionLift`. A fixed offset large
   * enough to read at the far stop would push labels through the surface at the near one, where
   * `standoffNear` leaves only 0.015 of a radius to give up. Expressed as a share of that height,
   * 1 lands the labels on the surface at every zoom and no value can push them inside it. The
   * cost is honest and worth stating: the step is subtle when the camera is close, because the
   * labels are already close to the ground there, and the dim and the size step carry the
   * distinction at that range instead.
   *
   * 0 is the behaviour of every preset that predates it.
   */
  selectionSink: number;
  /**
   * How long the step down, the step up and the dim take, in milliseconds.
   *
   * 0 is the instant jump that shipped, so every preset that predates this is unchanged. The
   * curve is ease-out cubic, retargeted from wherever a track currently is, so clicking a second
   * category mid-move continues from the real position rather than snapping back. See
   * selectionMotion.ts for why this is per-category state and not one number.
   */
  selectionMotionMs: number;
  /**
   * How long the network takes to spread outward from the country that was clicked, in
   * milliseconds. 0 draws the whole network at once, which is what shipped.
   *
   * The wave is a breadth-first search from that country: its own arcs grow first, then the arcs
   * leaving whatever they reached, and so on, and each country's label comes up as the front
   * passes it. So the number is the time for the whole sweep, not per step, and the operator's
   * brief was "less than two seconds, maybe even less than one".
   *
   * Independent of `selectionMotionMs` on purpose. The step down is a change of state and wants
   * to be over quickly; the spread is the thing being watched and wants long enough to be read.
   */
  selectionSpreadMs: number;
  /**
   * How long the chosen country's own leader line takes to reach its word before the network
   * starts to spread, in milliseconds. It is also how long every other country's leader takes
   * once the network reaches it.
   *
   * THE GESTURE IS TWO PHASES, AND THIS IS THE FIRST. The operator's order is that the line
   * grows out of the country that was clicked, and only once it has arrived at the word does that
   * country light up and the network begin. Each country the network then reaches repeats it in
   * miniature: the arc lands, its line reaches down, and only then does the country light.
   *
   * IT IS ALSO THE BUDGET FOR TAKING THE PREVIOUS NETWORK APART. Clicking a second category
   * reverses the first one at `selectionRetractSpeed` times the speed it was built, and that
   * happens while this line is growing. At the round v10 values a full network unbuilds in 116 ms
   * against 260 ms of lead-in, so the screen is clear well before the new network starts. Nothing
   * enforces the ordering through this number, though: a wave that would otherwise overlap its
   * own predecessor holds until the mesh it needs is empty.
   *
   * 0 removes the phase entirely, which is what every preset before round v10 does: the leader
   * lines then follow the wavefront exactly as they did.
   */
  selectionLeaderMs: number;
  /**
   * How many times faster than its construction a network is taken apart when it is replaced or
   * cleared.
   *
   * The operator asked for the deconstruction to be "simply the construction, but in reverse",
   * so it is exactly that: the same wave, the same order, the same two phases, running backward.
   * The network unspreads toward the country it grew from and that country's leader line is the
   * last thing to go, which is the first thing that happened, reversed.
   *
   * 0 removes the network the instant the selection changes, which is what every preset before
   * round v10 does.
   */
  selectionRetractSpeed: number;
  /**
   * How much of each depth step of the spread belongs to the leader line coming down, rather
   * than to the arc that reaches that country.
   *
   * THE ORDER INSIDE ONE STEP. The wave reaches a country, its line comes down from its word, and
   * only then does the next hop leave. Without this reservation the two overlap: a leader taking
   * roughly a third of the whole sweep is longer than a step of a four step sweep, so the next
   * country was already connected while the previous line was still descending, which is what
   * the operator saw. Expressed as a share of a step rather than as a duration, because a step is
   * what it has to fit inside, and the number of steps is a property of the graph rather than of
   * the view. Half gives the line and the arc the same time.
   *
   * 0 gives the whole step to the arc, which is what every preset before round v10 does. The
   * ceiling is 0.9, since the arc needs some of the step to cross in.
   */
  selectionLeaderShare: number;
  /**
   * The shape of one country's own fade as the wavefront passes it.
   *
   * The front itself already travels at a constant speed: `spreadFront` is linear in time, so
   * "make the spread linear" is not about the wave. What is eased is each country's arrival,
   * which is smoothstepped over a window of `selectionSpreadWindow` depth steps. `linear` makes
   * that a straight ramp, which starts and stops abruptly and reads as a crisper front.
   */
  selectionSpreadEase: "smooth" | "linear";
  /**
   * How long one country takes to come up once the wave reaches it, in depth steps.
   *
   * Trades the crispness of the wavefront against a country blinking on. Wider is the gentler
   * fade the operator asked to see; at a five step sweep 0.5 is about a tenth of the total.
   */
  selectionSpreadWindow: number;
  /**
   * Width of the outline drawn round those countries, in texels of the 2048 by 1024 highlight
   * map, which is about 1.7 screen pixels each at the gallery camera. 0 draws no outline, so a
   * preset chooses a wash, a thickened border, or both.
   */
  selectionOutline: number;
  /**
   * Great-circle radius of the disc drawn for a country that has no polygon, in degrees.
   *
   * Natural Earth 1:110m has no geometry for 29 of the 195 countries these views label, all of
   * them small island or city states, so the selection wash and outline silently skipped them: the
   * arc arrived, the leader line landed, the label came forward, and the country never lit. A size
   * has to be given rather than inherited, because even with a polygon Malta is about one texel
   * across on the 2048 by 1024 highlight map. 0 draws nothing, which is what every preset built
   * before this did.
   */
  selectionMarkerDeg: number;
  /**
   * How the highlight sits on the country's own colour. `wash` lays white over it, which is what
   * shipped. `glow` adds a warm light to it instead, so the country's existing choropleth colour
   * brightens rather than being covered.
   */
  selectionStyle: "wash" | "glow";
  /**
   * How a selection is made legible. `dim` steps every other label back, which is what shipped.
   * `bold` leaves them alone and enlarges the selected category's labels instead. `both` does
   * each.
   *
   * The 19 Noto subsets ship at weight 400 only, so a weight above that is synthesised for the
   * non-Latin scripts. That is already true of the 600 every label uses, and unlike synthetic
   * oblique, which is why decision 6 bans italic, emboldening does not break Arabic joining or
   * Indic conjuncts. The size step is what carries most of the emphasis regardless.
   */
  selectionEmphasis: "dim" | "bold" | "both";
  /**
   * How much larger an emphasised label's main lines are drawn, as a multiplier on the font size.
   *
   * Separate from `selectionEmphasis` because the enum decides whether to emphasise and this
   * decides by how much. 1.22 is what shipped, and the operator's reading of it is that the step
   * is larger than it needs to be, which is a value rather than a behaviour and so belongs here.
   */
  selectionEmphasisScale: number;
  /**
   * The same for the smaller English line under a native one.
   *
   * Its own number, because the operator asked for the second line to stay where it is while the
   * word above it grows: the English gloss is a subtitle, and a subtitle that grows with its
   * title has not been emphasised, it has just been zoomed. 1 leaves it alone; 1.22 is what
   * shipped, when one multiplier drove all three lines.
   */
  selectionEmphasisSecondScale: number;
  /**
   * A list of the 14 pain categories down the left of the screen, each one clickable.
   *
   * Answers the question the globe cannot: not "what does this country feel" but "where is this
   * feeling". A click picks one member of that category at random and selects it, so everything
   * downstream behaves exactly as it does from a click on the globe. `off` is the behaviour of
   * every preset that predates it.
   *
   * It sits on the same side as the views panel, so `?ev=2` or `?emoPanel=0` is where it is seen.
   */
  legend: "off" | "on";
  /** Legend text size in CSS pixels. Fixed on screen, so it does not follow the zoom ramp. */
  legendFontPx: number;
  /**
   * How white the words are while nothing is selected. Once something is, the chosen word goes to
   * full white and the rest take `selectionDim` on top of this, which is the same step back the
   * country labels make.
   */
  legendOpacity: number;
  /**
   * What a second click on the word whose category is already selected does.
   *
   * `reroll` picks another country from that category at random, which is what the operator's
   * round v10 brief asked for in so many words: "Only if the network is fully constructed should
   * button click on the same category create a new random network." `clear` puts the selection
   * away instead, which is the reading they chose after both were put to them, and which is the
   * other reading of one truncated sentence in the same brief.
   *
   * The two cannot be combined. A roll can land on the country already selected, so a gesture
   * that means both would read "show me another one" as "clear" whenever it did.
   *
   * Neither affects a click on a DIFFERENT word, which always selects, nor a click while that
   * category's own network is still arriving, which always does nothing. Defaults to `reroll`,
   * so no preset that predates the choice moves.
   */
  legendRepeatClick: "reroll" | "clear";
  /**
   * Radial separation between consecutive pain-category shells, in globe radii. Labels and arcs
   * both take it, so each category gains its own layer. 0 puts everything on one shell, which is
   * how every preset shipped before this behaved.
   */
  multiplexSpread: number;

  /**
   * White is the default; colour is opt-in because the families do not carry clean meaning.
   * `violet` is the near-white ramp: fourteen tints of one violet-to-pink band, separable side
   * by side and reading as white from a distance.
   */
  colourMode: "white" | "family" | "category" | "violet";
  /** Global cap on visible labels, lowest score dropped first. 0 means no cap. */
  density: number;
  /**
   * `priority` hides a label whose screen box collides with a stronger-scoring one. Labels are
   * never moved: no production globe library repositions them, because a label that slides on
   * every frame of a rotation reads as jitter rather than as placement.
   */
  declutterMode: "off" | "priority";
  /**
   * Minimum clear space required between two label boxes, in CSS pixels. Negative lets them
   * overlap by that much, which keeps more labels on screen at the cost of some collision.
   */
  declutterPad: number;
}

export const DEFAULT_EMO_PARAMS: EmoViewParams = {
  labelMode: "english",
  englishText: "category",
  // Off by default, so every preset that predates it renders exactly as it did.
  identicalLines: "both",
  clickMode: "off",

  // Matches the incumbent word cloud's 1.11 standoff at the far end, and descends toward the
  // surface as the camera approaches so labels read as belonging to their country.
  standoffFar: 1.11,
  standoffNear: 1.015,
  cameraFar: 2.8,
  cameraNear: 1.4,
  fontPxFar: 13,
  fontPxNear: 9,
  secondLineScale: 0.72,

  facingMin: 0.05,
  fadeStart: 0.28,
  edgeDesaturation: 0.55,
  // Both off, so every preset that predates them renders exactly as it did.
  labelDepthFade: 0,
  // 1 is the shipped curve: linear in (1 - facing), so quadratic in screen distance.
  labelDepthFadeCurve: 1,
  labelHalo: 0,

  focalConeDeg: 26,
  focalBlendDeg: 12,

  networkMode: "off",
  worldGraph: "knn",
  categoryGraph: "knn",
  kNeighbours: 3,
  // The workspace default seed, so a random network is the same one every reload.
  randomSeed: 43,
  // Just under the far standoff of 1.11, so arcs pass beneath the labels rather than through
  // them, and they hold that share of the height all the way in.
  arcLift: 1.06,
  arcEndTrimDeg: 1.5,
  arcWidth: 0.0025,
  arcOpacity: 0.55,
  // Off by default, so every preset that predates them renders exactly as it did.
  leaderLines: "off",
  // Just clear of the choropleth at 1.001 and the selection wash at 1.0025. Above every dent,
  // which is the behaviour every preset before this shipped with.
  leaderFoot: 1.004,
  // Just outside the sphere the country borders ride on, so the tip meets the surface.
  leaderFootEmoOnly: 1.002,
  // 1 and 1: the leader is exactly the network's line, as it was.
  leaderWidthScale: 1,
  leaderOpacityScale: 1,
  // 1, 1 and off: the chosen category's leaders are exactly the others', as they were.
  leaderSelectedWidthScale: 1,
  leaderSelectedOpacityScale: 1,
  leaderSpread: "off",
  // Every growing leader out of the ground, which is how round v9 drew them.
  leaderSpreadFrom: "foot",
  selectionDim: 0.25,
  // Flat by default, so every preset that predates the lift is unchanged.
  selectionLift: 0,
  selectionFill: 0.18,
  // Both off, so every preset that predates them keeps the instant, flat selection that shipped.
  selectionSink: 0,
  selectionMotionMs: 0,
  selectionSpreadMs: 0,
  // Both 0: no lead-in phase and no reverse, so every preset before round v10 is unchanged.
  selectionLeaderMs: 0,
  selectionRetractSpeed: 0,
  // The whole step to the arcs, so no preset that predates the descent moves.
  selectionLeaderShare: 0,
  // The shape and width that shipped as constants, so no preset built before these moves.
  selectionSpreadEase: "smooth",
  selectionSpreadWindow: 0.5,
  // All three keep the behaviour that shipped: a white wash, no outline, and dimming the rest.
  selectionOutline: 0,
  // 0 keeps the shipped behaviour: a country with no polygon is simply not marked.
  selectionMarkerDeg: 0,
  selectionStyle: "wash",
  selectionEmphasis: "dim",
  // Both 1.22: exactly the single multiplier that drove all three lines before they split.
  selectionEmphasisScale: 1.22,
  selectionEmphasisSecondScale: 1.22,
  // Off by default, so every preset that predates the legend is unchanged.
  legend: "off",
  legendFontPx: 15,
  legendOpacity: 0.55,
  legendRepeatClick: "reroll",
  // Flat by default, so the 16 presets that predate the shells are unchanged.
  multiplexSpread: 0,

  colourMode: "white",
  density: 0,
  // Off by default so every preset shipped before this existed renders exactly as it did.
  declutterMode: "off",
  // Two labels whose boxes touch read as one word, so the default asks for a visible gap.
  declutterPad: 4,
};

/**
 * The permitted values of every enum-valued parameter.
 *
 * One source of truth for two consumers that would otherwise drift: the URL reader validates
 * hand-typed values against it, and the view panel builds its dropdowns from it. An unvalidated
 * enum is worth guarding because an unrecognised labelMode falls through every branch of the
 * renderer's switch and silently hides all 195 labels.
 */
export const EMO_ENUM_VALUES: { [K in EmoEnumKey]: readonly EmoViewParams[K][] } = {
  labelMode: ["english", "native", "bilingual", "focal"],
  englishText: ["category", "gloss"],
  identicalLines: ["both", "one"],
  clickMode: ["off", "toggleLanguage", "selectNetwork", "reshuffleNetwork"],
  networkMode: ["off", "all", "selected", "connected"],
  worldGraph: ["knn", "mst", "rng", "gabriel", "delaunay", "random"],
  categoryGraph: ["knn", "complete", "gabriel", "delaunay"],
  leaderLines: ["off", "on"],
  leaderSpread: ["off", "on"],
  leaderSpreadFrom: ["foot", "split"],
  legend: ["off", "on"],
  legendRepeatClick: ["reroll", "clear"],
  selectionStyle: ["wash", "glow"],
  selectionEmphasis: ["dim", "bold", "both"],
  selectionSpreadEase: ["smooth", "linear"],
  colourMode: ["white", "family", "category", "violet"],
  declutterMode: ["off", "priority"],
};

/** The parameters whose value is one of a fixed set of strings. */
export type EmoEnumKey = {
  [K in keyof EmoViewParams]: EmoViewParams[K] extends string ? K : never;
}[keyof EmoViewParams];

/** The parameters that a slider can drive. */
export type EmoNumberKey = {
  [K in keyof EmoViewParams]: EmoViewParams[K] extends number ? K : never;
}[keyof EmoViewParams];

/**
 * The fields in which `to` differs from `from`.
 *
 * Used twice, against two different baselines. Against a preset's resolved parameters it gives
 * the shortest URL that reproduces the current view; against DEFAULT_EMO_PARAMS it gives exactly
 * the `params` object literal for a new entry in the append-only preset registry.
 */
export function diffEmoParams(
  from: EmoViewParams,
  to: EmoViewParams,
): Partial<EmoViewParams> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(to) as (keyof EmoViewParams)[]) {
    if (from[key] !== to[key]) out[key] = to[key];
  }
  return out as Partial<EmoViewParams>;
}
