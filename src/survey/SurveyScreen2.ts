import { latLngToNormalizedMapXY, svgCoordsToLatLng } from "./mapUtils";
import { createSurveyAdvanceGate } from "./surveyAdvanceGate";
import { playButtonSound, SOUND_BUTTON_BLOB } from "../sound/buttonSound";
import {
  SURVEY_BLOB_DEFS,
  SURVEY_DRAG_WORD_MIME,
  assignBlobId,
  ensureSurveyBlobKeyframes,
  type SurveySessionState,
  type SurveyWordPlacement,
} from "./surveyData";

type SurveyScreen2Context = {
  state: SurveySessionState;
  onBack: () => void;
  onAdvance: () => void;
};

type SurveyScreen2Controller = {
  unmount: () => void;
};

/** Position pins after layout — double rAF so img getBoundingClientRect() is stable. */
function schedulePinLayoutSync(
  mapImg: HTMLImageElement,
  sync: () => void,
): void {
  const runAfterLayout = (): void => {
    requestAnimationFrame(() => {
      requestAnimationFrame(sync);
    });
  };

  if (mapImg.complete) {
    runAfterLayout();
  } else {
    mapImg.addEventListener("load", runAfterLayout, { once: true });
  }
}

/** Position a pin over the map image using layout offsets (transform-safe for pinch zoom). */
function positionPinOnMapImage(
  pinEl: HTMLElement,
  lat: number,
  lng: number,
  imgEl: HTMLImageElement,
  pinLayerEl: HTMLElement,
): void {
  const imgWidth = imgEl.offsetWidth;
  const imgHeight = imgEl.offsetHeight;
  if (imgWidth <= 0 || imgHeight <= 0) return;

  const { nx, ny } = latLngToNormalizedMapXY(lat, lng);
  const x = imgEl.offsetLeft - pinLayerEl.offsetLeft + nx * imgWidth;
  const y = imgEl.offsetTop - pinLayerEl.offsetTop + ny * imgHeight;
  pinEl.style.left = `${x}px`;
  pinEl.style.top = `${y}px`;
}

function upsertPlacement(
  state: SurveySessionState,
  word: string,
  lat: number,
  lng: number,
): void {
  const index = state.placements.findIndex((entry) => entry.word === word);
  const placement: SurveyWordPlacement = { word, lat, lng };
  if (index >= 0) {
    state.placements[index] = placement;
  } else {
    state.placements.push(placement);
  }
}

function createTrayBlobButton(word: string): HTMLButtonElement {
  const blobId = assignBlobId(word);
  const blob = SURVEY_BLOB_DEFS[blobId];

  const button = document.createElement("button");
  button.type = "button";
  button.className = `survey-tray-bubble survey-tray-bubble--${blobId}`;
  button.dataset.word = word;
  button.draggable = true;
  button.setAttribute("aria-grabbed", "false");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", blob.viewBox);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("survey-bubble__svg");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", blob.paths[1]);
  path.classList.add("survey-bubble__path", `survey-bubble__path--${blobId}`);
  svg.appendChild(path);

  const label = document.createElement("span");
  label.className = "survey-bubble__label";
  label.textContent = word;

  button.append(svg, label);
  return button;
}

function createMapPin(word: string): HTMLElement {
  const pin = document.createElement("div");
  pin.className = "survey-map-pin";
  pin.dataset.word = word;
  pin.draggable = true;
  pin.setAttribute("role", "img");
  pin.setAttribute("aria-label", `${word} on map`);

  const label = document.createElement("span");
  label.className = "survey-map-pin__label";
  label.textContent = word;

  const dot = document.createElement("span");
  dot.className = "survey-map-pin__dot";
  dot.setAttribute("aria-hidden", "true");

  pin.append(label, dot);
  return pin;
}

/** CSS class toggled on the tap-selected tray bubble or placed pin. */
const TAP_SELECTED_CLASS = "survey-map__bubble--selected";

/** Pinch zoom lower bound — fit-to-wrap baseline (no shrink below natural layout size). */
const MAP_ZOOM_MIN = 1;
/** Pinch zoom upper bound — max magnification on mobile Screen 2 map. */
const MAP_ZOOM_MAX = 5;

function touchPinchMidpoint(touches: TouchList): { x: number; y: number } {
  return {
    x: (touches[0]!.clientX + touches[1]!.clientX) / 2,
    y: (touches[0]!.clientY + touches[1]!.clientY) / 2,
  };
}

function pinchOriginPercent(
  zoomLayer: HTMLElement,
  midX: number,
  midY: number,
): string {
  const rect = zoomLayer.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return "center center";
  }
  const originX = ((midX - rect.left) / rect.width) * 100;
  const originY = ((midY - rect.top) / rect.height) * 100;
  return `${originX}% ${originY}%`;
}

function touchPinchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[1].clientX - touches[0].clientX;
  const dy = touches[1].clientY - touches[0].clientY;
  return Math.hypot(dx, dy);
}

function clampMapZoom(scale: number): number {
  return Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, scale));
}

function applyMapZoomTransform(
  zoomLayer: HTMLElement,
  pinLayer: HTMLElement,
  panX: number,
  panY: number,
  scale: number,
): void {
  if (scale <= MAP_ZOOM_MIN && panX === 0 && panY === 0) {
    zoomLayer.style.transform = "";
    pinLayer.style.transform = "";
    return;
  }
  zoomLayer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  pinLayer.style.transform = scale === 1 ? "" : `scale(${1 / scale})`;
  pinLayer.style.transformOrigin = "0 0";
}

function clampMapPanInWrap(
  zoomLayer: HTMLElement,
  pinLayer: HTMLElement,
  mapWrap: HTMLElement,
  pan: { x: number; y: number },
  scale: number,
): void {
  applyMapZoomTransform(zoomLayer, pinLayer, pan.x, pan.y, scale);
  const viewport = mapWrap.getBoundingClientRect();
  const content = zoomLayer.getBoundingClientRect();

  if (content.left > viewport.left) {
    pan.x -= content.left - viewport.left;
  }
  if (content.right < viewport.right) {
    pan.x += viewport.right - content.right;
  }
  if (content.top > viewport.top) {
    pan.y -= content.top - viewport.top;
  }
  if (content.bottom < viewport.bottom) {
    pan.y += viewport.bottom - content.bottom;
  }

  applyMapZoomTransform(zoomLayer, pinLayer, pan.x, pan.y, scale);
}

/**
 * Survey screen 2 — drag or tap-to-place words onto the world map as lat/lng pins.
 *
 * Desktop: drag a tray bubble onto the map (existing behaviour).
 * Mobile / touch: tap a tray bubble to select it, then tap the map to place it.
 */
export function mountSurveyScreen2(
  host: HTMLElement,
  { state, onBack, onAdvance }: SurveyScreen2Context,
): SurveyScreen2Controller {
  ensureSurveyBlobKeyframes();

  state.placements = state.placements.filter((entry) =>
    state.selectedWords.has(entry.word),
  );

  const cleanups: (() => void)[] = [];
  const addListener = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void => {
    target.addEventListener(type, listener as EventListener, options);
    cleanups.push(() => {
      target.removeEventListener(type, listener as EventListener, options);
    });
  };

  let tapSelectedWord: string | null = null;
  let tapSelectedEl: HTMLElement | null = null;

  const setTapSelection = (word: string | null, el: HTMLElement | null): void => {
    if (tapSelectedEl) tapSelectedEl.classList.remove(TAP_SELECTED_CLASS);
    if (word === tapSelectedWord && word !== null) {
      tapSelectedWord = null;
      tapSelectedEl = null;
      return;
    }
    tapSelectedWord = word;
    tapSelectedEl = el;
    if (tapSelectedEl) tapSelectedEl.classList.add(TAP_SELECTED_CLASS);
  };

  const root = document.createElement("div");
  root.className = "survey-screen survey-screen--2";

  const title = document.createElement("h2");
  title.className = "survey-screen__title";
  title.textContent =
    "Place the word bubbles on the body of the planet.";

  const tapHint = document.createElement("p");
  tapHint.className = "survey-screen__tap-hint";
  tapHint.textContent = "Tap a word, then tap the map to place it";

  const mapWrap = document.createElement("div");
  mapWrap.className = "survey-screen__map-wrap";

  const zoomLayer = document.createElement("div");
  zoomLayer.className = "survey-map__zoom-layer";

  const mapImg = document.createElement("img");
  mapImg.className = "survey-screen__map";
  mapImg.src = "/world.svg";
  mapImg.alt = "World map";
  mapImg.draggable = false;

  const pinLayer = document.createElement("div");
  pinLayer.className = "survey-screen__pin-layer";

  zoomLayer.append(mapImg, pinLayer);
  mapWrap.append(zoomLayer);

  const tray = document.createElement("div");
  tray.className = "survey-screen__tray";
  tray.setAttribute("role", "list");
  tray.setAttribute("aria-label", "Words to place on the map");

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "survey-screen__back";
  backBtn.setAttribute("aria-label", "Back to word selection");
  backBtn.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 10H4M9 5L4 10l5 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const advanceGate = createSurveyAdvanceGate(
    "Please place at least one word on the map",
    onAdvance,
  );

  const syncAdvanceEnabled = (): void => {
    advanceGate.setEnabled(state.placements.length >= 1);
  };

  root.append(
    title,
    tapHint,
    mapWrap,
    tray,
    backBtn,
    advanceGate.validationMsg,
    advanceGate.wrapper,
  );
  host.appendChild(root);

  const pinByWord = new Map<string, HTMLElement>();

  const syncAllPinPositions = (): void => {
    for (const placement of state.placements) {
      const pin = pinByWord.get(placement.word);
      if (!pin) continue;
      positionPinOnMapImage(
        pin,
        placement.lat,
        placement.lng,
        mapImg,
        pinLayer,
      );
    }
  };

  const syncMapColumnWidth = (): void => {
    const isDesktop = window.matchMedia("(min-width: 769px)").matches;
    const width = isDesktop
      ? mapImg.getBoundingClientRect().width
      : mapImg.offsetWidth;
    if (width <= 0) return;

    if (isDesktop) {
      mapWrap.style.width = `${width}px`;
      tray.style.width = `${width}px`;
      tray.style.maxWidth = "";
      syncAllPinPositions();
      return;
    }

    mapWrap.style.width = "";
    tray.style.width = "";
    tray.style.maxWidth = `${width}px`;
  };

  const scheduleMapColumnWidthSync = (): void => {
    requestAnimationFrame(() => {
      requestAnimationFrame(syncMapColumnWidth);
    });
  };

  if (mapImg.complete) {
    scheduleMapColumnWidthSync();
  } else {
    mapImg.addEventListener("load", scheduleMapColumnWidthSync, { once: true });
  }

  const onWindowResize = (): void => {
    scheduleMapColumnWidthSync();
  };
  window.addEventListener("resize", onWindowResize);
  cleanups.push(() => window.removeEventListener("resize", onWindowResize));

  const renderPin = (
    placement: SurveyWordPlacement,
    positionNow = true,
  ): void => {
    let pin = pinByWord.get(placement.word);
    if (!pin) {
      pin = createMapPin(placement.word);
      pinByWord.set(placement.word, pin);
      pinLayer.appendChild(pin);

      addListener(pin, "dragstart", (event) => {
        if (!event.dataTransfer) return;
        event.dataTransfer.setData(SURVEY_DRAG_WORD_MIME, placement.word);
        event.dataTransfer.setData("text/plain", placement.word);
        event.dataTransfer.effectAllowed = "move";
      });

      const pinRef = pin;
      addListener(pin, "click", () => {
        setTapSelection(placement.word, pinRef);
      });
    }
    if (positionNow) {
      positionPinOnMapImage(
        pin,
        placement.lat,
        placement.lng,
        mapImg,
        pinLayer,
      );
    }
  };

  for (const placement of state.placements) {
    renderPin(placement, false);
  }

  const placedWords = (): Set<string> =>
    new Set(state.placements.map((entry) => entry.word));

  const refreshTray = (): void => {
    tray.replaceChildren();

    if (state.selectedWords.size === 0) {
      return;
    }

    const placed = placedWords();
    for (const word of state.selectedWords) {
      if (placed.has(word)) continue;

      const blobBtn = createTrayBlobButton(word);
      tray.appendChild(blobBtn);

      addListener(blobBtn, "dragstart", (event) => {
        if (!event.dataTransfer) return;
        event.dataTransfer.setData(SURVEY_DRAG_WORD_MIME, word);
        event.dataTransfer.setData("text/plain", word);
        event.dataTransfer.effectAllowed = "move";
        const rect = blobBtn.getBoundingClientRect();
        event.dataTransfer.setDragImage(
          blobBtn,
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
        blobBtn.setAttribute("aria-grabbed", "true");
      });

      addListener(blobBtn, "dragend", () => {
        blobBtn.setAttribute("aria-grabbed", "false");
      });

      addListener(blobBtn, "click", () => {
        playButtonSound(SOUND_BUTTON_BLOB);
        setTapSelection(word, blobBtn);
      });
    }
  };

  const commitPlacement = (word: string, lat: number, lng: number): void => {
    upsertPlacement(state, word, lat, lng);
    renderPin({ word, lat, lng });
    refreshTray();
    syncAdvanceEnabled();
    playButtonSound(SOUND_BUTTON_BLOB);
  };

  refreshTray();

  const readDraggedWord = (event: DragEvent): string | null => {
    const word =
      event.dataTransfer?.getData(SURVEY_DRAG_WORD_MIME) ||
      event.dataTransfer?.getData("text/plain");
    return word || null;
  };

  const handleMapDrop = (event: DragEvent): void => {
    event.preventDefault();
    const word = readDraggedWord(event);
    if (!word || !state.selectedWords.has(word)) return;

    const coords = svgCoordsToLatLng(event.clientX, event.clientY, mapImg);
    if (!coords) return;

    commitPlacement(word, coords.lat, coords.lng);
  };

  addListener(mapImg, "dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  });

  addListener(mapImg, "drop", handleMapDrop);

  let suppressNextMapClick = false;

  addListener(mapImg, "click", (event) => {
    if (suppressNextMapClick) {
      suppressNextMapClick = false;
      return;
    }
    if (!tapSelectedWord) return;
    const coords = svgCoordsToLatLng(event.clientX, event.clientY, mapImg);
    if (!coords) return;
    const word = tapSelectedWord;
    commitPlacement(word, coords.lat, coords.lng);
    setTapSelection(null, null);
  });

  if (window.matchMedia("(max-width: 768px)").matches) {
    let mapZoomScale = MAP_ZOOM_MIN;
    let mapPanX = 0;
    let mapPanY = 0;
    let lastMidX = 0;
    let lastMidY = 0;
    let pinchInitialDistance = 0;
    let pinchInitialScale = MAP_ZOOM_MIN;
    let pinchActive = false;
    let hadMultiTouchDuringGesture = false;

    const clampAndApplyMapTransform = (): void => {
      const pan = { x: mapPanX, y: mapPanY };
      clampMapPanInWrap(zoomLayer, pinLayer, mapWrap, pan, mapZoomScale);
      mapPanX = pan.x;
      mapPanY = pan.y;
    };

    const finalizePinchZoom = (): void => {
      if (!pinchActive) return;
      pinchActive = false;
      pinchInitialDistance = 0;
      mapZoomScale = clampMapZoom(mapZoomScale);
      if (mapZoomScale <= MAP_ZOOM_MIN) {
        mapZoomScale = MAP_ZOOM_MIN;
        mapPanX = 0;
        mapPanY = 0;
      }
      clampAndApplyMapTransform();
      if (hadMultiTouchDuringGesture) {
        suppressNextMapClick = true;
        hadMultiTouchDuringGesture = false;
      }
    };

    const onZoomTouchStart = (event: TouchEvent): void => {
      if (event.touches.length >= 2) {
        pinchActive = true;
        hadMultiTouchDuringGesture = true;
        pinchInitialDistance = touchPinchDistance(event.touches);
        pinchInitialScale = mapZoomScale;
        const { x: midX, y: midY } = touchPinchMidpoint(event.touches);
        lastMidX = midX;
        lastMidY = midY;
        zoomLayer.style.transformOrigin = pinchOriginPercent(zoomLayer, midX, midY);
      }
    };

    const onZoomTouchMove = (event: TouchEvent): void => {
      if (event.touches.length < 2 || pinchInitialDistance <= 0) return;
      hadMultiTouchDuringGesture = true;
      const { x: midX, y: midY } = touchPinchMidpoint(event.touches);
      mapPanX += midX - lastMidX;
      mapPanY += midY - lastMidY;
      lastMidX = midX;
      lastMidY = midY;
      const distance = touchPinchDistance(event.touches);
      mapZoomScale = clampMapZoom(
        pinchInitialScale * (distance / pinchInitialDistance),
      );
      clampAndApplyMapTransform();
      event.preventDefault();
    };

    const onZoomTouchEnd = (event: TouchEvent): void => {
      if (event.touches.length >= 2) return;
      finalizePinchZoom();
    };

    addListener(zoomLayer, "touchstart", onZoomTouchStart);
    addListener(zoomLayer, "touchmove", onZoomTouchMove, { passive: false });
    addListener(zoomLayer, "touchend", onZoomTouchEnd);
    addListener(zoomLayer, "touchcancel", onZoomTouchEnd);
  }

  schedulePinLayoutSync(mapImg, syncAllPinPositions);

  syncAdvanceEnabled();

  addListener(backBtn, "click", onBack);

  return {
    unmount: () => {
      advanceGate.dispose();
      for (const cleanup of cleanups) cleanup();
      root.remove();
    },
  };
}
