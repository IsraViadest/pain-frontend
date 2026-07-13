import "./survey.css";
import { mountSurveyScreen1 } from "./SurveyScreen1";
import { mountSurveyScreen2 } from "./SurveyScreen2";
import { mountSurveyScreen3 } from "./SurveyScreen3";
import { mountSurveyScreen4 } from "./SurveyScreen4";
import { mountSurveyScreen5 } from "./SurveyScreen5";
import { SURVEY_FADE_MS, type SurveySessionState } from "./surveyData";
import { trackSurveyStep } from "../api/metricsApi";

type ActiveScreen = {
  unmount: () => void;
};

type SurveyModalOptions = {
  onSurveySubmitted?: () => void;
};

/**
 * Main modal controller and screen transition manager for the user survey flow.
 * Mounts into `#survey-modal`, owns navigation between SurveyScreen1–5, and
 * coordinates open/close state with surveyApi submission hooks.
 */
export class SurveyModal {
  private readonly host: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly screenHost: HTMLElement;
  private readonly closeBtn: HTMLButtonElement;
  private readonly onSurveySubmitted?: () => void;
  private state: SurveySessionState = {
    selectedWords: new Set(),
    placements: [],
    temporality: [],
    relations: [],
    painText: "",
  };
  private activeScreen: ActiveScreen | null = null;
  private currentScreen = 0;
  private isOpen = false;
  private onCloseTransitionEnd = (): void => {
    this.finishClose();
  };

  constructor(host: HTMLElement, options: SurveyModalOptions = {}) {
    this.onSurveySubmitted = options.onSurveySubmitted;
    this.host = host;
    this.host.classList.add("survey-modal");
    this.host.setAttribute("aria-hidden", "true");
    // Ensure the overlay never intercepts pointer events until explicitly opened.
    this.host.style.pointerEvents = "none";

    this.panel = document.createElement("div");
    this.panel.className = "survey-modal__panel";
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-modal", "true");
    this.panel.setAttribute("aria-label", "Share your pain survey");

    this.closeBtn = document.createElement("button");
    this.closeBtn.type = "button";
    this.closeBtn.className = "survey-modal__close";
    this.closeBtn.setAttribute("aria-label", "Close survey");
    this.closeBtn.textContent = "×";
    this.closeBtn.addEventListener("click", () => {
      this.close();
    });

    this.screenHost = document.createElement("div");
    this.screenHost.className = "survey-modal__screen";

    this.panel.append(this.closeBtn, this.screenHost);
    this.host.appendChild(this.panel);

    document.addEventListener("keydown", this.onDocumentKeyDown);
  }

  /** Open the survey modal with a fade-in and mount screen 1. */
  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.state = {
      selectedWords: new Set(),
      placements: [],
      temporality: [],
      relations: [],
      painText: "",
    };
    this.host.setAttribute("aria-hidden", "false");
    this.host.classList.remove("survey-modal--closing");

    // Add the visibility class synchronously so opacity transitions reliably.
    this.host.classList.add("survey-modal--visible");
    this.host.style.pointerEvents = "auto";

    // Screen 1 mounts immediately (no fire-and-forget goToScreen(1)).
    this.unmountActiveScreen();
    this.mountScreen1();
    this.currentScreen = 1;
    trackSurveyStep(0);
  }

  /** Close the survey modal with a fade-out. */
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.host.style.pointerEvents = "none";
    this.host.classList.remove("survey-modal--visible");
    this.host.classList.add("survey-modal--closing");
    this.host.addEventListener(
      "transitionend",
      this.onCloseTransitionEnd,
      { once: true },
    );
    window.setTimeout(() => {
      if (this.host.classList.contains("survey-modal--closing")) {
        this.finishClose();
      }
    }, SURVEY_FADE_MS + 50);
  }

  /** Current survey session state (selected words, etc.). */
  getSessionState(): SurveySessionState {
    return this.state;
  }

  private finishClose(): void {
    this.host.classList.remove("survey-modal--closing");
    this.host.setAttribute("aria-hidden", "true");
    this.unmountActiveScreen();
    this.currentScreen = 0;
  }

  private onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (!this.isOpen) return;
    if (event.key === "Escape") {
      this.close();
    }
  };

  private unmountActiveScreen(): void {
    this.activeScreen?.unmount();
    this.activeScreen = null;
    this.screenHost.innerHTML = "";
    this.screenHost.classList.remove("survey-modal__screen--hidden");
  }

  private mountScreen1(): void {
    this.activeScreen = mountSurveyScreen1(this.screenHost, {
      state: this.state,
      onAdvance: () => {
        trackSurveyStep(1);
        void this.goToScreen(2);
      },
    });
  }

  private mountScreen2(): void {
    this.activeScreen = mountSurveyScreen2(this.screenHost, {
      state: this.state,
      onBack: () => {
        void this.goToScreen(1);
      },
      onAdvance: () => {
        trackSurveyStep(2);
        void this.goToScreen(3);
      },
    });
  }

  private mountScreen3(): void {
    this.activeScreen = mountSurveyScreen3(this.screenHost, {
      state: this.state,
      onBack: () => {
        void this.goToScreen(2);
      },
      onAdvance: () => {
        trackSurveyStep(3);
        void this.goToScreen(4);
      },
    });
  }

  private mountScreen4(): void {
    this.activeScreen = mountSurveyScreen4(this.screenHost, {
      state: this.state,
      onBack: () => {
        void this.goToScreen(3);
      },
      onAdvance: () => {
        trackSurveyStep(4);
        void this.goToScreen(5);
      },
    });
  }

  private mountScreen5(): void {
    this.activeScreen = mountSurveyScreen5(this.screenHost, {
      state: this.state,
      onBack: () => {
        void this.goToScreen(4);
      },
      onSubmit: () => {
        trackSurveyStep(5);
        this.handleSurveySubmit();
      },
    });
  }

  private handleSurveySubmit(): void {
    this.close();
    if (!this.onSurveySubmitted) return;
    window.setTimeout(() => {
      this.onSurveySubmitted?.();
    }, SURVEY_FADE_MS);
  }

  private async goToScreen(screen: number): Promise<void> {
    if (screen === this.currentScreen && this.activeScreen) return;

    const hadScreen = this.activeScreen !== null;
    if (hadScreen) {
      this.screenHost.classList.add("survey-modal__screen--hidden");
      await this.wait(SURVEY_FADE_MS);
    }
    this.unmountActiveScreen();

    if (screen === 1) {
      this.mountScreen1();
      this.currentScreen = 1;
    } else if (screen === 2) {
      this.mountScreen2();
      this.currentScreen = 2;
    } else if (screen === 3) {
      this.mountScreen3();
      this.currentScreen = 3;
    } else if (screen === 4) {
      this.mountScreen4();
      this.currentScreen = 4;
    } else if (screen === 5) {
      this.mountScreen5();
      this.currentScreen = 5;
    } else {
      console.warn(`[SurveyModal] Screen ${screen} is not implemented yet.`);
      this.currentScreen = screen;
    }

    requestAnimationFrame(() => {
      this.screenHost.classList.remove("survey-modal__screen--hidden");
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }
}
