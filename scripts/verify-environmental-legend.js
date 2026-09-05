/* Real generated legend: colors, responsive placement, and wheel routing. */
(async () => {
  try {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const host = document.querySelector("#ui-legend");
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Environmental Pain").click();
    let ready = false;
    for (let attempt = 0; attempt < 240; attempt++) {
      await sleep(25);
      if (host.querySelector("svg") && host.dataset.layer === "envpain" &&
          Math.abs(new DOMMatrixReadOnly(getComputedStyle(host).transform).m41) < 0.01) {
        ready = true; break;
      }
    }
    if (!ready) throw Error("environmental SVG did not settle");
    const svg = host.querySelector("svg");
    const colors = [...svg.querySelectorAll("stop")].map((stop) => stop.getAttribute("stop-color"));
    const legendRect = host.getBoundingClientRect();
    const share = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("share your pain"));
    const shareRect = share.getBoundingClientRect();
    const overlap = legendRect.left < shareRect.right && legendRect.right > shareRect.left &&
      legendRect.top < shareRect.bottom && legendRect.bottom > shareRect.top;
    const x = legendRect.left + legendRect.width / 2, y = legendRect.top + legendRect.height / 2;
    const wheel = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 0 });
    const hit = document.elementFromPoint(x, y);
    hit.dispatchEvent(wheel);
    const { showLegend } = await import("/src/ui/legend.ts");
    // Vite can give this direct import a different timestamp from the app's module instance.
    // Exercise registration and restoration in one instance; the menu probe covers the app path.
    showLegend("envpain", svg);
    await sleep(450);
    showLegend(" envpain ");
    await sleep(450);
    const cachedSvgRestored = host.querySelector("svg") === svg;
    showLegend("envpain", null);
    await sleep(450);
    showLegend("envpain");
    await sleep(450);
    const oldImageRestored = !!host.querySelector('img[src$="environmental_legend.svg"]');
    showLegend("envpain", svg);
    await sleep(450);
    return { passed: !overlap && wheel.defaultPrevented && cachedSvgRestored && oldImageRestored &&
      colors.join(",") === "#d74846,#d74846,#69c99c,#69c99c",
    colors, overlap, wheelDefaultPrevented: wheel.defaultPrevented, hit: hit.tagName,
    cachedSvgRestored, oldImageRestored,
    legend: [legendRect.left, legendRect.top, legendRect.width, legendRect.height],
    share: [shareRect.left, shareRect.top, shareRect.width, shareRect.height], viewport: [innerWidth, innerHeight] };
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error) };
  }
})()
