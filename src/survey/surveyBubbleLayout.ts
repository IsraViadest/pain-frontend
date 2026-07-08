import {
  SURVEY_BUBBLE_GAP_PX,
  SURVEY_FIELD_INSET_FRAC,
  SURVEY_LAYOUT_MAX_ITERATIONS,
  hashSurveyString,
} from "./surveyData";

type LayoutBubble = {
  anchor: HTMLElement;
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
};

type FieldBounds = {
  width: number;
  height: number;
  insetX: number;
  insetY: number;
};

function readFieldBounds(field: HTMLElement): FieldBounds | null {
  const rect = field.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    width: rect.width,
    height: rect.height,
    insetX: rect.width * SURVEY_FIELD_INSET_FRAC,
    insetY: rect.height * SURVEY_FIELD_INSET_FRAC,
  };
}

function measureBubbles(
  field: HTMLElement,
  anchors: readonly HTMLElement[],
): LayoutBubble[] {
  const fieldRect = field.getBoundingClientRect();
  return anchors.map((anchor) => {
    const rect = anchor.getBoundingClientRect();
    return {
      anchor,
      cx: rect.left + rect.width / 2 - fieldRect.left,
      cy: rect.top + rect.height / 2 - fieldRect.top,
      halfW: rect.width / 2,
      halfH: rect.height / 2,
    };
  });
}

function clampBubbleToField(bubble: LayoutBubble, bounds: FieldBounds): void {
  const minX = bounds.insetX + bubble.halfW;
  const maxX = bounds.width - bounds.insetX - bubble.halfW;
  const minY = bounds.insetY + bubble.halfH;
  const maxY = bounds.height - bounds.insetY - bubble.halfH;

  if (minX <= maxX) {
    bubble.cx = Math.min(maxX, Math.max(minX, bubble.cx));
  } else {
    bubble.cx = bounds.width / 2;
  }

  if (minY <= maxY) {
    bubble.cy = Math.min(maxY, Math.max(minY, bubble.cy));
  } else {
    bubble.cy = bounds.height / 2;
  }
}

function rectsOverlap(
  a: LayoutBubble,
  b: LayoutBubble,
  gap: number,
): boolean {
  return (
    Math.abs(a.cx - b.cx) < a.halfW + b.halfW + gap &&
    Math.abs(a.cy - b.cy) < a.halfH + b.halfH + gap
  );
}

function tieBreakSign(word: string | undefined): number {
  return hashSurveyString(word ?? "") % 2 === 0 ? 1 : -1;
}

/** Push one overlapping pair apart along the smaller penetration axis. */
function separatePair(
  a: LayoutBubble,
  b: LayoutBubble,
  gap: number,
  bounds: FieldBounds,
): boolean {
  if (!rectsOverlap(a, b, gap)) return false;

  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const overlapX = a.halfW + b.halfW + gap - Math.abs(dx);
  const overlapY = a.halfH + b.halfH + gap - Math.abs(dy);

  if (overlapX <= 0 || overlapY <= 0) return false;

  if (overlapX < overlapY) {
    const shift = overlapX / 2;
    const sign =
      dx === 0
        ? tieBreakSign(a.anchor.dataset.word)
        : Math.sign(dx);
    a.cx -= shift * sign;
    b.cx += shift * sign;
  } else {
    const shift = overlapY / 2;
    const sign =
      dy === 0
        ? tieBreakSign(b.anchor.dataset.word)
        : Math.sign(dy);
    a.cy -= shift * sign;
    b.cy += shift * sign;
  }

  clampBubbleToField(a, bounds);
  clampBubbleToField(b, bounds);
  return true;
}

function runSeparationPass(
  bubbles: LayoutBubble[],
  bounds: FieldBounds,
): boolean {
  let anyMoved = false;
  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      if (separatePair(bubbles[i]!, bubbles[j]!, SURVEY_BUBBLE_GAP_PX, bounds)) {
        anyMoved = true;
      }
    }
  }
  return anyMoved;
}

function hasAnyOverlap(bubbles: readonly LayoutBubble[]): boolean {
  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      if (rectsOverlap(bubbles[i]!, bubbles[j]!, SURVEY_BUBBLE_GAP_PX)) {
        return true;
      }
    }
  }
  return false;
}

function applyBubblePositions(
  bubbles: readonly LayoutBubble[],
  bounds: FieldBounds,
): void {
  for (const bubble of bubbles) {
    const leftPct = (bubble.cx / bounds.width) * 100;
    const topPct = (bubble.cy / bounds.height) * 100;
    bubble.anchor.style.left = `${leftPct}%`;
    bubble.anchor.style.top = `${topPct}%`;
  }
}

/**
 * Measure rendered bubble anchors, resolve overlaps, and write final % positions.
 * @returns false when the field cannot be measured or overlaps remain after max iterations.
 */
function layoutSurveyBubbles(
  field: HTMLElement,
  anchors: readonly HTMLElement[],
): boolean {
  const bounds = readFieldBounds(field);
  if (!bounds) {
    console.warn("[surveyBubbleLayout] Field has zero size; skipping layout.");
    return false;
  }

  const bubbles = measureBubbles(field, anchors);

  for (let iter = 0; iter < SURVEY_LAYOUT_MAX_ITERATIONS; iter++) {
    const moved = runSeparationPass(bubbles, bounds);
    if (!moved) break;
  }

  const overlapsRemain = hasAnyOverlap(bubbles);
  if (overlapsRemain) {
    console.warn(
      `[surveyBubbleLayout] Overlaps remain after ${SURVEY_LAYOUT_MAX_ITERATIONS} iterations.`,
    );
  }

  applyBubblePositions(bubbles, bounds);
  return !overlapsRemain;
}

type LayoutSchedule = {
  cancel: () => void;
};

/**
 * Run layout after paint so bubble sizes reflect real DOM metrics, then call `onReady`.
 * Uses a double `requestAnimationFrame` so fonts and flex layout have settled.
 */
export function scheduleBubbleFieldLayout(
  field: HTMLElement,
  anchors: readonly HTMLElement[],
  onReady: () => void,
): LayoutSchedule {
  let raf1 = 0;
  let raf2 = 0;
  let rafRetry = 0;
  let cancelled = false;

  const finishLayout = (): void => {
    layoutSurveyBubbles(field, anchors);
    onReady();
  };

  raf1 = requestAnimationFrame(() => {
    if (cancelled) return;
    raf2 = requestAnimationFrame(() => {
      if (cancelled) return;
      if (!readFieldBounds(field)) {
        rafRetry = requestAnimationFrame(() => {
          if (cancelled) return;
          finishLayout();
        });
        return;
      }
      finishLayout();
    });
  });

  return {
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      cancelAnimationFrame(rafRetry);
    },
  };
}
