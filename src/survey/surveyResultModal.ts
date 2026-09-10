/*
 * File attribution
 * edited by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
type SurveyResultModalOptions = {
  lat: number;
  lng: number;
  message: string;
  onClose: () => void;
};

let modalEl: HTMLElement | null = null;
let closeHandler: (() => void) | null = null;
let outsideAction: ((event: Event) => void) | null = null;

function concisePainMessage(message: string): string {
  return Array.from(new Intl.Segmenter("en", { granularity: "sentence" }).segment(message),
    part => part.segment).slice(0, 3).join("").trim();
}

/** Decimal places for lat/lng display in the result modal. */
const COORD_DECIMAL_PLACES = 1;

function formatCoord(value: number, positive: string, negative: string): string {
  const hemisphere = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(COORD_DECIMAL_PLACES)}°${hemisphere}`;
}

function formatCoordinates(lat: number, lng: number): string {
  return `Coordinates: ${formatCoord(lat, "N", "S")}, ${formatCoord(lng, "E", "W")}`;
}

/** Centered result card after post-submit globe fly-to. */
export function showSurveyResultModal(
  host: HTMLElement,
  { lat, lng, message, onClose }: SurveyResultModalOptions,
): void {
  hideSurveyResultModal();

  closeHandler = onClose;

  modalEl = document.createElement("div");
  modalEl.className = "survey-result-modal survey-result-modal--visible";
  modalEl.setAttribute("role", "dialog");
  modalEl.setAttribute("aria-modal", "false");
  modalEl.setAttribute("aria-label", "Pain shared location");

  const panel = document.createElement("div");
  panel.className = "survey-result-modal__panel";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "survey-result-modal__close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "CLOSE";

  const title = document.createElement("h2");
  title.className = "survey-result-modal__title";
  title.textContent = "YOUR PAIN IS SHARED HERE";

  const coords = document.createElement("p");
  coords.className = "survey-result-modal__coords";
  coords.textContent = formatCoordinates(lat, lng);

  const messageEl = document.createElement("p");
  messageEl.className = "survey-result-modal__message";
  messageEl.textContent = concisePainMessage(message);
  const description = document.createElement("p");
  description.className = "survey-result-modal__description";
  description.textContent = "locally randomized message";

  const handleClose = (): void => {
    const cb = closeHandler;
    hideSurveyResultModal();
    cb?.();
  };

  closeBtn.addEventListener("click", handleClose);
  outsideAction = (event) => {
    const target = event.target;
    if (target instanceof Element && !modalEl?.contains(target) && target.closest("button,a,[role=button]")) handleClose();
  };
  // Dismiss first, then let the original action continue to its own listener.
  document.addEventListener("click", outsideAction, true);
  panel.append(title, coords, description, messageEl, closeBtn);
  modalEl.append(panel);
  host.appendChild(modalEl);
}

/** Dismiss the post-submit result modal if visible. */
export function hideSurveyResultModal(): void {
  if (outsideAction) document.removeEventListener("click", outsideAction, true);
  outsideAction = null;
  modalEl?.remove();
  modalEl = null;
  closeHandler = null;
}
