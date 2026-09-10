/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/**
 * Fading a line out as it passes round the back of the globe.
 *
 * Depth testing alone does not do this, and the reason is geometric rather than a bug. In
 * all-layers mode the base globe becomes an invisible depth mask scaled to 0.994
 * (`GLOBE_DEPTH_MASK_SCALE`), while arcs ride at roughly 1.05. Any point whose distance from the
 * view axis falls between those two radii has nothing in front of it, so a ring of far-side line
 * leaks out past the globe's silhouette. Raising the mask is not available: it belongs to
 * GlobeView, which this feature does not modify.
 *
 * So the lines fade the way the labels do, on the same two parameters, computed per vertex on the
 * GPU. `facingMin` and `fadeStart` therefore mean one thing for text and line alike, and a slider
 * that hides a label at the limb hides the arc reaching it at the same moment.
 *
 * The patch is asserted rather than attempted: a shader anchor that stops matching after a three
 * upgrade would silently restore the leak, which is the failure this module exists to remove.
 */
import * as THREE from "three";
import type { LineMaterial } from "three/addons/lines/LineMaterial.js";
import type { EmoViewParams } from "./viewParams";

/** `x` is the facing at which a line is fully gone, `y` the facing at which it is fully drawn. */
type EmoFadeUniform = { value: THREE.Vector2 };

const VERT_ANCHOR = "vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );";
const FRAG_ANCHOR = "gl_FragColor = vec4( diffuseColor.rgb, alpha );";

/**
 * The globe centre is the origin of the model this line belongs to, and the camera is the origin
 * of view space, so both directions are available without extra uniforms. A view transform is
 * rigid, so the dot product of two directions is the same in view space as in world space, which
 * is what makes this identical to the label layer's `dir . normalize(camera.position)`.
 */
const VERT_INSERT = `
  vec3 emoCentre = ( modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
  vec3 emoPoint = ( position.y < 0.5 ) ? start.xyz : end.xyz;
  vEmoFacing = dot( normalize( emoPoint - emoCentre ), normalize( - emoCentre ) );
`;

/** GLSL smoothstep is exactly `ramp` from layout.ts: the same clamp and the same v*v*(3-2v). */
const FRAG_REPLACE =
  "gl_FragColor = vec4( diffuseColor.rgb, alpha * smoothstep( uEmoFade.x, uEmoFade.y, vEmoFacing ) );";

export function makeEmoFadeUniform(params: EmoViewParams): EmoFadeUniform {
  return { value: new THREE.Vector2(params.facingMin, params.fadeStart) };
}

/** Point the uniform at the current parameters. Cheap enough to call on every slider drag. */
export function updateEmoFadeUniform(uniform: EmoFadeUniform, params: EmoViewParams): void {
  uniform.value.set(params.facingMin, params.fadeStart);
}

/**
 * Patch one LineMaterial so its alpha follows the same limb fade as the labels.
 *
 * The uniform is attached to the material as well as to the compiled shader because LineMaterial
 * is a ShaderMaterial: which of the two objects the renderer reads from is an implementation
 * detail, and both here point at the same value, so updating it works either way.
 */
export function applyEmoFacingFade(material: LineMaterial, uniform: EmoFadeUniform): void {
  const shaderMaterial = material as unknown as { uniforms: Record<string, unknown> };
  shaderMaterial.uniforms.uEmoFade = uniform;
  material.onBeforeCompile = (shader): void => {
    if (!shader.vertexShader.includes(VERT_ANCHOR) || !shader.fragmentShader.includes(FRAG_ANCHOR)) {
      throw new Error(
        "[emoFacingFade] LineMaterial's shader no longer contains the expected anchors, so the " +
          "far-side fade would silently do nothing. Re-read three/addons/lines/LineMaterial.js.",
      );
    }
    shader.uniforms.uEmoFade = uniform as unknown as THREE.IUniform;
    shader.vertexShader =
      "varying float vEmoFacing;\n" +
      shader.vertexShader.replace(VERT_ANCHOR, VERT_ANCHOR + VERT_INSERT);
    shader.fragmentShader =
      "varying float vEmoFacing;\nuniform vec2 uEmoFade;\n" +
      shader.fragmentShader.replace(FRAG_ANCHOR, FRAG_REPLACE);
  };
}
