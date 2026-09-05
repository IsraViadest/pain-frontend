/* Real application draws: atmospheric passes must stop outside all/environmental layers. */
(async () => {
  const gl = document.querySelector("canvas").getContext("webgl2");
  const names = ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"];
  const originals = new Map(names.map((name) => [name, gl[name]]));
  const volumePrograms = new WeakMap();
  let draws = 0;
  for (const name of names) gl[name] = function (...args) {
    const program = gl.getParameter(gl.CURRENT_PROGRAM);
    if (!volumePrograms.has(program)) {
      volumePrograms.set(program, gl.getUniformLocation(program, "uVolume") !== null);
    }
    if (volumePrograms.get(program)) draws++;
    return originals.get(name).apply(this, args);
  };
  const rows = [];
  try {
    for (const layer of ["Environmental Pain", "Socio-economic Pain", "Physical Pain",
      "Emotional Pain", "all the pain", "Socio-economic Pain"]) {
      [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === layer).click();
      await new Promise((resolve) => setTimeout(resolve, 1800));
      draws = 0;
      for (let frame = 0; frame < 12; frame++) await new Promise(requestAnimationFrame);
      rows.push({ layer, volumeDraws: draws });
    }
    return { passed: rows.every(({ layer, volumeDraws }) =>
      ["Environmental Pain", "all the pain"].includes(layer) ? volumeDraws > 0 : volumeDraws === 0), rows };
  } finally {
    for (const [name, original] of originals) gl[name] = original;
  }
})().catch((error) => ({ passed: false, error: String(error.stack ?? error) }))
