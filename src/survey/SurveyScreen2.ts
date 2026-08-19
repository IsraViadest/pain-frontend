import { latLngToNormalizedMapXY, svgCoordsToLatLng } from "./mapUtils";
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

/** Position a pin over the map image; reads img rect at call time (letterbox-safe). */
function positionPinOnMapImage(
  pinEl: HTMLElement,
  lat: number,
  lng: number,
  imgEl: HTMLImageElement,
  pinLayerEl: HTMLElement,
): void {
  const imgRect = imgEl.getBoundingClientRect();
  const layerRect = pinLayerEl.getBoundingClientRect();
  if (imgRect.width <= 0 || imgRect.height <= 0) return;

  const { nx, ny } = latLngToNormalizedMapXY(lat, lng);
  const x = imgRect.left - layerRect.left + nx * imgRect.width;
  const y = imgRect.top - layerRect.top + ny * imgRect.height;
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

  const mapImg = document.createElement("img");
  mapImg.className = "survey-screen__map";
  mapImg.src = "/world.svg";
  mapImg.alt = "World map";
  mapImg.draggable = false;

  const pinLayer = document.createElement("div");
  pinLayer.className = "survey-screen__pin-layer";

  mapWrap.append(mapImg, pinLayer);

  const tray = document.createElement("div");
  tray.className = "survey-screen__tray";
  tray.setAttribute("role", "list");
  tray.setAttribute("aria-label", "Words to place on the map");

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "survey-screen__back";
  backBtn.setAttribute("aria-label", "Back to word selection");
  backBtn.textContent = "←";

  const advanceBtn = document.createElement("button");
  advanceBtn.type = "button";
  advanceBtn.className = "survey-screen__advance";
  advanceBtn.setAttribute("aria-label", "Continue to next step");
  advanceBtn.textContent = "→";

  root.append(title, tapHint, mapWrap, tray, backBtn, advanceBtn);
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
      const empty = document.createElement("div");
      empty.className = "survey-screen__tray-empty";

      const message = document.createElement("p");
      message.className = "survey-screen__tray-empty-message";
      message.textContent = "No words selected — go back to choose some";

      empty.append(message);
      tray.appendChild(empty);
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
        setTapSelection(word, blobBtn);
      });
    }
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

    upsertPlacement(state, word, coords.lat, coords.lng);
    renderPin({ word, lat: coords.lat, lng: coords.lng });
    refreshTray();
  };

  addListener(mapImg, "dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  });

  addListener(mapImg, "drop", handleMapDrop);

  addListener(mapImg, "click", (event) => {
    if (!tapSelectedWord) return;
    const coords = svgCoordsToLatLng(event.clientX, event.clientY, mapImg);
    if (!coords) return;
    const word = tapSelectedWord;
    upsertPlacement(state, word, coords.lat, coords.lng);
    renderPin({ word, lat: coords.lat, lng: coords.lng });
    setTapSelection(null, null);
    refreshTray();
  });

  schedulePinLayoutSync(mapImg, syncAllPinPositions);

  addListener(backBtn, "click", onBack);
  addListener(advanceBtn, "click", onAdvance);

  return {
    unmount: () => {
      for (const cleanup of cleanups) cleanup();
      root.remove();
    },
  };
}
