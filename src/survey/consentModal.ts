/*
 * File attribution
 * edited by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
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
 * backdrop click → `recordDecline` + `onConsent` (survey still opens;
 * metrics stay off because consent is not recorded as given).
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
    "Your answers are processed for the artwork's response. We do not retain your written text or which survey answers you selected. If you agree, we retain the resulting globe location and record survey activity for research: steps visited, button and selection counts, whether you added text, its character count, and time spent in the survey. Activity is linked by a random visit identifier, without your name. General artwork interactions are recorded separately. Please avoid entering information that identifies you or another person. You can decline survey activity recording and still use the artwork.";

  const subheadingEl = document.createElement("h3");
  subheadingEl.className = "consent-modal__subheading";
  subheadingEl.textContent = "About the response:";

  const aiBodyEl = document.createElement("p");
  aiBodyEl.className = "consent-modal__body";
  aiBodyEl.textContent =
    "This experience offers an artistic location and a response drawn from prepared texts. It is not a medical assessment, diagnosis or professional guidance.";

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
      onConsent();
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
