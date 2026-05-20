import * as THREE from "three";
import { rasterLandMaskFromCountries } from "./landMaskRaster";

/** Same scar dent math as earthStippleGlobe.ts VS (keeps shell shape aligned). */
const SUBSTRATE_VS = /* glsl */ `
uniform sampler2D uLandMask;
uniform sampler2D uScarMap;
uniform float uScarDispScale;
uniform float uScarDispBias;
uniform float uScarActive;
uniform float uScarLandOnly;
/** Push depth slightly inward so stipple dots / lines on the surface pass depthTest. */
uniform float uDepthInset;
uniform float uFacingCullMin;

varying vec2 vUvMask;
varying float vFacing;

void main() {
  vec3 dir = normalize(position);
  float uRaw = atan(dir.z, -dir.x) * 0.15915494309189533577;
  if (uRaw < 0.0) uRaw += 1.0;
  if (uRaw >= 1.0) uRaw -= 1.0;
  float vRaw = 0.5 - asin(clamp(dir.y, -1.0, 1.0)) * 0.31830988618379067154;
  vUvMask = vec2(uRaw, vRaw);

  float h = texture2D(uScarMap, vUvMask).r;
  float land = step(0.5, texture2D(uLandMask, vUvMask).r);
  float scarMask = mix(1.0, land, step(0.5, uScarLandOnly));
  float radial = (h * uScarDispScale + uScarDispBias) * uScarActive * scarMask;
  vec3 displacedPos = position + dir * radial;
  vec3 depthPos = displacedPos - dir * uDepthInset;

  vec3 worldPos = (modelMatrix * vec4(displacedPos, 1.0)).xyz;
  vec3 worldNormal = normalize(mat3(modelMatrix) * dir);
  vec3 worldViewDir = normalize(cameraPosition - worldPos);
  vFacing = dot(worldNormal, worldViewDir);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(depthPos, 1.0);
}
`;

const SUBSTRATE_FS = /* glsl */ `
uniform sampler2D uLandMask;
uniform vec3 uLandColor;
uniform vec3 uOceanColor;
uniform float uFacingCullMin;
varying vec2 vUvMask;
varying float vFacing;

void main() {
  if (vFacing < uFacingCullMin) discard;
  float land = step(0.5, texture2D(uLandMask, vUvMask).r);
  vec3 col = mix(uOceanColor, uLandColor, land);
  gl_FragColor = vec4(col, 1.0);
}
`;

function createStubLandMaskTexture(): THREE.DataTexture {
  const data = new Uint8Array([0]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

function createNeutralScarTexture(): THREE.DataTexture {
  const data = new Uint8Array([128, 128, 128, 255]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

export function createStippleSubstrateMaterial(
  landColor: THREE.Color,
  oceanColor: THREE.Color,
  facingCullMin: number,
  depthInset: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLandMask: { value: createStubLandMaskTexture() },
      uScarMap: { value: createNeutralScarTexture() },
      uScarDispScale: { value: 0 },
      uScarDispBias: { value: 0 },
      uScarActive: { value: 0 },
      uScarLandOnly: { value: 0 },
      uDepthInset: { value: depthInset },
      uLandColor: { value: landColor.clone() },
      uOceanColor: { value: oceanColor.clone() },
      uFacingCullMin: { value: facingCullMin },
    },
    vertexShader: SUBSTRATE_VS,
    fragmentShader: SUBSTRATE_FS,
    depthWrite: true,
    depthTest: true,
    transparent: false,
    clipping: true,
    clipIntersection: false,
  });
}

export async function loadStippleSubstrateLandMask(
  geojsonUrl: string,
  sampleW = 512,
  sampleH = 256,
): Promise<THREE.DataTexture> {
  const land = await rasterLandMaskFromCountries(geojsonUrl, sampleW, sampleH);
  const tex = new THREE.DataTexture(land.data, land.w, land.h, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Match earthStippleGlobe FS base colors (no heat, no frontFactor). */
export function stippleSubstrateColorsFromTint(
  shadeBase: THREE.Vector3,
  tint: THREE.Vector3,
  landTint: THREE.Vector3,
  landTintStrength: number,
): { land: THREE.Color; ocean: THREE.Color } {
  const baseCol = shadeBase
    .clone()
    .multiplyScalar(0.86)
    .lerp(tint, 0.54);
  const ocean = shadeBase.clone().lerp(tint, 0.72);
  const land = baseCol
    .clone()
    .lerp(landTint, 0.45 + 0.4 * landTintStrength);
  land.multiplyScalar(1.1);
  return { land: new THREE.Color(land.x, land.y, land.z), ocean: new THREE.Color(ocean.x, ocean.y, ocean.z) };
}
