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
<p style="font-family: 'Apercu Pro', sans-serif; margin: 0 0 24px; line-height: 1.6;">When the Earth feels pain, we feel pain too. The P.A.I.N. project reimagines pain as an interconnected reality (environmental, emotional, social-economic, communal) and how individual and planetary wounds mirror one another. When forests burn, do our nervous systems feel the same inflammation? Could grief be mapped alongside extinction curves? Merging Art, AI, and Network Science, P.A.I.N. weaves often disconnected data sets (climate indicators, public health records, social media sentiment, and GDP indexes) into an interactive 3D globe called the Personal-Planetary-Pain (PPP) Map. Users contribute their own pain stories while an AI engine entangles them with the planet's suffering, inviting visitors to feel as nodes within the Earth's body. In collaboration with the Ludwig Boltzmann Institute for Network Medicine, the project reveals a vastly hidden architecture of pain and transformation, where care for the self becomes inseparable from care for the more-than-human world we are nested within.</p>
<h2 style="font-family: 'Atelier', serif; font-weight: normal; margin: 0 0 12px;">About the P.A.I.N. Collective</h2>
<p style="font-family: 'Apercu Pro', sans-serif; margin: 0 0 24px; line-height: 1.6;">The P.A.I.N Collective is an interdisciplinary group of artists (Mary Maggic, Dora Siafla, Hollis Hui, Dominika Kolenda), alongside computer scientist Michael Artner, AI researcher Christian Stelmach, network scientist Ines Gerard-Ursin, UX/UI developer Isra Viadest, and facilitator Mathieu Mahve-Beydokhti (LBG-OIS). The collective formed during the "Impact Initiative on AI, Art, and Health" hackathon, organized by JKU Linz and Ars Electronica in 2025.</p>
<p style="font-family: 'Apercu Pro', sans-serif; margin: 0 0 32px; line-height: 1.6;">With additional support from Iker Núñez-Carpintero (Post-Doc Researcher) - Multiplex Systems Expert, and Norbert Unfug and Sebastian Pirch - Data Visualization from the Ludwig Boltzmann Institute for Network Medicine.</p>
<div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; background: white; padding: 16px 36px; margin: 0 -36px -28px; border-radius: 0 0 20px 20px;">
  <div class="info-modal__logos-inner" style="display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; max-width: 70%; width: 100%;">
    <a href="https://netmed.lbg.ac.at/" target="_blank" rel="noopener" style="flex: 0.698; min-width: 0;"><img id="logo-netmed" src="/logos/LBI_NetMed_EN_Basisfarben.svg" alt="LBI NetMed" style="width: 100%; height: auto;"></a>
    <a href="https://ois.lbg.ac.at/" target="_blank" rel="noopener" style="flex: 1; min-width: 0;"><img src="/logos/LBG_Logo_OIS_RGB.png" alt="LBG OIS" style="width: 100%; height: auto;"></a>
  </div>
</div>
`.trim(),
};

/** Data Sources info modal — body is HTML (same render path as {@link INFO_MODAL_ABOUT}). */
export const INFO_MODAL_DATA_SOURCES: Readonly<{ title: string; body: string }> = {
  title: "Data Sources",
  body: `
<h2 style="font-family: 'Atelier', serif;">How the layers are visualized</h2>

<p>The PAIN project turns real-world data into the <strong>PPP (Personal-Planetary-Pain) Map</strong> where areas on the Earth's body are affected by how much "pain" they carry — emotional, environmental, physical, or socioeconomic. For each layer, the raw data is converted into a simple score from 0 to 1 (low = less pain, high = more pain), so that often disparate data sets are homogenized and layered together on one map.</p>

<h3>Emotional Layer — how we describe pain</h3>
<p>This layer examines how strongly country-based texts express overlapping forms of distress, including fear, anxiety, grief, loneliness, helplessness, trauma, anger, shame, uncertainty, displacement, and climate-related distress. The main source is <a href="https://huggingface.co/datasets/stanford-oval/ccnews" target="_blank" rel="noopener noreferrer">Stanford OVAL CC-News</a>. Smaller sources add <a href="https://www.consumerfinance.gov/data-research/consumer-complaints/" target="_blank" rel="noopener noreferrer">CFPB consumer complaints</a>, the <a href="https://www.cs.cmu.edu/~ark/GeoText/" target="_blank" rel="noopener noreferrer">CMU GeoText corpus</a>, <a href="https://huggingface.co/datasets/yachay/text_coordinates_seasons" target="_blank" rel="noopener noreferrer">Yachay Text Coordinates</a>, <a href="https://www.kaggle.com/datasets/wjia26/twittersentimentbycountry" target="_blank" rel="noopener noreferrer">World Twitter Sentiment by Country</a>, and <a href="https://zenodo.org/records/14804269" target="_blank" rel="noopener noreferrer">DEMOTEC participatory-budgeting tweets</a>. A custom multilingual classifier model based on <a href="https://huggingface.co/BAAI/bge-m3" target="_blank" rel="noopener noreferrer">BGE-M3</a> trained on synthetically generated examples of emotional pain adds a score to the texts, and aggregates the results by country. On the PPP Map, the strongest signals are presented as emotion words positioned over countries in their native languages.</p>

<h3>Environmental Layer — the planet's distress</h3>
<p><strong>Emissions (CO₂):</strong> Sourced from <a href="https://climatetrace.org/data" target="_blank" rel="noopener noreferrer">Climate TRACE</a>, this layer shows how much greenhouse gas each region produces, from sources like agriculture, transport, power plants, and industry. On the PPP Map, CO₂ appears as <strong>white smog clouds hovering above the Earth's surface.</strong> The denser the clouds, the larger the emissions value.</p>
<p><strong>Temperature:</strong> Sourced from <a href="https://berkeleyearth.org/data/" target="_blank" rel="noopener noreferrer">Berkeley Earth</a>, this layer shows how much each place has warmed in the last decade compared to 1850, averaging the temperature change across 2015–2025 for each location, then normalizing it between two fixed reference points: 1°C and 5°C of warming. A place warming by 1°C scores at 0; a place warming by 5°C scores at 1. On the PPP Map, warming appears as a <strong>red haze over the Earth's surface.</strong> The denser the red, the larger the temperature increase.</p>

<h3>Physical Layer — pain in our bodies</h3>
<p>This layer represents global health data about painful, body-wide conditions (such as back pain, neck pain, migraine, and arthritis) from the <a href="https://www.healthdata.org/research-analysis/gbd" target="_blank" rel="noopener noreferrer">Institute for Health Metrics and Evaluation IHME Global Burden of Disease</a> dataset. Because the original data sets are country-based, the project spreads each country's cases across the map based on <a href="https://data.worldpop.org/GIS/Population_Density/Global_2000_2020_1km_UNadj" target="_blank" rel="noopener noreferrer">WorldPop</a> population data, so pain tends to aggregate more in cities and densely populated regions. On the PPP Map, physical pain appears as <strong>scar dents etched into the Earth's surface.</strong> The deeper the dent, the higher the pain value.</p>

<h3>Socioeconomic Layer — wealth and hardship</h3>
<p>This layer uses each country's GDP (the size of its economy), drawn from the <a href="https://datacatalog.worldbank.org/search/dataset/0038130/gdp-ranking" target="_blank" rel="noopener noreferrer">World Bank's GDP rankings</a>. Because the gap between the richest and poorest countries is so vast (the difference between trillions and millions), the project uses a logarithmic scale so that smaller economies aren't swallowed up by giant ones. This is represented as country-based data on a <strong>choropleth scale from transparent to light yellow.</strong> Lighter shades indicate poorer countries and greater levels of pain.</p>
`.trim(),
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
