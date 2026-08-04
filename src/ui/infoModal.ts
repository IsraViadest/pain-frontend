type InfoModalOptions = {
  title: string;
  body: string;
  onClose: () => void;
};

/** Placeholder copy for the About info modal. */
export const INFO_MODAL_ABOUT: Readonly<{ title: string; body: string }> = {
  title: "About",
  body: "Coming soon.",
};

/** Placeholder copy for the Data Sources info modal. */
export const INFO_MODAL_DATA_SOURCES: Readonly<{ title: string; body: string }> = {
  title: "Data Sources",
  body: "Coming soon.",
};

let modalEl: HTMLElement | null = null;
let closeHandler: (() => void) | null = null;

/**
 * Show a centered info modal (About / Data Sources) with title and body text.
 *
 * Replaces any existing info modal. CLOSE sits outside the panel (survey result pattern).
 */
export function showInfoModal(
  host: HTMLElement,
  { title, body, onClose }: InfoModalOptions,
): void {
  hideInfoModal();

  closeHandler = onClose;

  modalEl = document.createElement("div");
  modalEl.className = "info-modal info-modal--visible";
  modalEl.setAttribute("role", "dialog");
  modalEl.setAttribute("aria-modal", "true");
  modalEl.setAttribute("aria-label", title);

  const backdrop = document.createElement("div");
  backdrop.className = "info-modal__backdrop";
  backdrop.setAttribute("aria-hidden", "true");

  const panel = document.createElement("div");
  panel.className = "info-modal__panel";

  const titleEl = document.createElement("h2");
  titleEl.className = "info-modal__title";
  titleEl.textContent = title;

  const bodyEl = document.createElement("p");
  bodyEl.className = "info-modal__body";
  bodyEl.textContent = body;

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "info-modal__close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "CLOSE";

  const handleClose = (): void => {
    const cb = closeHandler;
    hideInfoModal();
    cb?.();
  };

  closeBtn.addEventListener("click", handleClose);
  panel.append(titleEl, bodyEl);
  modalEl.append(backdrop, panel, closeBtn);
  host.appendChild(modalEl);
}

/** Dismiss the info modal if visible. */
export function hideInfoModal(): void {
  modalEl?.remove();
  modalEl = null;
  closeHandler = null;
}
