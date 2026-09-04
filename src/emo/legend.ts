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
  }

  const onClick = (ev: MouseEvent): void => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>(".emo-legend__item");
    const cat = el?.dataset.cat;
    if (cat === undefined) return;
    const list = members.get(cat);
    if (!list || list.length === 0) return;
    // Always a fresh pick, never a toggle. Clicking a category again means "show me another one
    // of these", and the roll can land on the country already selected, where a toggle would read
    // the gesture as "clear".
    options.onPick(list[Math.floor(random() * list.length)]!);
  };
  host.addEventListener("click", onClick);

  let layerVisible = true;
  function syncVisibility(): void {
    host.hidden = !(layerVisible && params.legend === "on");
  }

  applyParams();
  syncVisibility();

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
      host.removeEventListener("click", onClick);
      for (const el of items.values()) el.remove();
      items.clear();
    },
  };
}
