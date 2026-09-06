/* Real application draw check for the optional continuous scar-contour pass. */
(async () => {
  const gl = document.querySelector("canvas")?.getContext("webgl2");
  if (!gl) return { passed: false, error: "WebGL2 unavailable" };
  const names = ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"];
  const originals = new Map(names.map((name) => [name, gl[name]]));
  const contourPrograms = new WeakMap();
  let draws = 0;
  let landOnly = null;
  let levels = null;
  for (const name of names) gl[name] = function (...args) {
    const program = gl.getParameter(gl.CURRENT_PROGRAM);
    if (!contourPrograms.has(program)) {
      contourPrograms.set(program, gl.getUniformLocation(program, "uLevels") !== null);
    }
    if (contourPrograms.get(program)) {
      draws++;
      landOnly = gl.getUniform(program, gl.getUniformLocation(program, "uLandOnly"));
      levels = gl.getUniform(program, gl.getUniformLocation(program, "uLevels"));
    }
    return originals.get(name).apply(this, args);
  };
  const rows = [];
  try {
    for (const layer of ["Physical Pain", "Socio-economic Pain", "Environmental Pain",
      "Emotional Pain", "all the pain"]) {
      [...document.querySelectorAll("button")]
        .find((button) => button.textContent.trim() === layer).click();
      await new Promise((resolve) => setTimeout(resolve, 1200));
      draws = 0;
      for (let frame = 0; frame < 12; frame++) await new Promise(requestAnimationFrame);
      rows.push({ layer, contourDraws: draws, landOnly, levels });
    }
    const expected = rows.every(({ layer, contourDraws }) =>
      ["Physical Pain", "all the pain"].includes(layer) ? contourDraws > 0 : contourDraws === 0);
    if (!expected) throw new Error("Contour pass is active on the wrong layer");
    if (rows[0].landOnly !== 1 || rows[0].levels !== 16) {
      throw new Error("Selected land mask or contour interval did not reach the shader");
    }
    if (gl.getError() !== gl.NO_ERROR) throw new Error("WebGL error during contour verification");
    return { passed: true, rows };
  } catch (error) {
    return { passed: false, error: error instanceof Error ? error.stack : String(error), rows };
  } finally {
    for (const [name, original] of originals) gl[name] = original;
  }
})()
