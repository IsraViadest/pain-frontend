/**
 * A list of the 14 pain categories down the left of the screen, each one clickable.
 *
 * The globe answers "what does this country feel" one country at a time. This answers the other
 * question, "where is this feeling", by letting a category be chosen directly rather than by
 * hunting for a country that happens to carry it. A click stands in for a click on a country: one
 * member of that category is picked at random and selected, so the network, the mark, the sink and
 * the spread all behave exactly as they do from the globe. There is no second selection path.
 *
 * IT IS CHROME, NOT PART OF THE OVERLAY. The labels take no pointer events, so that a wheel or a
 * drag beginning over one still reaches the globe; this does take them, like the views panel, and
 * so a wheel over the strip does not zoom. The alternative was a second document-level hit test
 * competing with the label layer's on registration order, which is a worse trade than losing zoom
 * over 14 words. `overflow: hidden` makes the box a scroll container so `overscroll-behavior`
 * applies to it, which is what stops that wheel rubber-banding the page instead.
 *
 * THE ORDER IS THE OPERATOR'S, AND IT IS COMPUTED RATHER THAN WRITTEN DOWN. Long words at the top
 * and the bottom, short ones in the middle, because the globe is widest across its equator and the
 * strip should not crowd it there. See `legendOrder`.
 *
 * IT SPANS THE CHROME RATHER THAN CENTRING ITSELF. The strip fills the gap between the sound
 * toggle at the end of the title block and the about and data-sources buttons at the bottom left,
 * which is the space the page leaves free on that side. Those two are measured rather than
 * recomputed from their own `clamp()` font sizes, because a second copy of that arithmetic is a
 * second thing to keep in step; a ResizeObserver on both also covers the chrome mounting after
 * this does, since their size goes from nothing to something.
 *
 * The bounds are written as custom properties and not as `top` and `bottom`. The narrow layout
 * replaces the whole arrangement with a wrapped box, and an inline `top` would outrank the rule
 * that does it.
 */
import type { EmoData } from "./emoData";
import type { EmoViewParams } from "./viewParams";
import { ensureCountryCentroidsLoaded, getCountryCentroid } from "../api/countryCentroids";
import { mulberry32 } from "./rng";

type EmoCategoryRecord = EmoData["categories"][number];

/**
 * The workspace default seed. The roll is deterministic from a cold load, so the first click on a
 * given category always lands on the same country and a screenshot of it reproduces; repeated
 * clicks walk the sequence and give the different member each time that the operator asked for.
 */
const LEGEND_SEED = 43;

/**
 * The chrome the legend fits between, and the clearance it keeps from it.
 *
 * Two things sit along the bottom and the lower of them wins, because they swap places between
 * the two layouts: the about and data-sources buttons are the neighbours on a wide screen, and on
 * a narrow one they slide off to the left and the share pill, which is much wider there, is what
 * the box would otherwise sit on top of.
 */
const CHROME_ABOVE = "#ui-title";
const CHROME_BELOW = ["#ui-bottom-left", "#ui-share-pain"];
const CHROME_GAP_PX = 18;

/**
 * Space kept clear above the first word and below the last, as a multiple of the space between
 * two words. The operator asked for at least twice, so the block reads as one group rather than
 * as a list that runs into the chrome at both ends.
 */
const END_PAD_IN_GAPS = 2;

/**
 * Bounds on the space between two words, as a multiple of the legend's own font size.
 *
 * The floor is the point of the exercise: on a short screen the words stop spreading apart to
 * fill the height and simply stop, rather than being packed until they touch. The ceiling keeps
 * a very tall window from turning the strip into fourteen unrelated words.
 */
const MIN_GAP_EM = 0.3;
const MAX_GAP_EM = 3;

/**
 * Longest first, laid alternately at the top and the bottom of the list, so the lengths fall to a
 * minimum in the middle and rise again: long, medium, short, medium, long.
 *
 * Computed from the data rather than hardcoded, so that if the category labels ever change the
 * shape survives. On the current 14 it puts Displacement first and Eco-anxiety second, which is
 * what the operator asked for; if that ever stops being true, the labels have changed and their
 * preference needs asking again rather than silently moving.
 */
function legendOrder(categories: readonly EmoCategoryRecord[]): EmoCategoryRecord[] {
  const byLength = [...categories].sort(
    (a, b) => b.label.length - a.label.length || a.key.localeCompare(b.key),
  );
  const out: EmoCategoryRecord[] = new Array<EmoCategoryRecord>(byLength.length);
  let top = 0;
  let bottom = byLength.length - 1;
  byLength.forEach((c, i) => {
    out[i % 2 === 0 ? top++ : bottom--] = c;
  });
  return out;
}

export interface EmoLegendLayer {
  setParams(next: EmoViewParams): void;
  /** Whether the emotional views own the globe right now, independent of the `legend` flag. */
  setVisible(visible: boolean): void;
  /** Mirror the selection: the chosen word stays white, the rest step back like the labels. */
  setSelectedCategory(cat: string | null): void;
  destroy(): void;
}

export async function createEmoLegend(options: {
  host: HTMLElement;
  data: EmoData;
  params: EmoViewParams;
  /** Fired with a country drawn at random from the category that was clicked. */
  onPick: (iso3: string) => void;
  /**
   * Whether this category's network is still being built, in which case the click does nothing.
   *
   * ASKED BEFORE THE ROLL, NOT AFTER IT. The pick walks one seeded sequence, so a blocked click
   * that had already drawn a number would leave the sequence in a different place and the run of
   * countries a category gives would stop being reproducible from a cold load.
   */
  isBusy?: (cat: string) => boolean;
}): Promise<EmoLegendLayer> {
  const { host, data } = options;
  let params = options.params;

  await ensureCountryCentroidsLoaded();

  // Only countries the globe can actually select. A country with no centroid has no label and no
  // arcs, so picking one would look like a click that did nothing. This is the same condition the
  // label layer uses to decide what to draw.
  const members = new Map<string, string[]>();
  for (const [iso3, country] of Object.entries(data.countries)) {
    if (!getCountryCentroid(iso3)) continue;
    const list = members.get(country.cat) ?? [];
    list.push(iso3);
    members.set(country.cat, list);
  }

  const random = mulberry32(LEGEND_SEED);
  const items = new Map<string, HTMLButtonElement>();

  for (const category of legendOrder(data.categories)) {
    const el = document.createElement("button");
    el.type = "button";
    // The same font as a Latin label, by sharing its class rather than by copying the stack.
    el.className = "emo-legend__item emo-sc-Latn";
    el.dataset.cat = category.key;
    el.textContent = category.label;
    host.appendChild(el);
    items.set(category.key, el);
  }

  let selectedCat: string | null = null;

  /**
   * Resting, stepped back, or chosen. The chosen word is white and nothing else about it changes:
   * no larger, no bolder, because the legend is a key and a key that moves is hard to read.
   */
  function paint(): void {
    for (const [key, el] of items) {
      const chosen = key === selectedCat;
      el.classList.toggle("emo-legend__item--chosen", chosen);
      const opacity = chosen
        ? 1
        : params.legendOpacity * (selectedCat === null ? 1 : params.selectionDim);
      // The property rather than `opacity` itself, so the stylesheet's :hover rule still wins.
      el.style.setProperty("--emo-legend-alpha", opacity.toFixed(3));
    }
  }

  function applyParams(): void {
    host.style.setProperty("--emo-legend-font-px", `${params.legendFontPx}px`);
    paint();
    // The size decides both the words' own height and the bounds on the gap, so the spacing has
    // to be solved again rather than left at the answer for the previous size.
    syncBounds();
  }

  const onClick = (ev: MouseEvent): void => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>(".emo-legend__item");
    const cat = el?.dataset.cat;
    if (cat === undefined) return;
    const list = members.get(cat);
    if (!list || list.length === 0) return;
    // Clicking the category that is still arriving does nothing at all. Only once its network has
    // finished does the same word mean "show me another one of these". Tested before the roll.
    if (options.isBusy?.(cat) === true) return;
    // Always a fresh pick, never a toggle. Clicking a category again means "show me another one
    // of these", and the roll can land on the country already selected, where a toggle would read
    // the gesture as "clear".
    options.onPick(list[Math.floor(random() * list.length)]!);
  };
  host.addEventListener("click", onClick);

  let layerVisible = true;
  function syncVisibility(): void {
    const wasHidden = host.hidden;
    host.hidden = !(layerVisible && params.legend === "on");
    // A hidden host gives its words no height, so the spacing cannot be solved while it is off
    // screen and has to be solved again the moment it comes back. The observer below also
    // catches this; both are here because between them they cover the two ways it can happen,
    // and solving the same numbers twice costs nothing.
    if (wasHidden && !host.hidden) syncBounds();
  }

  /** Fit the legend between the sound toggle and whatever sits lowest along the bottom. */
  function syncBounds(): void {
    const above = document.querySelector(CHROME_ABOVE);
    if (above === null) return;
    const top = above.getBoundingClientRect().bottom;
    let bottom = Number.POSITIVE_INFINITY;
    for (const selector of CHROME_BELOW) {
      const el = document.querySelector(selector);
      if (el === null) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) bottom = Math.min(bottom, rect.top);
    }
    // Either can read 0 before the chrome has mounted, which would collapse the legend onto
    // itself. The stylesheet's own fallback is better than a measurement of something that is
    // not there yet.
    if (top <= 0 || !Number.isFinite(bottom) || bottom <= top) return;
    host.style.setProperty("--emo-legend-top", `${Math.round(top + CHROME_GAP_PX)}px`);
    host.style.setProperty(
      "--emo-legend-bottom",
      `${Math.round(window.innerHeight - bottom + CHROME_GAP_PX)}px`,
    );

    // Spread the words through that height, keeping twice a gap clear at each end.
    //
    //   available = words + (n - 1) gaps + 2 * END_PAD_IN_GAPS gaps
    //
    // solved for the gap, then held between a floor and a ceiling. Below the floor the block
    // simply overflows the box, which `overflow: hidden` cuts: words that stop arriving is a
    // better failure than words that sit on top of each other.
    const items = [...host.children];
    const first = items[0];
    if (first === undefined) return;
    const wordHeight = first.getBoundingClientRect().height;
    if (wordHeight <= 0) return;
    const available = bottom - top - 2 * CHROME_GAP_PX;
    const slack = available - items.length * wordHeight;
    const raw = slack / (items.length - 1 + 2 * END_PAD_IN_GAPS);
    const gap = Math.min(
      MAX_GAP_EM * params.legendFontPx,
      Math.max(MIN_GAP_EM * params.legendFontPx, raw),
    );
    host.style.setProperty("--emo-legend-gap", `${gap.toFixed(1)}px`);
    host.style.setProperty("--emo-legend-pad", `${(gap * END_PAD_IN_GAPS).toFixed(1)}px`);
  }

  const bounds = new ResizeObserver(syncBounds);
  for (const selector of [CHROME_ABOVE, ...CHROME_BELOW]) {
    const el = document.querySelector(selector);
    if (el !== null) bounds.observe(el);
  }
  // The legend's own box too, which is how a font that arrives after first paint, or the strip
  // becoming visible at all, gets the spacing solved with real word heights rather than with the
  // zero a hidden element reports. Writing the gap cannot resize this box on a wide screen, since
  // its height is fixed by the two bounds above, so there is no loop to fall into.
  bounds.observe(host);
  window.addEventListener("resize", syncBounds);

  applyParams();
  syncVisibility();
  syncBounds();

  return {
    setParams(next: EmoViewParams): void {
      params = next;
      applyParams();
      syncVisibility();
    },
    setVisible(visible: boolean): void {
      layerVisible = visible;
      syncVisibility();
    },
    setSelectedCategory(cat: string | null): void {
      if (cat === selectedCat) return;
      selectedCat = cat;
      paint();
    },
    destroy(): void {
      bounds.disconnect();
      window.removeEventListener("resize", syncBounds);
      host.removeEventListener("click", onClick);
      for (const el of items.values()) el.remove();
      items.clear();
    },
  };
}
