import "./survey.css";
import {
  hasUserConsented,
  recordConsent,
  recordDecline,
} from "./consentStorage";

let modalEl: HTMLElement | null = null;

function hideConsentModal(): void {
  modalEl?.remove();
  modalEl = null;
}

/**
 * Gate the share-your-pain survey behind research/AI consent.
 *
 * If this device already consented, calls `onConsent` without showing UI.
 * Otherwise shows a modal: I Agree → persist + `onConsent`; I Decline or
 * backdrop click → `recordDecline` + `onDecline`.
 */
export async function showConsentModal(
  host: HTMLElement,
  onConsent: () => void,
  onDecline: () => void,
): Promise<void> {
  hideConsentModal();

  if (await hasUserConsented()) {
    onConsent();
    return;
  }

  modalEl = document.createElement("div");
  modalEl.className = "consent-modal consent-modal--visible";
  modalEl.setAttribute("role", "dialog");
  modalEl.setAttribute("aria-modal", "true");
  modalEl.setAttribute("aria-label", "Survey");

  const backdrop = document.createElement("div");
  backdrop.className = "consent-modal__backdrop";
  backdrop.setAttribute("aria-hidden", "true");

  const panel = document.createElement("div");
  panel.className = "consent-modal__panel";

  const titleEl = document.createElement("h2");
  titleEl.className = "consent-modal__title";
  titleEl.textContent = "Survey";

  const bodyEl = document.createElement("p");
  bodyEl.className = "consent-modal__body";
  bodyEl.textContent =
    "Your contribution to this artwork can also help us learn more about how people experience and express pain. Your responses are collected anonymously. We do not collect information that allows us to identify you or link your answers back to you. The anonymous responses may be analysed and used for research purposes, including reports and scientific publications. Please avoid including information in open-text fields that could identify you or another person. Because your responses cannot be linked back to you, it will not be possible to identify or remove your individual responses after you submit them.";

  const subheadingEl = document.createElement("h3");
  subheadingEl.className = "consent-modal__subheading";
  subheadingEl.textContent = "How AI is used:";

  const aiBodyEl = document.createElement("p");
  aiBodyEl.className = "consent-modal__body";
  aiBodyEl.textContent =
    "The text you enter in the open question is processed by an AI system to generate a personalised response for you as part of the artwork. It should not be understood as medical advice, diagnosis or professional guidance. Your text is processed within the EU.";

  const actions = document.createElement("div");
  actions.className = "consent-modal__actions";

  const declineBtn = document.createElement("button");
  declineBtn.type = "button";
  declineBtn.className = "consent-modal__btn consent-modal__btn--decline";
  declineBtn.textContent = "I Decline";

  const agreeBtn = document.createElement("button");
  agreeBtn.type = "button";
  agreeBtn.className = "consent-modal__btn consent-modal__btn--agree";
  agreeBtn.textContent = "I Agree";

  let settled = false;

  const handleAgree = (): void => {
    if (settled) return;
    settled = true;
    hideConsentModal();
    void recordConsent().then(() => {
      onConsent();
    });
  };

  const handleDecline = (): void => {
    if (settled) return;
    settled = true;
    hideConsentModal();
    void recordDecline().then(() => {
      onDecline();
    });
  };

  declineBtn.addEventListener("click", handleDecline);
  agreeBtn.addEventListener("click", handleAgree);
  backdrop.addEventListener("click", handleDecline);

  actions.append(declineBtn, agreeBtn);
  panel.append(titleEl, bodyEl, subheadingEl, aiBodyEl, actions);
  modalEl.append(backdrop, panel);
  host.appendChild(modalEl);
}
