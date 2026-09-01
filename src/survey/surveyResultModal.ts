type SurveyResultModalOptions = {
  lat: number;
  lng: number;
  message: string;
  onClose: () => void;
};

let modalEl: HTMLElement | null = null;
let closeHandler: (() => void) | null = null;
let escapeHandler: ((event: KeyboardEvent) => void) | null = null;

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
  modalEl.setAttribute("aria-labelledby", "survey-result-title");
  modalEl.setAttribute(
    "aria-describedby",
    "survey-result-coordinates survey-result-message",
  );

  const panel = document.createElement("div");
  panel.className = "survey-result-modal__panel";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "survey-result-modal__close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "CLOSE";

  const title = document.createElement("h2");
  title.id = "survey-result-title";
  title.className = "survey-result-modal__title";
  title.textContent = "YOUR PAIN IS SHARED HERE";

  const coords = document.createElement("p");
  coords.id = "survey-result-coordinates";
  coords.className = "survey-result-modal__coords";
  coords.textContent = formatCoordinates(lat, lng);

  const messageEl = document.createElement("p");
  messageEl.id = "survey-result-message";
  messageEl.className = "survey-result-modal__message";
  messageEl.textContent = message;

  const handleClose = (): void => {
    const cb = closeHandler;
    hideSurveyResultModal();
    cb?.();
  };

  escapeHandler = (event: KeyboardEvent): void => {
    if (event.key === "Escape") handleClose();
  };

  closeBtn.addEventListener("click", handleClose);
  document.addEventListener("keydown", escapeHandler);
  panel.append(title, coords, messageEl);
  modalEl.append(panel, closeBtn);
  host.appendChild(modalEl);
  closeBtn.focus();
}

/** Dismiss the post-submit result modal if visible. */
export function hideSurveyResultModal(): void {
  if (escapeHandler) document.removeEventListener("keydown", escapeHandler);
  modalEl?.remove();
  modalEl = null;
  closeHandler = null;
  escapeHandler = null;
}
