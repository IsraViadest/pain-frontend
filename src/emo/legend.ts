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
 * ONLY THE CHROME THAT IS ON SCREEN COUNTS. A narrow screen slides the about and data-sources
 * buttons off to the left with a transform, which moves their box without hiding it, so measuring
 * them held the legend 146 px above the bottom of a screen where nothing was in the way. Anything
 * whose box lies outside the viewport horizontally is skipped. The one case this does not cover
 * is the mobile menu sliding those buttons back in: a transform changes no box, so no observer
 * fires, and the legend keeps the bounds it had until something else asks for them.
 *
 * The bounds are written as custom properties and not as `top` and `bottom`. The narrow layout
 * replaces the whole arrangement with a wrapped box, and an inline `top` would outrank the rule
 * that does it.
 *
 * THE NARROW LAYOUT IS AN L, AND IT IS TWO BOXES BECAUSE A FLOAT CANNOT BE ONE. The operator asked
 * for the words to sit along the bottom edge, level with the share pill, with a few short ones
 * beside the pill and the rest in a full-width block above it, and for the dark background to be
 * behind the words only and never behind the pill. Text flowing round a notch is what a float is
 * for, but a float attaches to the top of the line box it is declared in and the notch here is at
 * the bottom right, so no float can cut it. Two rows can: a full-width one and a narrower one
 * beside the pill, in a bottom-anchored column. Each carries its own background, and together
 * they are the L.
 *
 * The rows are `display: contents` in the wide layout, so the vertical strip is laid out exactly
 * as it was before they existed: the buttons are still the host's own flex children. Which row a
 * word belongs to is therefore a narrow-layout question only, and the wide layout puts all of
 * them back in order.
 *
 * THE TWO ROWS SHARE ONE RHYTHM, WHICH IS WHAT MAKES THEM READ AS ONE FIELD OF WORDS. Two boxes
 * are the only structure that can cut this notch, but two boxes are not what the operator should
 * see: the block should look like plain text with a rectangular area it may not enter. So the
 * space between the last line of one row and the first line of the other is the same number as
 * the space between two lines of either, and neither row carries vertical padding, because a row
 * that did would add it at exactly that join. Measured at 430 by 900 it was 22 px inside a row
 * and 54 px across the join. The breathing room round the words is drawn instead of reserved:
 * each row's background is a pseudo-element that reaches beyond it, and the two reach exactly as
 * far as each other so the L is continuous with neither a seam nor a doubled alpha.
 *
 * THE CORNER IS A WHOLE NUMBER OF LINES, ROUNDED UP TO COVER THE PILL. Holding it to exactly the
 * pill's height cost it a line, because its own padding came out of that height: 70 px of pill
 * less 16 of padding left room for two lines of 22 where three fit. Rounding up rather than down
 * is also what keeps the join at or above the pill's top edge, so the full-width background above
 * cannot reach behind the pill; that is now true by construction rather than by measurement.
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
const CHROME_SHARE = "#ui-share-pain";
const CHROME_GAP_PX = 18;

/**
 * Which layout is in force, asked of the stylesheet rather than of `matchMedia`.
 *
 * The breakpoint belongs to the CSS, which is where both layouts are written, and a second copy
 * of the number here is a second thing to keep in step. The media query sets this custom property
 * and this reads it back, so there is exactly one place the width lives.
 */
const NARROW_FLAG = "--emo-legend-narrow";

/** Clearance kept between the words and the share pill they sit beside. */
const CORNER_GAP_PX = 12;

/**
 * Widest the plain narrow box is allowed to be, and the width below which it stops being one.
 *
 * Above the first number the words sit in a single box at the bottom left, clear of the share
 * pill, which is round v10's box moved down. Below the second there is not enough room beside the
 * pill for a box at all and the strip becomes an L: a few short words beside the pill and the
 * rest in a full-width block above it.
 */
const NARROW_BOX_MAX_W = 250;
const NARROW_BOX_MIN_W = 200;

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
   * Fired instead of `onPick` when `legendRepeatClick` is `clear` and the word clicked is the one
   * already selected. Separate from `onPick` because putting a selection away is not a selection
   * of anything, so there is no country to name.
   */
  onClear: () => void;
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

  // The two halves of the L. `display: contents` in the wide layout, so they cost that layout
  // nothing at all. The full-width one comes first because the column is read top to bottom.
  const wideRow = document.createElement("div");
  wideRow.className = "emo-legend__row emo-legend__row--wide";
  const cornerRow = document.createElement("div");
  cornerRow.className = "emo-legend__row emo-legend__row--corner";
  host.append(wideRow, cornerRow);

  /** Every word, in the operator's long-medium-short-medium-long order. */
  const ordered: HTMLButtonElement[] = [];
  for (const category of legendOrder(data.categories)) {
    const el = document.createElement("button");
    el.type = "button";
    // The same font as a Latin label, by sharing its class rather than by copying the stack.
    el.className = "emo-legend__item emo-sc-Latn";
    el.dataset.cat = category.key;
    el.textContent = category.label;
    wideRow.appendChild(el);
    ordered.push(el);
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
    // Clicking the category that is still arriving does nothing at all, whichever way the repeat
    // click is set: a half-built network is neither something to reroll nor something to put away
    // while it is still arriving. Tested before the roll, so a blocked click does not walk the
    // seeded sequence.
    if (options.isBusy?.(cat) === true) return;
    // A second click on the word already selected is the only case the two settings differ in.
    // They cannot be combined: a roll can land on the country already selected, so a gesture
    // meaning both would read "show me another one of these" as "clear" whenever it did.
    if (params.legendRepeatClick === "clear" && cat === selectedCat) {
      options.onClear();
      return;
    }
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

  /**
   * Move the words into the two rows, and say whether anything actually moved.
   *
   * Guarded because the observer below watches the host, and in the narrow layout the host's
   * height is its content: a split that rewrote the DOM every time it was asked would keep
   * resizing the thing that asked. A no-op second pass is what ends that.
   */
  // Null rather than "", so the first call always runs: an empty corner produces the key "" and
  // would otherwise be indistinguishable from "nothing has happened yet".
  let splitKey: string | null = null;
  function setSplit(corner: readonly HTMLButtonElement[]): void {
    const key = corner.map((el) => el.dataset.cat).join(",");
    if (key === splitKey) return;
    splitKey = key;
    const inCorner = new Set(corner);
    wideRow.append(...ordered.filter((el) => !inCorner.has(el)));
    cornerRow.append(...corner);
    // Which row is the only one, said in a class rather than asked of the stylesheet. A row that
    // is alone is a plain box and rounds on all four corners; half an L rounds on two. The CSS
    // for that is one `+` away for the corner row and needs `:has()` for the wide one, and the
    // operator's browser is not known (open question 22), so both are told rather than deduced.
    wideRow.classList.toggle("emo-legend__row--only", cornerRow.children.length === 0);
    cornerRow.classList.toggle("emo-legend__row--only", wideRow.children.length === 0);
  }

  /**
   * The shortest words that fit beside the share pill, in as many lines as its height allows.
   *
   * Shortest first, which is both what the operator asked for ("a few of the shorter elements")
   * and what makes the greedy fill correct: once a word will not go on a fresh line, every word
   * after it is wider and will not either.
   */
  function packCorner(width: number, lines: number, gapX: number, padX: number): HTMLButtonElement[] {
    const inner = width - padX;
    const byWidth = [...ordered].sort(
      (a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width,
    );
    const out: HTMLButtonElement[] = [];
    let line = 1;
    let used = 0;
    for (const el of byWidth) {
      const w = el.getBoundingClientRect().width;
      const need = used === 0 ? w : used + gapX + w;
      if (need <= inner) {
        used = need;
        out.push(el);
        continue;
      }
      if (line >= lines || w > inner) break;
      line += 1;
      used = w;
      out.push(el);
    }
    return out;
  }

  /**
   * The bottom-left arrangement: level with the share pill, and never underneath it.
   *
   * One box while there is room for one beside the pill, an L when there is not. The pill is
   * measured rather than assumed, so its own 20 px offset from the corner is what the legend
   * takes as its bottom edge and the two agree by construction.
   */
  function syncNarrow(): void {
    const pill = document.querySelector(CHROME_SHARE)?.getBoundingClientRect();
    const hasPill = pill !== undefined && pill.height > 0 && pill.width > 0;
    const bottom = hasPill ? Math.max(0, window.innerHeight - pill.bottom) : CHROME_GAP_PX;
    host.style.setProperty("--emo-legend-bottom", `${Math.round(bottom)}px`);
    const header = document.querySelector(CHROME_ABOVE);
    host.style.maxHeight = window.innerHeight <= 500 && header
      ? `${Math.max(0, window.innerHeight - bottom - header.getBoundingClientRect().bottom - CHROME_GAP_PX)}px`
      : "";
    if (window.innerHeight <= 500 && window.innerWidth <= 744 && window.innerWidth > window.innerHeight) {
      host.style.setProperty("--emo-legend-corner-w", "100%");
      host.style.setProperty("--emo-legend-corner-h", "0px");
      setSplit(ordered);
      return;
    }

    const hostRect = host.getBoundingClientRect();
    const style = getComputedStyle(cornerRow);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const gapX = parseFloat(style.columnGap) || 0;
    const gapY = parseFloat(style.rowGap) || 0;
    // The host owns the vertical inset now, because a row that owned it would put it between the
    // two rows as well and that is what broke the rhythm.
    const insetY = parseFloat(getComputedStyle(host).paddingBottom) || 0;
    const wordHeight = ordered[0]?.getBoundingClientRect().height ?? 0;
    if (wordHeight <= 0 || hostRect.width <= 0) return;

    const beside = hasPill ? pill.left - hostRect.left - CORNER_GAP_PX : hostRect.width;
    if (beside >= NARROW_BOX_MAX_W || !hasPill) {
      // Room for the whole thing beside the pill. One box, which is round v10's, moved down to
      // the bottom edge.
      host.style.setProperty("--emo-legend-corner-w", `${Math.round(Math.min(beside, NARROW_BOX_MAX_W))}px`);
      host.style.setProperty("--emo-legend-corner-h", "0px");
      setSplit(ordered);
      return;
    }
    // AS MANY WHOLE LINES AS IT TAKES TO COVER THE PILL, ROUNDED UP, NOT AS MANY AS FIT INSIDE IT.
    //
    // The corner used to be held to exactly the pill's height and its own 8 px of padding was
    // taken out of that, which cost it a line: 70 px of pill minus 16 of padding left room for
    // two lines of 22 where three fit. It now spans a whole number of lines at the block's one
    // rhythm, chosen so that the band is never shorter than the pill, which is what keeps the
    // join at or above the pill's top edge and so keeps the full-width background clear of it.
    // The `+ gapY` is the trailing gap the last line does not have, so the comparison is between
    // heights of the same kind.
    const pitch = wordHeight + gapY;
    const lines = Math.max(1, Math.ceil((pill.height - insetY + gapY) / pitch));
    const band = lines * pitch - gapY;
    const width = Math.max(0, beside);
    const corner = width >= NARROW_BOX_MIN_W / 4 ? packCorner(width, lines, gapX, padX) : [];
    host.style.setProperty("--emo-legend-corner-w", `${Math.round(width)}px`);
    host.style.setProperty(
      "--emo-legend-corner-h",
      corner.length === 0 ? "0px" : `${band.toFixed(1)}px`,
    );
    setSplit(corner);
  }

  /** Fit the legend between the sound toggle and whatever sits lowest along the bottom. */
  function syncBounds(): void {
    if (getComputedStyle(host).getPropertyValue(NARROW_FLAG).trim() === "1") {
      syncNarrow();
      return;
    }
    // Back to one column, in the operator's order, whatever the narrow layout last did to it.
    host.style.maxHeight = "";
    setSplit([]);
    const above = document.querySelector(CHROME_ABOVE);
    if (above === null) return;
    const top = above.getBoundingClientRect().bottom;
    let bottom = Number.POSITIVE_INFINITY;
    for (const selector of CHROME_BELOW) {
      const el = document.querySelector(selector);
      if (el === null) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height <= 0) continue;
      // A BOX CAN BE HONEST AND STILL BE SOMEWHERE NOBODY CAN SEE IT. On a narrow screen the page
      // slides #ui-bottom-left away with translateX(-200%) rather than hiding it, so it still has
      // a height and still reports a top. The legend was measuring an element at left -296 and
      // stopping 146 px above the bottom of the screen for no reason the operator could see,
      // which is what "it looks like it is floating too high" was.
      if (rect.right <= 0 || rect.left >= window.innerWidth) continue;
      bottom = Math.min(bottom, rect.top);
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
    const first = ordered[0];
    if (first === undefined) return;
    const wordHeight = first.getBoundingClientRect().height;
    if (wordHeight <= 0) return;
    const available = bottom - top - 2 * CHROME_GAP_PX;
    const slack = available - ordered.length * wordHeight;
    const raw = slack / (ordered.length - 1 + 2 * END_PAD_IN_GAPS);
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
      wideRow.remove();
      cornerRow.remove();
    },
  };
}
