/**
 * How a pain category moves when it is chosen, and when it stops being chosen.
 *
 * WHY THIS IS A MODULE AND NOT A NUMBER. The obvious implementation of an eased selection is one
 * scalar per layer, and it cannot express the case it meets most often: click one category, then
 * click a second before the first has settled, and the first must fall while the second rises. So
 * the state is per category, and it is here rather than in any one layer because four of them
 * need the same answer at the same instant. The labels, the arcs, the leader lines and the country
 * mark reading four private copies of one curve is exactly how they would drift apart, which is
 * the reason layout.ts exists as well.
 *
 * TWO TRACKS PER CATEGORY, NOT ONE. A category is in one of three states, so one number cannot
 * carry it: nothing is selected (resting), this is the chosen one, or something else is and this
 * has stepped back. `emphasis` and `recede` are those last two as separate eased fractions, and
 * both are 0 at rest. Every consumer is then a plain interpolation:
 *
 *     radius   = sunk(standoff, sink * recede) + lift * emphasis
 *     dim      = 1 + (selectionDim - 1) * recede
 *     size     = 1 + (emphasisScale - 1) * emphasis
 *
 * THE MOTION INVERTS THE LIFT ON PURPOSE. `selectionLift` raises the chosen category, which the
 * operator found pushes it out of frame when the camera is close. `selectionSink` lowers
 * everything else instead, so the thing being looked at never moves. Both exist, both animate,
 * and a preset can use either or neither; the round v7 base uses the sink alone.
 *
 * EASE-OUT CUBIC. Fast at the start and settling at the end, which is the shape of something
 * arriving rather than something being dragged. Retargeting takes the current value as the new
 * start, so an interrupted move continues from where it actually is and never jumps.
 *
 * THAT IS THE STEP DOWN, NOT THE SPREAD. Two different easings live here and they are easy to
 * confuse. The cubic above governs `emphasis` and `recede` over `selectionMotionMs`, which is a
 * category rising or stepping back. The wavefront is separate and is LINEAR in time; what
 * `selectionSpreadEase` shapes is one country's own fade as the front passes it, over a window of
 * `selectionSpreadWindow` steps. Asking for "a linear spread" therefore changes the second and
 * leaves the first alone, because the first is already the shape the operator chose last round.
 *
 * ONE PROGRESS SCALAR PER WAVE, COVERING BOTH HALVES OF THE GESTURE. A selection is two phases,
 * and they are one number `p` in the range 0 to 2 rather than two clocks:
 *
 *     p in [0, 1]   the chosen country's own leader line grows up to its word
 *     p in [1, 2]   the network spreads outward from that country
 *
 * Each half runs at its own rate, `selectionLeaderMs` and `selectionSpreadMs`. The reason for one
 * scalar rather than two clocks is the reverse: taking a network apart is "the construction, in
 * reverse and faster", and with one scalar that is literally `p` running back to 0 at
 * `selectionRetractSpeed` times each half's own rate. The network unspreads, and then the leader
 * that started it shrinks back into the ground, in the order they arrived.
 *
 * SEVERAL WAVES CAN BE IN FLIGHT. One is growing and any number are being taken apart, because a
 * click during a retreat is allowed: A can be retreating while B grows and C is clicked. Each wave
 * carries its own category, so a country is only ever in one of them and every per-country
 * question below is answered by finding that one wave.
 */
import type { EmoData } from "./emoData";
import type { EmoViewParams } from "./viewParams";

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);

/** Below this a value counts as having arrived, so a track stops asking to be redrawn. */
const SETTLE_EPSILON = 1e-4;

/** `p` at the end of the lead-in, and at the end of the spread. See the module docstring. */
const LEAD_END = 1;
const SPREAD_END = 2;

/**
 * Narrowest arrival window that still means anything, in depth steps.
 *
 * `selectionSpreadWindow` replaced the constant this used to be. The constant's docstring argued
 * that no view compared two values of it, which was true until the operator asked to see a
 * gentler fade, and a sentence that justifies a decision has to be retired with the decision. All
 * that survives of it is this floor: at a window of 0 the ramp divides by its own width, so the
 * slider stops just above nothing rather than at it.
 */
const MIN_ARRIVAL_WINDOW = 0.01;

/**
 * Most of a depth step that may be given to the leader line coming down, leaving the rest for the
 * arc that reaches it. A share of 1 would give the arcs no time at all to cross.
 */
const MAX_LEADER_SHARE = 0.9;

/**
 * How much of one depth step belongs to the leader line rather than to the arc.
 *
 * Exported because the arc layer bakes the same split into its reveal times, and two copies of
 * one clamp is how the arcs and the labels come to disagree about when a step ends.
 */
export function clampLeaderShare(share: number): number {
  return share < 0 ? 0 : share > MAX_LEADER_SHARE ? MAX_LEADER_SHARE : share;
}

/**
 * 0 before `from`, 1 after `to`. `smooth` is the smoothstep that shipped; `linear` is the bare
 * ramp, which starts and stops abruptly and so reads as a harder edge on the wavefront.
 */
const clampedRamp = (
  v: number,
  from: number,
  to: number,
  ease: EmoViewParams["selectionSpreadEase"],
): number => {
  const t = clamp01((v - from) / (to - from || 1));
  return ease === "linear" ? t : t * t * (3 - 2 * t);
};

interface Track {
  from: number;
  to: number;
  startMs: number;
  value: number;
}

interface CategoryMotion {
  /** 1 while this is the chosen category, eased. */
  emphasis: Track;
  /** 1 while some other category is chosen and this one has stepped back, eased. */
  recede: Track;
}

/** One selection gesture in flight, either building or being taken apart. */
interface Wave {
  cat: string;
  /** The country the click came from, whose leader line runs first and retracts last. */
  origin: string;
  /** Depth in steps of each country in the category. */
  arrivals: ReadonlyMap<string, number>;
  /** One past the deepest, so a normalised time is `depth / span`. */
  span: number;
  /** 0 to 2. See the module docstring. */
  p: number;
  /** Where `p` is heading: SPREAD_END while building, 0 while being taken apart. */
  to: number;
  /**
   * Real time before which this wave may not begin to spread.
   *
   * A category has one arc mesh, so a wave replacing another wave of the SAME category cannot
   * start drawing until that one has finished undrawing. Holding at `p = 1` rather than clamping
   * `selectionLeaderMs` makes the invariant true by construction instead of by trusting that the
   * operator set the lead-in longer than the retreat.
   */
  spreadNotBeforeMs: number;
  /** Whether `p` has crossed LEAD_END, so the generation is bumped exactly once per wave. */
  spreading: boolean;
}

export interface EmoSelectionMotion {
  /**
   * Advance every track to the current instant. main.ts calls this once per frame, before any
   * layer reads it, so the layers cannot see different moments of the same animation.
   */
  tick(): void;
  setParams(next: EmoViewParams): void;
  /** Retarget every category. Passing null returns them all to rest. */
  setSelection(cat: string | null): void;
  /** Snap to rest with no animation, for a change that is not a gesture, such as a layer switch. */
  reset(): void;
  emphasisOf(cat: string): number;
  recedeOf(cat: string): number;
  /**
   * Start a wave. `arrivals` is each country's depth in steps and `span` the total, both from
   * planSpread; the arc layer supplies them because it is the layer that owns the graph.
   *
   * Any wave already in flight is retired here as well as in setSelection, and it has to be both:
   * re-picking a country inside the ALREADY selected category never reaches setSelection, because
   * that returns early when the category has not changed, while a selection whose category has no
   * network never reaches here, because the arc layer returns before calling it.
   *
   * THE FALLBACK ASSUMES THE TWO LAYERS AGREE ON WHO EXISTS. `arrivalOf` answers 1 for a country
   * no wave mentions, which is right for a view with no wave and wrong for a country that should
   * have been in one: it would light at once while its neighbours waited. The arc layer builds
   * this map from the countries that have a centroid, and the label layer draws exactly that same
   * set, so today they cannot disagree. Nothing enforces it. If either layer ever gains or loses a
   * country the other keeps, this is where it will show.
   */
  setSpread(cat: string, origin: string, arrivals: ReadonlyMap<string, number>, span: number): void;
  /**
   * How far this country has come up, 0 before the wave reaches it and 1 once it has passed.
   * 1 everywhere when no wave covers it.
   */
  arrivalOf(iso3: string): number;
  /**
   * How far this country's own leader line has grown, 0 to 1.
   *
   * The chosen country's line is the first thing that happens and the last thing that unhappens,
   * so it runs on the lead-in rather than on the wavefront. Every other country's runs from the
   * moment the network reaches it, over the same duration. With no lead-in configured this is
   * exactly `arrivalOf`, which is what every preset before round v10 did.
   */
  leaderArrivalOf(iso3: string): number;
  /**
   * How lit this country's mark is, 0 to 1. It follows its leader line rather than the network,
   * because the operator's order is that the line reaches the country first and only then does
   * the country light up. With no lead-in this is exactly `arrivalOf`.
   */
  markArrivalOf(iso3: string): number;
  /** Whether this country is the one its wave grew from, so its leader grows the other way. */
  isSpreadOrigin(iso3: string): boolean;
  /**
   * Where this category's wavefront is, 0 to 1, and 1 when no wave covers it. The arc layer draws
   * its segments up to this point; the labels read `arrivalOf` instead, which is this measured
   * against one country's own depth.
   */
  arrivalFrontOf(cat: string): number;
  /** The categories being taken apart right now, whose arcs and marks are still on screen. */
  retreatingCategories(): readonly string[];
  /**
   * Whether this category's network is still being built, so a repeat click on it does nothing.
   * The operator's rule: clicking the same legend word again while the network is growing is
   * ignored, and only once it has finished does it mean "build me another one".
   */
  isBuilding(cat: string): boolean;
  /**
   * Bumped when a wave leaves its lead-in and starts to spread. The arc layer holds the new
   * wavefront ordering back until this changes, because a category has one mesh and the outgoing
   * wave is still using it in its own order.
   */
  spreadGeneration(): number;
  /**
   * Bumped whenever any value actually changed, so a layer that has to rebuild geometry can ask
   * "has this moved since I last looked" rather than "is it moving". The difference matters on
   * the settling frame: a track reaches its target and stops moving in the same tick, so a
   * consumer watching `isMoving` would skip the rebuild that lands the final position.
   */
  revision(): number;
}

export function createEmoSelectionMotion(options: {
  data: EmoData;
  params: EmoViewParams;
}): EmoSelectionMotion {
  let params = options.params;

  const makeTrack = (): Track => ({ from: 0, to: 0, startMs: 0, value: 0 });
  const motions = new Map<string, CategoryMotion>(
    options.data.categories.map((c) => [c.key, { emphasis: makeTrack(), recede: makeTrack() }]),
  );

  let revision = 0;
  let generation = 0;
  let selected: string | null = null;
  let growing: Wave | null = null;
  const retreating: Wave[] = [];
  /** Kept in step with `retreating` so consumers can read it without allocating every frame. */
  let retreatingCats: string[] = [];
  let lastMs = performance.now();

  const leadMs = (): number => Math.max(0, params.selectionLeaderMs);
  const spreadMs = (): number => Math.max(0, params.selectionSpreadMs);
  const windowFraction = (span: number): number =>
    Math.max(MIN_ARRIVAL_WINDOW, params.selectionSpreadWindow) / (span > 0 ? span : 1);

  /**
   * THE STEP IS THE ARC AND THEN THE LINE, IN THAT ORDER. A depth step of the wave is split: the
   * arc crosses in the first `1 - share` of it, and the leader line comes down at the far end
   * during the rest. The next hop leaves at the end of the step, so a country is never still
   * being connected to while its own line is still on its way down.
   *
   * At a share of 0 both of these collapse to `depth / span`, which is where every ramp sat
   * before this existed, so no preset that predates it moves.
   */
  const arcLandsAt = (depth: number, span: number): number =>
    depth <= 0 ? 0 : (depth - 1 + (1 - clampLeaderShare(params.selectionLeaderShare))) / span;
  const leaderEndsAt = (depth: number, span: number): number => (depth <= 0 ? 0 : depth / span);

  const leadOf = (w: Wave): number => clamp01(w.p);
  const frontOf = (w: Wave): number => clamp01(w.p - LEAD_END);

  /**
   * The largest value `read` returns over every wave that covers this country, or 1 when none
   * does.
   *
   * THE MAXIMUM, BECAUSE TWO WAVES CAN COVER THE SAME COUNTRY AND ONE OF THEM IS ALWAYS AT REST.
   * Choosing a second country inside the category already chosen puts a retreating wave and a
   * growing one over the same set. The growing one is held at the end of its lead-in until the
   * retreating one has finished, so its front is 0 for exactly as long as the other has anything
   * left to show, and the maximum is whichever of the two is actually on screen. Taking the first
   * match instead would hand the answer to whichever list was searched first.
   */
  function readWaves(iso3: string, read: (w: Wave, depth: number) => number): number {
    let out = -1;
    const depthIn = (w: Wave): number | undefined => w.arrivals.get(iso3);
    if (growing !== null) {
      const d = depthIn(growing);
      if (d !== undefined) out = Math.max(out, read(growing, d));
    }
    for (const w of retreating) {
      const d = depthIn(w);
      if (d !== undefined) out = Math.max(out, read(w, d));
    }
    return out < 0 ? 1 : out;
  }

  function syncRetreatingCats(): void {
    retreatingCats = retreating.map((w) => w.cat);
  }

  /** Milliseconds this wave still needs to unbuild itself completely, at the current speed. */
  function retreatRemainingMs(w: Wave): number {
    const speed = params.selectionRetractSpeed;
    if (speed <= 0) return 0;
    return (Math.max(0, w.p - LEAD_END) * spreadMs() + clamp01(w.p) * leadMs()) / speed;
  }

  /**
   * Send whatever is growing into retreat, or drop it outright when no retract speed is set.
   * Idempotent, because it is called from both entry points a new selection can arrive through.
   */
  function retire(): void {
    if (growing === null) return;
    if (params.selectionRetractSpeed > 0) {
      growing.to = 0;
      retreating.push(growing);
      syncRetreatingCats();
    }
    growing = null;
  }

  /**
   * Spend `dt` milliseconds moving `w.p` toward `w.to`, at each half's own rate.
   *
   * The loop exists only to cross the boundary at LEAD_END within one frame, which matters when
   * either duration is short or a tab has just been restored. Four passes is more than the two
   * that boundary can ever need.
   */
  function step(w: Wave, dt: number, now: number): void {
    const lead = leadMs();
    const spread = spreadMs();
    const speed = Math.max(1e-6, params.selectionRetractSpeed);
    let left = dt;
    for (let guard = 0; guard < 4 && left > 0; guard++) {
      if (w.to > w.p) {
        if (w.p < LEAD_END) {
          if (lead <= 0) {
            w.p = LEAD_END;
            continue;
          }
          const cost = (LEAD_END - w.p) * lead;
          if (cost > left) {
            w.p += left / lead;
            left = 0;
          } else {
            w.p = LEAD_END;
            left -= cost;
          }
        } else if (now < w.spreadNotBeforeMs) {
          left = 0;
        } else if (w.p < SPREAD_END) {
          if (spread <= 0) {
            w.p = SPREAD_END;
            left = 0;
            continue;
          }
          const cost = (SPREAD_END - w.p) * spread;
          if (cost > left) {
            w.p += left / spread;
            left = 0;
          } else {
            w.p = SPREAD_END;
            left = 0;
          }
        } else {
          left = 0;
        }
      } else if (w.p > LEAD_END) {
        if (spread <= 0) {
          w.p = LEAD_END;
          continue;
        }
        const cost = ((w.p - LEAD_END) * spread) / speed;
        if (cost > left) {
          w.p -= (left * speed) / spread;
          left = 0;
        } else {
          w.p = LEAD_END;
          left -= cost;
        }
      } else if (w.p > 0) {
        if (lead <= 0) {
          w.p = 0;
          left = 0;
          continue;
        }
        const cost = (w.p * lead) / speed;
        if (cost > left) {
          w.p -= (left * speed) / lead;
          left = 0;
        } else {
          w.p = 0;
          left = 0;
        }
      } else {
        left = 0;
      }
    }
  }

  function retarget(track: Track, to: number, now: number): void {
    if (track.to === to) return;
    track.from = track.value;
    track.to = to;
    track.startMs = now;
  }

  return {
    tick(): void {
      const now = performance.now();
      const dt = Math.max(0, now - lastMs);
      lastMs = now;
      const duration = params.selectionMotionMs;
      let changed = false;

      if (growing !== null && growing.p < growing.to) {
        step(growing, dt, now);
        changed = true;
        if (!growing.spreading && growing.p >= LEAD_END) {
          growing.spreading = true;
          generation += 1;
        }
      }
      for (let i = retreating.length - 1; i >= 0; i--) {
        const w = retreating[i]!;
        step(w, dt, now);
        changed = true;
        if (w.p <= 0) {
          retreating.splice(i, 1);
          syncRetreatingCats();
        }
      }

      for (const motion of motions.values()) {
        for (const track of [motion.emphasis, motion.recede]) {
          if (track.value === track.to) continue;
          const t = duration > 0 ? clamp01((now - track.startMs) / duration) : 1;
          const next = track.from + (track.to - track.from) * easeOutCubic(t);
          // Snap the last sliver rather than approaching it forever, so a settled track stops
          // asking every layer to redraw for a difference nothing can see.
          track.value = Math.abs(next - track.to) < SETTLE_EPSILON ? track.to : next;
          changed = true;
        }
      }
      if (changed) revision += 1;
    },
    setParams(next: EmoViewParams): void {
      params = next;
    },
    setSelection(cat: string | null): void {
      if (cat === selected) return;
      selected = cat;
      retire();
      const now = performance.now();
      for (const [key, motion] of motions) {
        retarget(motion.emphasis, key === selected ? 1 : 0, now);
        retarget(motion.recede, selected !== null && key !== selected ? 1 : 0, now);
      }
      revision += 1;
    },
    reset(): void {
      selected = null;
      growing = null;
      retreating.length = 0;
      syncRetreatingCats();
      for (const motion of motions.values()) {
        for (const track of [motion.emphasis, motion.recede]) {
          track.from = 0;
          track.to = 0;
          track.value = 0;
        }
      }
      revision += 1;
    },
    emphasisOf(cat: string): number {
      return motions.get(cat)?.emphasis.value ?? 0;
    },
    recedeOf(cat: string): number {
      return motions.get(cat)?.recede.value ?? 0;
    },
    setSpread(
      cat: string,
      origin: string,
      next: ReadonlyMap<string, number>,
      span: number,
    ): void {
      retire();
      const now = performance.now();
      // A category owns one arc mesh, so a same-category wave still unbuilding itself has to
      // empty that mesh before this one may start filling it again.
      let notBefore = now;
      for (const w of retreating) {
        if (w.cat !== cat) continue;
        notBefore = Math.max(notBefore, now + retreatRemainingMs(w));
      }
      growing = {
        cat,
        origin,
        arrivals: next,
        span: span > 0 ? span : 1,
        p: 0,
        to: SPREAD_END,
        spreadNotBeforeMs: notBefore,
        spreading: false,
      };
      revision += 1;
    },
    arrivalFrontOf(cat: string): number {
      let front = -1;
      if (growing !== null && growing.cat === cat) front = Math.max(front, frontOf(growing));
      for (const w of retreating) {
        if (w.cat === cat) front = Math.max(front, frontOf(w));
      }
      return front < 0 ? 1 : front;
    },
    arrivalOf(iso3: string): number {
      // The word lights as the connection reaches it, which is before its own line comes down
      // from it. The line has to have something to leave from.
      return readWaves(iso3, (w, depth) => {
        const at = arcLandsAt(depth, w.span);
        return clampedRamp(
          frontOf(w),
          at,
          at + windowFraction(w.span),
          params.selectionSpreadEase,
        );
      });
    },
    leaderArrivalOf(iso3: string): number {
      return readWaves(iso3, (w, depth) => {
        // The chosen country's own line is the opening gesture and runs on the lead-in clock.
        if (iso3 === w.origin) return leadOf(w);
        const from = arcLandsAt(depth, w.span);
        const to = leaderEndsAt(depth, w.span);
        // With no share reserved there is no separate descent, and this is the wavefront itself,
        // which is exactly what every preset before round v10 drew.
        if (to - from <= 0) {
          return clampedRamp(
            frontOf(w),
            from,
            from + windowFraction(w.span),
            params.selectionSpreadEase,
          );
        }
        return clampedRamp(frontOf(w), from, to, params.selectionSpreadEase);
      });
    },
    markArrivalOf(iso3: string): number {
      // The country lights once its own line has landed on it, which is the end of its step.
      return readWaves(iso3, (w, depth) => {
        const at = leaderEndsAt(depth, w.span);
        return clampedRamp(
          frontOf(w),
          at,
          at + windowFraction(w.span),
          params.selectionSpreadEase,
        );
      });
    },
    isSpreadOrigin(iso3: string): boolean {
      if (growing !== null && growing.origin === iso3) return true;
      for (const w of retreating) if (w.origin === iso3) return true;
      return false;
    },
    retreatingCategories(): readonly string[] {
      return retreatingCats;
    },
    isBuilding(cat: string): boolean {
      return growing !== null && growing.cat === cat && growing.p < SPREAD_END;
    },
    spreadGeneration(): number {
      return generation;
    },
    revision(): number {
      return revision;
    },
  };
}
