import * as THREE from "three";
import type { IndexedCountryGeometry } from "./countryGeometry";
import { rasterLandMaskFromGeometries } from "./landMaskRaster";

const VERTEX = /* glsl */ `
uniform sampler2D uScarMap;
uniform float uScarScale;
uniform float uScarBias;
uniform float uScarActive;
varying vec3 vDirection;
varying vec3 vWorldPosition;
varying vec3 vWorldDirection;

vec2 fieldUv(vec3 direction) {
  vec3 n = normalize(direction);
  return vec2(fract(atan(n.z, -n.x) * 0.15915494309189535 + 1.0),
    0.5 - asin(clamp(n.y, -1.0, 1.0)) * 0.3183098861837907);
}

void main() {
  vec3 direction = normalize(position);
  float height = texture2D(uScarMap, fieldUv(direction)).r;
  float radial = (height * uScarScale + uScarBias) * uScarActive + 0.002;
  vDirection = direction;
  vWorldPosition = (modelMatrix * vec4(position + direction * radial, 1.0)).xyz;
  vWorldDirection = normalize(mat3(modelMatrix) * direction);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + direction * radial, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uScarMap;
uniform sampler2D uLandMap;
uniform float uScarActive;
uniform float uLandOnly;
uniform float uOpacity;
uniform float uLevels;
uniform vec3 uColor;
uniform vec3 uDeepColor;
uniform float uDepthColor;
varying vec3 vDirection;
varying vec3 vWorldPosition;
varying vec3 vWorldDirection;

vec2 fieldUv(vec3 direction) {
  vec3 n = normalize(direction);
  return vec2(fract(atan(n.z, -n.x) * 0.15915494309189535 + 1.0),
    0.5 - asin(clamp(n.y, -1.0, 1.0)) * 0.3183098861837907);
}

void main() {
  if (uScarActive < 0.5) discard;
  if (dot(normalize(vWorldDirection), normalize(cameraPosition - vWorldPosition)) <= 0.0) discard;
  vec2 uv = fieldUv(vDirection);
  float depth = max(0.0, 0.50196 - texture2D(uScarMap, uv).r);
  if (depth < 0.008) discard;
  if (uLandOnly > 0.5 && texture2D(uLandMap, uv).r < 0.5) discard;
  if (uLandOnly < -0.5 && texture2D(uLandMap, uv).r >= 0.5) discard;
  float phase = depth * uLevels;
  float distanceToLine = abs(fract(phase + 0.5) - 0.5);
  float width = max(fwidth(phase), 0.008);
  float line = 1.0 - smoothstep(0.01, 0.01 + width * 0.8, distanceToLine);
  if (line < 0.01) discard;
  float levelDepth = clamp(floor(phase + 0.5) / (uLevels * (128.0 / 255.0)), 0.0, 1.0);
  vec3 color = mix(uColor, uDeepColor, levelDepth * uDepthColor);
  gl_FragColor = vec4(color, line * uOpacity);
  #include <colorspace_fragment>
}
`;

export type ScarContourStyle = "land-blue" | "all-blue" | "land-red" | "all-red" |
  "water-blue" | "water-coral" | "water-dots" |
  "water-blue-depth" | "water-coral-depth" | "water-dots-depth";

export function createScarContourLayer(
  detail: 1 | 2,
  countries: readonly IndexedCountryGeometry[],
) {
  const mask = rasterLandMaskFromGeometries(countries);
  const maskBytes = new Uint8Array(mask.data.length);
  maskBytes.set(mask.data);
  const landMap = new THREE.DataTexture(
    maskBytes,
    mask.w,
    mask.h,
    THREE.RGBAFormat,
  );
  landMap.flipY = false;
  landMap.wrapS = THREE.RepeatWrapping;
  landMap.minFilter = landMap.magFilter = THREE.LinearFilter;
  landMap.colorSpace = THREE.NoColorSpace;
  landMap.needsUpdate = true;
  const neutral = new THREE.DataTexture(new Uint8Array([128]), 1, 1, THREE.RedFormat);
  neutral.needsUpdate = true;
  const geometry = new THREE.SphereGeometry(1, 192 * detail, 128 * detail);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uScarMap: { value: neutral },
      uLandMap: { value: landMap },
      uScarScale: { value: 0 },
      uScarBias: { value: 0 },
      uScarActive: { value: 0 },
      uLandOnly: { value: 1 },
      uOpacity: { value: 0.52 },
      uLevels: { value: 24 },
      uColor: { value: new THREE.Color(0x88a9dc) },
      uDeepColor: { value: new THREE.Color(0x304f88) },
      uDepthColor: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    toneMapped: false,
  });
  const object = new THREE.Mesh(geometry, material);
  object.name = "scar-contours";
  object.renderOrder = 2.2;
  object.frustumCulled = false;
  object.visible = false;

  return {
    object,
    setStyle(style: ScarContourStyle): void {
      const color = style.replace(/-depth$/, "");
      material.uniforms.uLandOnly.value = style.startsWith("water") ? -1 : style.startsWith("land") ? 1 : 0;
      material.uniforms.uColor.value.set(color.endsWith("dots") ? 0xe4184b :
        color.endsWith("red") || color.endsWith("coral") ? 0xff7888 : 0x88a9dc);
      material.uniforms.uDeepColor.value.set(color.endsWith("dots") ? 0x94102f :
        color.endsWith("coral") ? 0xad3e53 : 0x304f88);
      material.uniforms.uDepthColor.value = style.endsWith("-depth") ? 1 : 0;
    },
    setLevels(levels: 16 | 24): void {
      material.uniforms.uLevels.value = levels;
    },
    setField(map: THREE.DataTexture | null, scale: number, bias: number): void {
      material.uniforms.uScarMap.value = map ?? neutral;
      material.uniforms.uScarScale.value = map ? scale : 0;
      material.uniforms.uScarBias.value = map ? bias : 0;
      material.uniforms.uScarActive.value = map ? 1 : 0;
      object.visible = map !== null;
    },
    stats() {
      const arrays = [geometry.index, ...Object.values(geometry.attributes)]
        .filter((attribute): attribute is THREE.BufferAttribute => attribute instanceof THREE.BufferAttribute);
      const geometryBytes = arrays.reduce((sum, attribute) => sum + attribute.array.byteLength, 0);
      return { additionalBytes: 2 * geometryBytes + mask.data.byteLength * 2 + 4096 };
    },
    dispose(): void {
      object.removeFromParent();
      geometry.dispose();
      material.dispose();
      landMap.dispose();
      neutral.dispose();
    },
  };
}
