import * as THREE from "three";
import { rasterLandMaskFromCountries } from "./landMaskRaster";

const OCEAN_FILL_VS = /* glsl */ `
varying vec2 vUvMask;
varying float vFacing;

void main() {
  vec3 dir = normalize(position);
  float uRaw = atan(dir.z, -dir.x) * 0.15915494309189533577;
  if (uRaw < 0.0) uRaw += 1.0;
  if (uRaw >= 1.0) uRaw -= 1.0;
  float vRaw = 0.5 - asin(clamp(dir.y, -1.0, 1.0)) * 0.31830988618379067154;
  vUvMask = vec2(uRaw, vRaw);

  vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 worldNormal = normalize(mat3(modelMatrix) * dir);
  vec3 worldViewDir = normalize(cameraPosition - worldPos);
  vFacing = dot(worldNormal, worldViewDir);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const OCEAN_FILL_FS = /* glsl */ `
uniform sampler2D uLandMask;
uniform vec3 uFillColor;
uniform float uFacingCullMin;
varying vec2 vUvMask;
varying float vFacing;

void main() {
  if (vFacing < uFacingCullMin) discard;
  if (texture2D(uLandMask, vUvMask).r > 0.5) discard;
  gl_FragColor = vec4(uFillColor, 1.0);
}
`;

/** Neutral stub until GeoJSON mask loads. */
function createStubLandMaskTexture(): THREE.DataTexture {
  const data = new Uint8Array([0]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

export function createOceanFillMaterial(
  fillColor: THREE.Color,
  facingCullMin: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLandMask: { value: createStubLandMaskTexture() },
      uFillColor: { value: fillColor.clone() },
      uFacingCullMin: { value: facingCullMin },
    },
    vertexShader: OCEAN_FILL_VS,
    fragmentShader: OCEAN_FILL_FS,
    depthWrite: false,
    depthTest: true,
    transparent: false,
  });
}

export async function loadOceanFillLandMask(
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
