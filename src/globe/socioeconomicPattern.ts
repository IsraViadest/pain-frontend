/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
import type * as THREE from "three";
import type { SocioeconomicMissingStyle } from "./choroplethField";

export type SocioeconomicStyle = "color" | "hatch" | "woven";

const uniformsByMaterial = new WeakMap<THREE.MeshBasicMaterial, {
  minimum: { value: number }; contrast: { value: number };
  missingMap: { value: THREE.Texture | null }; missingActive: { value: number };
  missingCross: { value: number };
}>();

const STRIPES = /* glsl */ `
uniform float uSocioMinimum;
uniform float uSocioContrast;
uniform sampler2D uSocioMissingMap;
uniform float uSocioMissingActive;
uniform float uSocioMissingCross;
float stripeIntegral(float phase, float duty) {
  return floor(phase) * duty + min(fract(phase), duty);
}
float stripe(float phase, float duty) {
  float width = max(fwidth(phase), 0.0001);
  return clamp((stripeIntegral(phase + width * 0.5, duty) -
    stripeIntegral(phase - width * 0.5, duty)) / width, 0.0, 1.0);
}
`;

/** Zero-mean texture contrast preserves the affine color alpha as detail disappears. */
export function applySocioeconomicPattern(
  material: THREE.MeshBasicMaterial,
  style: SocioeconomicStyle | null,
  minimumAlpha: number,
  contrast = 0.25,
  missingStyle?: SocioeconomicMissingStyle,
  missingMap: THREE.Texture | null = null,
): void {
  const patterned = style === "hatch" || style === "woven";
  let uniforms = uniformsByMaterial.get(material);
  if (!uniforms) {
    uniforms = { minimum: { value: 0 }, contrast: { value: 0 },
      missingMap: { value: null }, missingActive: { value: 0 }, missingCross: { value: 0 } };
    uniformsByMaterial.set(material, uniforms);
  }
  uniforms.minimum.value = Math.round(minimumAlpha * 255) / 255;
  uniforms.contrast.value = contrast;
  uniforms.missingMap.value = missingMap;
  uniforms.missingActive.value = missingStyle && missingMap ? 1 : 0;
  uniforms.missingCross.value = missingStyle === "cross" ? 1 : 0;
  // Three reuses cached programs without re-running this hook. Keep their uniform references live,
  // including the unpatterned program's container when switching back to a previously used style.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSocioMinimum = uniforms.minimum;
    shader.uniforms.uSocioContrast = uniforms.contrast;
    shader.uniforms.uSocioMissingMap = uniforms.missingMap;
    shader.uniforms.uSocioMissingActive = uniforms.missingActive;
    shader.uniforms.uSocioMissingCross = uniforms.missingCross;
    if (!patterned && !missingStyle) return;
    shader.fragmentShader = STRIPES + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", /* glsl */ `
      #include <map_fragment>
      #ifdef USE_MAP
        ${patterned ? `
        float value = clamp((diffuseColor.a - uSocioMinimum) / (1.0 - uSocioMinimum), 0.0, 1.0);
        float hasSocioeconomicValue = step(0.2, abs(diffuseColor.g - diffuseColor.b));
        vec2 phase = vMapUv * vec2(720.0, 360.0);
        float x = phase.x + phase.y;
        float y = phase.x - phase.y;
        float duty = ${style === "woven" ? "1.0 - sqrt(1.0 - value)" : "value"};
        float hatch = stripe(x, duty);
        ${style === "woven" ? "hatch = 1.0 - (1.0 - hatch) * (1.0 - stripe(y, duty));" : ""}
        float footprint = ${style === "woven" ? "max(fwidth(x), fwidth(y))" : "fwidth(x)"};
        float detail = 1.0 - smoothstep(0.25, 0.5, footprint);
        diffuseColor.a += hasSocioeconomicValue * uSocioContrast * detail *
          (1.0 - uSocioMinimum) * (hatch - value);
        ` : ""}
        if (uSocioMissingActive > 0.5 && texture2D(uSocioMissingMap, vMapUv).r > 0.5) {
          vec2 missingPhase = vMapUv * vec2(2048.0, 1024.0) / 10.0;
          float missingStripe = stripe(missingPhase.x - missingPhase.y, 0.125);
          if (uSocioMissingCross > 0.5) missingStripe = max(missingStripe,
            stripe(missingPhase.x + missingPhase.y, 0.125));
          diffuseColor.rgb = mix(vec3(0.162), vec3(0.715), missingStripe);
          diffuseColor.a = mix(0.42, 0.78, missingStripe);
        }
      #endif
    `);
  };
  material.customProgramCacheKey = () => `${patterned ? `socioeconomic-${style}` : ""}-${missingStyle ?? ""}`;
  material.needsUpdate = true;
}
