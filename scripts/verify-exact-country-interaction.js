/* Real app selection path through all three non-emotional views. Use cpTimeScale=.05. */
(async () => {
  try {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const check = (condition, message) => { if (!condition) throw Error(message); };
    const canvas = document.querySelector("canvas"), profile = document.querySelector("#country-profile");
    const cycle = document.querySelector("#country-presentation-toggle");
    cycle.click();
    for (let attempt = 0; cycle.dataset.state !== "dwelling" && attempt < 500; attempt++) await sleep(10);
    check(cycle.dataset.state === "dwelling", "cycle did not reach its first country");
    canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 0 }));
    await sleep(80);
    check(profile.querySelector("h2").textContent === "Afghanistan", "unexpected cycle start");
    const clickCenter = () => {
      const clientX = innerWidth / 2, clientY = innerHeight / 2;
      document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX, clientY }));
      canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX, clientY }));
    };
    const button = (label) => [...document.querySelectorAll("button")]
      .find((element) => element.textContent.trim() === label);
    const checked = [];
    for (const [label, id] of [["Environmental Pain", "envpain"], ["Physical Pain", "physpain"],
      ["Socio-economic Pain", "socioecopain"]]) {
      button(label).click();
      await sleep(650);
      check(!profile.hidden && profile.dataset.layer === id, "country lost on layer switch: " + id);
      clickCenter();
      await sleep(100);
      check(profile.hidden, "same country did not clear: " + id);
      clickCenter();
      await sleep(100);
      check(!profile.hidden && profile.querySelector("h2").textContent === "Afghanistan",
        "surface click did not select country: " + id);
      checked.push(id);
    }
    button("Emotional Pain").click();
    await sleep(650);
    check(document.querySelectorAll(".emo-label--emphasis").length === 0,
      "return to emotional view restored an obsolete network");
    check(!profile.hidden, "layer switch lost the country profile");
    return { passed: true, checked, repeatClear: true, surfaceSelection: true, returnNetworkEmpty: true };
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error) };
  }
})()
