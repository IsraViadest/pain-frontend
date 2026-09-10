/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
// Final retained comparisons. Print recipes by default; --capture writes only new PNGs.
// Existing shot.mjs owns and closes each fresh Chrome profile. No additional browser dependency.
// ponytail: run browser helpers sequentially; coordinate their debug-port allocation before
// allowing this capture alongside eval.mjs, whose randomly chosen port can collide.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const helper = path.join(root, "artifacts/emo-views/shot.mjs");
const directory = path.join(root, "artifacts/country-pain-profile/gallery");
const groups = [
  [8, ["control_current-profile", "a_compact-small", "b_compact-medium", "c_compact-large"]],
  [9, ["control_inset-88", "a_inset-84", "b_inset-92"]],
  [10, ["control_plate-36", "a_plate-24", "b_plate-48"]],
  [11, ["control_quiet-translation", "a_native-only", "b_softer-native", "c_compact-base"]],
  [12, ["control_scar-original", "a_scar-rounded", "b_surface-refined", "c_soft-surface"]],
  [13, ["control_shared-contours", "a_gentle-contours", "b_rounded-contours"]],
  [14, ["control_equal-peers", "a_half-peers", "b_stronger-peers"]],
  [15, ["control_original-dots", "a_dot-regrowth", "b_four-child-dots", "c_two-level-dots"]],
  [16, ["control_flat-palette", "a_atmospheric-mantle", "b_cloudlets", "c_volume-32",
    "d_volume-16", "e_volume-48", "f_mantle-air", "g_volume-air", "h_cloudlet-air", "i_volume-air-16"]],
  [17, ["control_original-yellow", "a_visible-minimum", "b_fine-hatching", "c_woven-texture",
    "d_color-quiet", "e_hatch-quiet", "f_woven-quiet", "g_soft-hatching"]],
  [18, ["a_composed", "b_clear-chrome"]],
];
const recipes = groups.flatMap(([round, variants]) => variants.map((variant) => {
  const id = `v${round}-${variant}`;
  const physical = round === 12 || round === 15, socioeconomic = round === 13 || round === 17;
  return { id, preset: id, width: 1500, height: 950, dpr: 1,
    layer: physical ? "Physical Pain" : socioeconomic ? "Socio-economic Pain" :
      round === 14 ? "Emotional Pain" : round === 16 ? "Environmental Pain" : null,
    camera: physical ? "20,78,1.35" : socioeconomic ? "48,10,1.35" : "20,78,2.35",
    selected: round <= 11 || round === 14 || round === 18,
    quality: round === 18 ? "standard" : null };
}));
const final = { preset: "v18-b_clear-chrome", width: 1500, height: 950, dpr: 1,
  camera: "20,78,2.35", layer: null, selected: true, quality: "standard" };
for (const [suffix, overrides] of [
  ["rest", { selected: false }],
  ["dark-theme", { theme: "dark" }],
  ["emotional", { layer: "Emotional Pain" }],
  ["environmental", { layer: "Environmental Pain", selected: false }],
  ["physical-close", { layer: "Physical Pain", camera: "20,78,1.35", selected: false }],
  ["socioeconomic-close", { layer: "Socio-economic Pain", camera: "48,10,1.35", selected: false }],
  ["phone", { width: 393, height: 852, dpr: 2, quality: "light" }],
  ["phone-emotional", { width: 393, height: 852, dpr: 2, quality: "light", layer: "Emotional Pain" }],
  ["narrow-emotional", { width: 320, height: 740, dpr: 2, quality: "light", layer: "Emotional Pain" }],
  ["landscape-emotional", { width: 568, height: 320, dpr: 2, quality: "light",
    surface: true, layer: "Emotional Pain" }],
]) recipes.push({ ...final, ...overrides, id: `${final.preset}--${suffix}` });

const capture = process.argv.includes("--capture");
const requested = process.argv.slice(2).filter((value) => value !== "--capture");
for (const id of requested) if (!recipes.some((recipe) => recipe.id === id)) throw Error(`Unknown recipe: ${id}`);
const chosen = requested.length ? recipes.filter((recipe) => requested.includes(recipe.id)) : recipes;
for (const recipe of chosen) {
  const url = new URL("http://127.0.0.1:3000/");
  for (const [key, value] of Object.entries({ cp: 1, cpPreset: recipe.preset,
    freeze: 1, cam: recipe.camera, cpQuality: recipe.quality })) {
    if (value !== null) url.searchParams.set(key, String(value));
  }
  const output = path.join(directory, `${recipe.id}.png`);
  console.log(JSON.stringify({ ...recipe, url: url.href, output }));
  if (!capture) continue;
  if (existsSync(output)) { console.log(`Preserved ${recipe.id}`); continue; }
  const before = `(async () => {
    const recipe=${JSON.stringify(recipe)};
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    if(recipe.theme && document.documentElement.dataset.theme!==recipe.theme)
      document.querySelector('#theme-toggle').click();
    if(recipe.theme && document.documentElement.dataset.theme!==recipe.theme)
      throw Error('Requested theme did not apply');
    if(recipe.layer) {
      const button=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===recipe.layer);
      if(!button)throw Error('Layer control unavailable');
      button.click();await sleep(2200);
    }
    await document.fonts.ready;
    if(recipe.selected) {
      const label=document.querySelector('.emo-label[data-iso3="IND"]');
      const r=label.getBoundingClientRect(),clientX=recipe.surface?innerWidth/2:r.x+r.width/2,
        clientY=recipe.surface?innerHeight/2:r.y+r.height/2;
      if(recipe.surface) {
        if(document.elementFromPoint(clientX,clientY)!==document.querySelector('canvas'))
          throw Error('Country surface covered by a control');
      } else if(getComputedStyle(label).visibility==='hidden')throw Error('India label hidden');
      document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX,clientY}));
      document.querySelector('canvas').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX,clientY}));
      await sleep(1800);
      const profile=document.querySelector('#country-profile');
      if(profile.hidden||profile.querySelector('h2').textContent!=='India')throw Error('India selection failed');
    }
    const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2');
    if(gl.isContextLost()||gl.getError()!==gl.NO_ERROR)throw Error('WebGL error');
    if(canvas.width!==innerWidth*devicePixelRatio)throw Error('Incorrect drawing buffer width');
    return {ready:true,theme:document.documentElement.dataset.theme};
  })()`;
  const result = spawnSync(process.execPath, [helper, url.href, output, "9500",
    String(recipe.width), String(recipe.height), before, "500", String(recipe.width * recipe.dpr),
    String(recipe.dpr)], { encoding: "utf8", maxBuffer: 1024 * 1024 });
  if (result.status !== 0 || !existsSync(output)) {
    throw Error(`Capture failed: ${recipe.id}\n${result.stderr}\n${result.stdout}`);
  }
  console.log(`Saved ${recipe.id}`);
}
