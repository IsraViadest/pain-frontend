type InfoModalOptions = {
  title: string;
  body: string;
  onClose: () => void;
};

/** About info modal — title lives inside {@link INFO_MODAL_ABOUT.body} HTML. */
export const INFO_MODAL_ABOUT: Readonly<{ title: string; body: string }> = {
  title: "",
  body: `
<h2 style="font-family: 'Atelier', serif; font-weight: normal; margin: 0 0 12px;">About P.A.I.N.</h2>
<p style="font-family: 'Halfre', sans-serif; margin: 0 0 24px; line-height: 1.6;">When the Earth feels pain, we feel pain too. The P.A.I.N. project reimagines pain as an interconnected reality (environmental, emotional, social-economic, communal) and how individual and planetary wounds mirror one another. When forests burn, do our nervous systems feel the same inflammation? Could grief be mapped alongside extinction curves? Merging Art, AI, and Network Science, P.A.I.N. weaves often disconnected data sets (climate indicators, public health records, social media sentiment, and GDP indexes) into an interactive 3D globe called the Personal-Planetary-Pain (PPP) Map. Users contribute their own pain stories while an AI engine entangles them with the planet's suffering, inviting visitors to feel as nodes within the Earth's body. In collaboration with the Ludwig Boltzmann Institute for Network Medicine, the project reveals a vastly hidden architecture of pain and transformation, where care for the self becomes inseparable from care for the more-than-human world we are nested within.</p>
<h2 style="font-family: 'Atelier', serif; font-weight: normal; margin: 0 0 12px;">About the P.A.I.N. Collective</h2>
<p style="font-family: 'Halfre', sans-serif; margin: 0 0 24px; line-height: 1.6;">The P.A.I.N Collective is an interdisciplinary group of artists (Mary Maggic, Dora Siafla, Hollis Hui, Dominika Kolenda), alongside computer scientist Michael Artner, AI researcher Christian Stelmach, network scientist Ines Gerard-Ursin, UX/UI developer Isra Viadest, and facilitator Mathieu Mahve-Beydokhti (LBG-OIS). The collective formed during the "Impact Initiative on AI, Art, and Health" hackathon, organized by JKU Linz and Ars Electronica in 2025.</p>
<p style="font-family: 'Halfre', sans-serif; margin: 0 0 32px; line-height: 1.6;">With additional support from Iker Núñez-Carpintero (Post-Doc Researcher) - Multiplex Systems Expert, and Norbert Unfug and Sebastian Pirch - Data Visualization from the Ludwig Boltzmann Institute for Network Medicine.</p>
<div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; background: white; padding: 16px 36px; margin: 0 -36px -28px; border-radius: 0 0 20px 20px;">
  <div class="info-modal__logos-inner" style="display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; max-width: 70%; width: 100%;">
    <a href="https://netmed.lbg.ac.at/" target="_blank" rel="noopener" style="flex: 0.698; min-width: 0;"><img id="logo-netmed" src="/logos/LBI_NetMed_EN_Basisfarben.svg" alt="LBI NetMed" style="width: 100%; height: auto;"></a>
    <a href="https://ois.lbg.ac.at/" target="_blank" rel="noopener" style="flex: 1; min-width: 0;"><img src="/logos/LBG_Logo_OIS_RGB.png" alt="LBG OIS" style="width: 100%; height: auto;"></a>
  </div>
</div>
`.trim(),
};

/** Placeholder copy for the Data Sources info modal. */
export const INFO_MODAL_DATA_SOURCES: Readonly<{ title: string; body: string }> = {
  title: "Data Sources",
  body: "Coming soon.",
};

let modalEl: HTMLElement | null = null;
let closeHandler: (() => void) | null = null;

/** True when `body` includes an HTML open tag (block markup for About, etc.). */
function bodyContainsHtml(body: string): boolean {
  return /<[a-z][\s\S]*>/i.test(body);
}

/**
 * Show a centered info modal (About / Data Sources) with title and body text.
 *
 * Replaces any existing info modal. Close is a top-right × on the panel.
 * When `body` contains HTML tags, it is set via `innerHTML` on a div; otherwise
 * plain text goes into a paragraph via `textContent`.
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
  modalEl.setAttribute("aria-label", title || "About");

  const backdrop = document.createElement("div");
  backdrop.className = "info-modal__backdrop";
  backdrop.setAttribute("aria-hidden", "true");

  const panel = document.createElement("div");
  panel.className = "info-modal__panel";

  const titleEl = document.createElement("h2");
  titleEl.className = "info-modal__title";
  titleEl.textContent = title;

  const useHtml = bodyContainsHtml(body);
  // Block markup cannot live inside <p>; use a div when body is HTML.
  const bodyEl = document.createElement(useHtml ? "div" : "p");
  bodyEl.className = "info-modal__body";
  if (useHtml) {
    bodyEl.innerHTML = body;
  } else {
    bodyEl.textContent = body;
  }

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "info-modal__close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "×";

  const handleClose = (): void => {
    const cb = closeHandler;
    hideInfoModal();
    cb?.();
  };

  backdrop.addEventListener("click", handleClose);
  closeBtn.addEventListener("click", handleClose);
  if (title) {
    panel.append(closeBtn, titleEl, bodyEl);
  } else {
    panel.append(closeBtn, bodyEl);
  }
  modalEl.append(backdrop, panel);
  host.appendChild(modalEl);
}

/** Dismiss the info modal if visible. */
export function hideInfoModal(): void {
  modalEl?.remove();
  modalEl = null;
  closeHandler = null;
}
