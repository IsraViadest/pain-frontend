import type * as THREE from "three";

export type SocioeconomicStyle = "color" | "hatch" | "woven";

const uniformsByMaterial = new WeakMap<THREE.MeshBasicMaterial, {
  minimum: { value: number }; contrast: { value: number };
}>();

const STRIPES = /* glsl */ `
uniform float uSocioMinimum;
uniform float uSocioContrast;
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
): void {
  const patterned = style === "hatch" || style === "woven";
  let uniforms = uniformsByMaterial.get(material);
  if (!uniforms) {
    uniforms = { minimum: { value: 0 }, contrast: { value: 0 } };
    uniformsByMaterial.set(material, uniforms);
  }
  uniforms.minimum.value = Math.round(minimumAlpha * 255) / 255;
  uniforms.contrast.value = contrast;
  // Three reuses cached programs without re-running this hook. Keep their uniform references live,
  // including the unpatterned program's container when switching back to a previously used style.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSocioMinimum = uniforms.minimum;
    shader.uniforms.uSocioContrast = uniforms.contrast;
    if (!patterned) return;
    shader.fragmentShader = STRIPES + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", /* glsl */ `
      #include <map_fragment>
      #ifdef USE_MAP
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
      #endif
    `);
  };
  material.customProgramCacheKey = () => patterned ? `socioeconomic-${style}` : "";
  material.needsUpdate = true;
}
