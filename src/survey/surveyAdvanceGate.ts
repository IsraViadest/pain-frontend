/** How long the validation hint stays visible before fading out. */
const VALIDATION_VISIBLE_MS = 2000;

const ADVANCE_ARROW_SVG =
  '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 10h12M11 5l5 5-5 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

type SurveyAdvanceGate = {
  validationMsg: HTMLParagraphElement;
  wrapper: HTMLDivElement;
  button: HTMLButtonElement;
  setEnabled: (enabled: boolean) => void;
  dispose: () => void;
};

/**
 * Advance button + wrapper that still receives taps when the button is disabled,
 * showing a brief validation message between the nav arrows.
 */
export function createSurveyAdvanceGate(
  validationText: string,
  onAdvance: () => void,
): SurveyAdvanceGate {
  const validationMsg = document.createElement("p");
  validationMsg.className = "survey-screen__validation-msg";
  validationMsg.textContent = validationText;
  validationMsg.setAttribute("aria-live", "polite");

  const wrapper = document.createElement("div");
  wrapper.className = "survey-screen__advance-wrapper";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "survey-screen__advance";
  button.setAttribute("aria-label", "Continue to next step");
  button.innerHTML = ADVANCE_ARROW_SVG;
  button.disabled = true;
  button.style.opacity = "0.4";
  button.style.cursor = "not-allowed";

  wrapper.appendChild(button);

  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  const hideValidation = (): void => {
    validationMsg.classList.remove("survey-screen__validation-msg--visible");
    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const showValidation = (): void => {
    validationMsg.classList.add("survey-screen__validation-msg--visible");
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      validationMsg.classList.remove("survey-screen__validation-msg--visible");
      hideTimer = null;
    }, VALIDATION_VISIBLE_MS);
  };

  const onWrapperClick = (): void => {
    if (button.disabled) {
      showValidation();
      return;
    }
    onAdvance();
  };

  wrapper.addEventListener("click", onWrapperClick);

  const setEnabled = (enabled: boolean): void => {
    button.disabled = !enabled;
    if (enabled) {
      button.style.opacity = "";
      button.style.cursor = "";
      hideValidation();
    } else {
      button.style.opacity = "0.4";
      button.style.cursor = "not-allowed";
    }
  };

  return {
    validationMsg,
    wrapper,
    button,
    setEnabled,
    dispose: () => {
      hideValidation();
      wrapper.removeEventListener("click", onWrapperClick);
    },
  };
}
