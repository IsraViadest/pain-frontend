/* Whole-label occlusion behind real chrome, including clear and restoration. Use cam=20,78,2.35. */
(async () => {
  const changed = [];
  try {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const check = (value, message) => { if (!value) throw Error(message); };
    const host = document.querySelector("#emo-label-host");
    check(host.dataset.occlusion === "on", "Use the chrome-occlusion preset");
    const selectors = "#ui-title,#ui-layer-stack,#ui-share-pain,#ui-bottom-left,#ui-legend,#emo-legend,#country-profile";
    const labels = [...host.querySelectorAll(".emo-label")];
    const visible = (el) => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return s.visibility === "visible" && Number(s.opacity) > 0.03 && r.width > 0 && r.height > 0 &&
        r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
    };
    const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const painted = () => labels.filter(visible);
    const collisions = () => {
      const chrome = [...document.querySelectorAll(selectors)].filter(visible);
      return painted().filter((label) => chrome.some((el) =>
        overlap(label.getBoundingClientRect(), el.getBoundingClientRect()))).map((el) => el.dataset.iso3);
    };
    await sleep(1200);
    check(collisions().length === 0, "Resting globe labels overlap chrome: " + collisions());
    const before = painted().length;
    for (const el of document.querySelectorAll(selectors)) {
      changed.push([el, el.style.visibility]);
      el.style.visibility = "hidden";
    }
    await sleep(1200);
    const unoccluded = painted().length;
    check(unoccluded > before, "Removing chrome did not restore occluded country words");
    for (const [el, value] of changed) el.style.visibility = value;
    changed.length = 0;
    await sleep(1200);
    check(painted().length === before && collisions().length === 0, "Chrome restoration changed the drawn set");
    const canvas = document.querySelector("canvas");
    const click = (x, y) => {
      document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: x, clientY: y }));
      canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
    };
    const india = host.querySelector('[data-iso3="IND"]');
    check(visible(india), "India label is not exposed at this camera");
    const r = india.getBoundingClientRect();
    click(r.left + r.width / 2, r.top + r.height / 2);
    await sleep(2200);
    check(document.querySelector(".country-profile__country").textContent === "India", "Country hit did not select India");
    check(collisions().length === 0, "Selected labels overlap the profile or controls");
    const hiddenEmphasis = labels.filter((el) => !visible(el) && el.classList.contains("emo-label--emphasis")).length;
    click(-20, -20);
    await sleep(1600);
    const staleEmphasis = labels.filter((el) => el.classList.contains("emo-label--emphasis"));
    check(staleEmphasis.length === 0, "Hidden label emphasis survived clear: " + staleEmphasis.map((el) => el.dataset.iso3));
    return { passed: true, visibleWithChrome: before, visibleWithoutChrome: unoccluded,
      hiddenEmphasisDuringSelection: hiddenEmphasis, staleEmphasisAfterClear: 0, fullWords: true };
  } catch (error) {
    return { passed: false, error: String(error.stack ?? error) };
  } finally {
    for (const [el, value] of changed) el.style.visibility = value;
  }
})()
