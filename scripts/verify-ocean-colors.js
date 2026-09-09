/* created by: Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 * Run with the existing eval.mjs helper against the local preview. */
(async () => {
  const gl = document.querySelector("canvas")?.getContext("webgl2");
  if (!gl) return { passed: false, error: "WebGL2 unavailable" };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const close = (a, b) => a?.length === b?.length && a.every((value, i) => Math.abs(value - b[i]) < 1e-6);
  const methods = ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"];
  const originals = new Map(methods.map(name => [name, gl[name]]));
  let sample;
  for (const name of methods) gl[name] = function (...args) {
    const program = gl.getParameter(gl.CURRENT_PROGRAM);
    if (gl.getUniformLocation(program, "uOceanColor") !== null) {
      const read = key => Array.from(gl.getUniform(program, gl.getUniformLocation(program, key)));
      sample = { ocean: read("uOceanColor"), tint: read("uTint"), shade: read("uShadeBase") };
    }
    return originals.get(name).apply(this, args);
  };
  const rows = [];
  const themeButton = document.querySelector('[data-metric-target="theme"]');
  const initialBlue = themeButton?.getAttribute("aria-pressed") === "true";
  const initialLayer = document.querySelector("button[data-layer].blob-button--active");
  try {
    if (!themeButton || !initialLayer) throw Error("Preview controls missing");
    for (const blue of [false, true]) {
      if ((themeButton.getAttribute("aria-pressed") === "true") !== blue) themeButton.click();
      let emotional;
      for (const layer of ["emopain", "envpain", "physpain", "socioecopain", "all-pain"]) {
        const button = document.querySelector(`button[data-layer="${layer}"]`);
        if (!button) throw Error("Missing layer " + layer);
        if (!button.classList.contains("blob-button--active")) button.click();
        await wait(1400);
        sample = undefined;
        for (let frame = 0; frame < 3; frame++) await new Promise(requestAnimationFrame);
        if (!sample) throw Error("Ocean material did not draw");
        if (layer === "emopain") {
          emotional = sample.tint.map((value, i) => .72 * value + .28 * sample.shade[i]);
        }
        if (!close(sample.ocean, emotional)) throw Error("Ocean differs from Emotional in " + layer);
        rows.push({ theme: blue ? "blue" : "dark", layer, ocean: sample.ocean });
      }
    }
    if (gl.getError() !== gl.NO_ERROR) throw Error("WebGL error");
    return { passed: true, rows };
  } catch (error) {
    return { passed: false, error: String(error), rows };
  } finally {
    for (const [name, original] of originals) gl[name] = original;
    if (themeButton && (themeButton.getAttribute("aria-pressed") === "true") !== initialBlue) themeButton.click();
    if (initialLayer && !initialLayer.classList.contains("blob-button--active")) initialLayer.click();
  }
})()
