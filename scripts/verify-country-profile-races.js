/*
 * Browser expression for artifacts/emo-views/eval.mjs.
 * Run with cp=1, cpPreset=v2-c_fade-360, cpTimeScale=0.005, and freeze=1.
 */
(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const require = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const waitFor = async (predicate, message) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (predicate()) return;
      await sleep(10);
    }
    throw new Error(`Timed out: ${message}`);
  };
  const button = (label) =>
    [...document.querySelectorAll("button")].find(
      (candidate) => candidate.textContent.trim() === label,
    );
  const canvas = document.querySelector("canvas");
  const profile = document.querySelector("#country-profile");
  const toggle = document.querySelector("#country-presentation-toggle");
  require(canvas && profile && toggle, "country profile controls unavailable");

  button("Emotional Pain").click();
  await sleep(500);
  button("Environmental Pain").click();
  await sleep(170);
  button("Emotional Pain").click();
  await sleep(550);
  require(profile.dataset.layer === "emopain", "stale layer transition committed");
  require(profile.dataset.transition === "in", "profile remained faded out");

  toggle.click();
  toggle.click();
  await sleep(600);
  require(toggle.getAttribute("aria-pressed") === "false", "early stop stayed enabled");
  require(profile.dataset.layer === "emopain", "early stop did not restore the layer");

  toggle.click();
  await waitFor(() => toggle.dataset.state === "preparing", "presentation prepare");
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, clientX: 30, clientY: 450 }),
  );
  await waitFor(
    () => toggle.dataset.state === "paused-interaction",
    "interaction pause",
  );
  const india = document.querySelector('.emo-label[data-iso3="IND"]');
  const indiaRect = india.getBoundingClientRect();
  const clientX = indiaRect.left + indiaRect.width / 2;
  const clientY = indiaRect.top + indiaRect.height / 2;
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, clientX, clientY }),
  );
  canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX, clientY }));
  await sleep(300);
  require(!profile.hidden, "manual profile remained suppressed after pause");
  require(
    profile.querySelector("h2")?.textContent === "India",
    "manual selection did not open India",
  );
  require(toggle.textContent === "stop presentation", "toggle action label is stale");
  require(
    document.querySelector(".country-presentation-status")?.textContent?.includes("paused"),
    "interaction pause was not announced",
  );
  toggle.click();
  await sleep(150);

  toggle.click();
  await waitFor(() => toggle.dataset.state === "preparing", "second prepare");
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, clientX: 30, clientY: 450 }),
  );
  await waitFor(
    () => toggle.dataset.state === "paused-interaction",
    "second interaction pause",
  );
  toggle.focus();
  await sleep(950);
  require(toggle.dataset.state === "paused-interaction", "focus did not hold pause");
  button("Environmental Pain").focus();
  await sleep(200);
  require(toggle.dataset.state !== "paused-interaction", "pause did not resume after focus left");
  toggle.click();

  return {
    layerRace: "emopain",
    earlyStop: "emopain",
    manualCountry: "India",
    pauseAnnounced: true,
    focusResume: true,
  };
})()
