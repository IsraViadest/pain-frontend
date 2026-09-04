/**
 * How a pain category moves when it is chosen, and when it stops being chosen.
 *
 * WHY THIS IS A MODULE AND NOT A NUMBER. The obvious implementation of an eased selection is one
 * scalar per layer, and it cannot express the case it meets most often: click one category, then
 * click a second before the first has settled, and the first must fall while the second rises. So
 * the state is per category, and it is here rather than in any one layer because three of them
 * need the same answer at the same instant. The labels, the arcs and the leader lines reading
 * three private copies of one curve is exactly how they would drift apart, which is the reason
 * layout.ts exists as well.
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
 */
import type { EmoData } from "./emoData";
import type { EmoViewParams } from "./viewParams";

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);

/** Below this a value counts as having arrived, so a track stops asking to be redrawn. */
const SETTLE_EPSILON = 1e-4;

/**
 * How long one country takes to come up once the wave reaches it, as a share of the whole sweep.
 *
 * A constant rather than a parameter: it trades the crispness of the wavefront against a country
 * blinking on, and no view compares two values of it, so there would be nothing to look at. At
 * a five-step sweep this is about a tenth of the total, which is long enough not to blink and
 * short enough that the front still reads as a front.
 */
const ARRIVAL_WINDOW = 0.5;

const clampedRamp = (v: number, from: number, to: number): number => {
  const t = clamp01((v - from) / (to - from || 1));
  return t * t * (3 - 2 * t);
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

export interface EmoSelectionMotion {
  /**
   * Advance every track to the current instant. main.ts calls this once per frame, before any
   * layer reads it, so the three layers cannot see three different moments of the same animation.
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
   * Start the wavefront. `arrivals` is each country's depth in steps and `span` the total, both
   * from planSpread; the arc layer supplies them because it is the layer that owns the graph.
   *
   * Called after setSelection, which clears any previous wave. A selection with no network to
   * spread through therefore never gets one, and `arrivalOf` answers 1 for every country, which
   * is the behaviour of every preset that predates this.
   *
   * THE FALLBACK ASSUMES THE TWO LAYERS AGREE ON WHO EXISTS. `arrivalOf` also answers 1 for a
   * country the map does not mention, which is right for a view with no wave and wrong for a
   * country that should have been in one: it would light at once while its neighbours waited.
   * The arc layer builds this map from the countries that have a centroid, and the label layer
   * draws exactly that same set, so today they cannot disagree. Nothing enforces it. If either
   * layer ever gains or loses a country the other keeps, this is where it will show.
   */
  setSpread(arrivals: ReadonlyMap<string, number>, span: number): void;
  /**
   * How far this country has come up, 0 before the wave reaches it and 1 once it has passed.
   * 1 everywhere when no wave is running.
   */
  arrivalOf(iso3: string): number;
  /**
   * Where the wavefront is, 0 to 1, and 1 when no wave is running. The arc layer draws its
   * segments up to this point; the labels read `arrivalOf` instead, which is this measured
   * against one country's own depth.
   */
  arrivalFront(): number;
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
  let selected: string | null = null;
  /** Depth in steps per country, or null when no wave is running. */
  let arrivals: ReadonlyMap<string, number> | null = null;
  let spreadSpan = 1;
  let spreadStartMs = 0;
  /** Normalised position of the wavefront, 0 to 1. Recomputed once per tick, never per label. */
  let spreadFront = 1;

  function retarget(track: Track, to: number, now: number): void {
    if (track.to === to) return;
    track.from = track.value;
    track.to = to;
    track.startMs = now;
  }

  return {
    tick(): void {
      const now = performance.now();
      const duration = params.selectionMotionMs;
      let changed = false;
      if (arrivals !== null) {
        const front =
          params.selectionSpreadMs > 0
            ? clamp01((now - spreadStartMs) / params.selectionSpreadMs)
            : 1;
        if (front !== spreadFront) {
          spreadFront = front;
          changed = true;
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
      // A new selection has no wave until the arc layer supplies one, and a cleared selection
      // never gets one. Either way every country reads as arrived, which is what a view with no
      // network, or no spread duration, has always looked like.
      arrivals = null;
      spreadFront = 1;
      const now = performance.now();
      for (const [key, motion] of motions) {
        retarget(motion.emphasis, key === selected ? 1 : 0, now);
        retarget(motion.recede, selected !== null && key !== selected ? 1 : 0, now);
      }
      revision += 1;
    },
    reset(): void {
      selected = null;
      arrivals = null;
      spreadFront = 1;
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
    setSpread(next: ReadonlyMap<string, number>, span: number): void {
      arrivals = next;
      spreadSpan = span > 0 ? span : 1;
      spreadStartMs = performance.now();
      spreadFront = params.selectionSpreadMs > 0 ? 0 : 1;
      revision += 1;
    },
    arrivalFront(): number {
      return arrivals === null ? 1 : spreadFront;
    },
    arrivalOf(iso3: string): number {
      if (arrivals === null) return 1;
      const depth = arrivals.get(iso3);
      if (depth === undefined) return 1;
      const at = depth / spreadSpan;
      return clampedRamp(spreadFront, at, at + ARRIVAL_WINDOW / spreadSpan);
    },
    revision(): number {
      return revision;
    },
  };
}
