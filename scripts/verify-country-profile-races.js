/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/*
 * Browser expression for artifacts/emo-views/eval.mjs.
 * Run with cp=1, cpPreset=v18-b_clear-chrome (or retained v7), cpTimeScale=0.005, and freeze=1.
 * Pipe the JSON result to `jq -e '.passed == true'` so a reported failure exits nonzero.
 */
(async () => {
  try {
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
    await waitFor(() => profile.dataset.layer === "emopain", "early stop layer restoration");

    toggle.click();
    await waitFor(() => toggle.dataset.state === "preparing", "presentation prepare");
    document.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, clientX: 30, clientY: 450 }),
    );
    await waitFor(
      () => toggle.dataset.state === "paused-interaction",
      "interaction pause",
    );
    const selectedLabel = [...document.querySelectorAll(".emo-label")].find((label) => {
      const rect = label.getBoundingClientRect();
      return getComputedStyle(label).visibility === "visible" &&
        rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
    });
    require(selectedLabel, "no painted label available for manual selection");
    const selectedIso3 = selectedLabel.dataset.iso3;
    const selectedCountry = await fetch("/emo/emo-data.json")
      .then((response) => response.json())
      .then((data) => data.countries[selectedIso3].name);
    const labelRect = selectedLabel.getBoundingClientRect();
    const clientX = labelRect.left + labelRect.width / 2;
    const clientY = labelRect.top + labelRect.height / 2;
    document.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, clientX, clientY }),
    );
    canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX, clientY }));
    await sleep(300);
    require(!profile.hidden, "manual profile remained suppressed after pause");
    require(
      profile.querySelector("h2")?.textContent === selectedCountry,
      "manual selection opened the wrong country",
    );
    const refined = toggle.classList.contains("country-presentation-toggle--refined");
    require(refined
      ? toggle.querySelector(".country-presentation-toggle__state")?.textContent === "paused" &&
        toggle.title === "Stop country cycle"
      : toggle.textContent === "stop presentation", "toggle action label is stale");
    require(
      document.querySelector(".country-presentation-status")?.textContent?.includes("paused"),
      "interaction pause was not announced",
    );
    toggle.click();
    await sleep(150);

    toggle.click();
    await waitFor(() => toggle.dataset.state === "preparing", "second prepare");
    document.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, clientX: 30, clientY: 450 }),
    );
    await waitFor(
      () => toggle.dataset.state === "paused-interaction",
      "second interaction pause",
    );
    toggle.focus();
    await sleep(950);
    require(toggle.dataset.state === "paused-interaction", "focus did not hold pause");
    require(
      document.querySelector(".country-presentation-warning")?.hidden,
      "expired warning remained visible while focus held pause",
    );
    button("Environmental Pain").focus();
    await sleep(200);
    require(
      ["preparing", "flying", "building", "dwelling"].includes(toggle.dataset.state),
      "pause did not resume into an active state",
    );
    toggle.click();

    return {
      passed: true,
      layerRace: "emopain",
      earlyStop: "emopain",
      manualCountry: selectedCountry,
      pauseAnnounced: true,
      focusResume: true,
    };
  } catch (error) {
    return {
      passed: false,
      error: error instanceof Error ? error.stack : String(error),
    };
  }
})()
