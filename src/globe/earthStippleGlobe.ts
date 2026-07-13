/**
 * SHELL: stipple points (THREE.Points on a sphere).
 * Created by GlobeView.ensureStipple() → createEarthStippleGlobe().
 * Scar mode: vertex shader displaces land dots; fragment shader applies heat tint.
 * Parent: earthContent group (same rotation as globe shell).
 */
import * as THREE from "three";
import { unitDirectionToGlobeEquirectUV } from "./globeEquirectUV";
import { rasterLandMaskFromCountries } from "./landMaskRaster";
import { createNeutralHeatTexture } from "./painHeatField";

/** Same Natural Earth source as vector coastlines / borders (WGS84 plate-carrée). */
export const STIPPLE_LAND_MASK_GEOJSON_URL =
  `${import.meta.env.BASE_URL}borders/ne_110m_admin_0_countries.geojson?v=4`;

/** Fallback only if the local GeoJSON mask cannot be loaded. */
const STIPPLE_LAND_TEXTURE_URL =
  "https://threejs.org/examples/textures/planets/earth_specular_2048.jpg";

/**
 * Stipple vertex shader inlines the same plate-carrée equirect UV as
 * {@link unitDirectionToGlobeEquirectUV} in globeEquirectUV.ts (GLSL cannot import TS).
 */
const VS = /* glsl */ `
// 1/(2π) and 1/π — equirect U/V from unit direction (matches globeEquirectUV.ts).
const float EQUIRECT_INV_TWO_PI = 0.15915494309189533577;
const float EQUIRECT_INV_PI = 0.31830988618379067154;

attribute float aLand;
varying float vLand;
varying float vFresnel;
varying float vFacing;
varying vec2 vHeatUv;
uniform float uPixelRatio;
uniform float uOceanPointScale;
uniform sampler2D uScarMap;
uniform float uScarDispScale;
uniform float uScarDispBias;
uniform float uScarActive;
/** 1 = dents on land only; 0 = ocean + land (same shell — reduces “inner sphere”). */
uniform float uScarLandOnly;
/** Discard points with dot(normal, viewDir) below this (no hardware clip — avoids limb artifacts). */
uniform float uFacingCullMin;

void main() {
  vec3 dir = normalize(position);
  float uRaw = atan(dir.z, -dir.x) * EQUIRECT_INV_TWO_PI;
  if (uRaw < 0.0) uRaw += 1.0;
  if (uRaw >= 1.0) uRaw -= 1.0;
  float vRaw = 0.5 - asin(clamp(dir.y, -1.0, 1.0)) * EQUIRECT_INV_PI;
  vec2 scarUv = vec2(uRaw, vRaw);
  float h = texture2D(uScarMap, scarUv).r;
  // Scar dents apply to land only; ocean stays at base radius → recessed land reads as a
  // smaller dark “inner sphere” when ocean alpha is low (not a separate THREE.Mesh).
  float landW = step(0.5, aLand);
  float scarMask = mix(1.0, landW, step(0.5, uScarLandOnly));
  float radial = (h * uScarDispScale + uScarDispBias) * uScarActive * scarMask;
  vec3 displacedPos = position + dir * radial;
  vec3 dispDir = normalize(displacedPos);
  float uHeat = atan(dispDir.z, -dispDir.x) * EQUIRECT_INV_TWO_PI;
  if (uHeat < 0.0) uHeat += 1.0;
  if (uHeat >= 1.0) uHeat -= 1.0;
  float vHeat = 0.5 - asin(clamp(dispDir.y, -1.0, 1.0)) * EQUIRECT_INV_PI;
  vHeatUv = vec2(uHeat, vHeat);

  vec3 worldPos = (modelMatrix * vec4(displacedPos, 1.0)).xyz;
  vec3 worldNormal = normalize(mat3(modelMatrix) * dir);
  vec3 worldViewDir = normalize(cameraPosition - worldPos);
  vFacing = dot(worldNormal, worldViewDir);
  if (vFacing < uFacingCullMin) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }

  vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vec3 viewDir = normalize(-mvPosition.xyz);
  vFresnel = pow(1.0 - clamp(abs(dot(n, viewDir)), 0.0, 1.0), 2.0);
  vLand = aLand;
  float landMask = vLand;
  float frontSize = 2.55;
  float rimSize = 1.55;
  float sizeByView = mix(frontSize, rimSize, smoothstep(0.0, 1.0, vFresnel));
  // Same screen size for land and ocean so scar dents read equally on both (large land
  // sprites previously hid deformation and looked like a separate shell).
  float baseSize = sizeByView * 0.72;
  gl_PointSize = baseSize * uPixelRatio;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FS = /* glsl */ `
uniform vec3 uTint;
uniform vec3 uShadeBase;
uniform vec3 uLandTint;
uniform float uLandTintStrength;
uniform float uOceanAlphaBoost;
uniform float uOceanAlphaMin;
uniform sampler2D uHeatMap;
uniform float uHeatActive;
uniform float uHeatStrength;
uniform vec3 uHeatCool;
uniform vec3 uHeatHot;
uniform float uShowLand;
uniform float uShowOcean;
uniform float uFacingCullMin;
varying float vLand;
varying float vFresnel;
varying float vFacing;
varying vec2 vHeatUv;

void main() {
  if (vFacing < uFacingCullMin) discard;
  vec2 c = gl_PointCoord - vec2(0.5);
  float r = length(c);
  if (r > 0.5) discard;
  float disk = 1.0 - smoothstep(0.38, 0.5, r);
  float frontFactor = smoothstep(-0.05, 0.65, vFacing);
  float landMask = vLand;
  if (landMask > 0.5 && uShowLand < 0.5) discard;
  if (landMask < 0.5 && uShowOcean < 0.5) discard;
  float landFrontMix = landMask * (0.34 + 0.66 * frontFactor);

  vec3 baseCol = mix(uShadeBase * 0.86, uTint, 0.54);
  vec3 waterCol = mix(uShadeBase, uTint, 0.72);
  waterCol *= (0.9 + 0.1 * frontFactor);
  vec3 landCol = mix(baseCol, uLandTint, 0.45 + 0.4 * uLandTintStrength);
  landCol *= (0.98 + 0.26 * frontFactor);
  float heat = texture2D(uHeatMap, vHeatUv).r * uHeatActive;
  heat = pow(clamp(heat, 0.0, 1.0), 0.82);
  vec3 heatCol = mix(uHeatCool, uHeatHot, heat);
  float heatMix = clamp(heat * uHeatStrength, 0.0, 1.0) * landMask;
  landCol = mix(landCol, heatCol, heatMix);
  vec3 col = mix(waterCol, landCol, landFrontMix);

  float alphaWater = max(
    min(disk * (0.1 + 0.35 * frontFactor) * uOceanAlphaBoost, 1.0),
    uOceanAlphaMin
  );
  float alphaLand = disk * (0.2 + 0.44 * frontFactor);
  float alpha = mix(alphaWater, alphaLand, landMask);
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

function fibonacciPointOnSphere(i: number, n: number, radius: number): THREE.Vector3 {
  const inc = Math.PI * (3 - Math.sqrt(5));
  const y = n > 1 ? 1 - (i / (n - 1)) * 2 : 0;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = i * inc;
  return new THREE.Vector3(Math.cos(phi) * r * radius, y * radius, Math.sin(phi) * r * radius);
}

function dirToLandMaskUV(dir: THREE.Vector3): { u: number; v: number } {
  return unitDirectionToGlobeEquirectUV(dir);
}

function sampleLuminanceBilinear(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  u: number,
  v: number,
): number {
  const uu = ((u % 1) + 1) % 1;
  const vv = THREE.MathUtils.clamp(v, 0, 1);
  const x = uu * (w - 1);
  const y = vv * (h - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const tx = x - x0;
  const ty = y - y0;
  const lum = (ix: number, iy: number) => {
    const i = (iy * w + ix) * 4;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const l00 = lum(x0, y0);
  const l10 = lum(x1, y0);
  const l01 = lum(x0, y1);
  const l11 = lum(x1, y1);
  const a = THREE.MathUtils.lerp(l00, l10, tx);
  const b = THREE.MathUtils.lerp(l01, l11, tx);
  return THREE.MathUtils.lerp(a, b, ty) / 255;
}

async function rasterLandStrengthFromImage(
  imageUrl: string,
  sampleW = 1024,
  sampleH = 512,
): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  const tex = await loader.loadAsync(imageUrl);
  const img = tex.image as HTMLImageElement;
  const canvas = document.createElement("canvas");
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas unsupported");
  }
  ctx.drawImage(img, 0, 0, sampleW, sampleH);
  tex.dispose();
  const { data, width, height } = ctx.getImageData(0, 0, sampleW, sampleH);
  return { data, w: width, h: height };
}

function isGeoJsonLandMaskUrl(url: string): boolean {
  const path = url.split("?")[0]?.split("#")[0] ?? url;
  return path.endsWith(".geojson");
}

async function loadLandMaskRaster(
  landMaskUrl: string,
  sampleW = 1024,
  sampleH = 512,
): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  if (isGeoJsonLandMaskUrl(landMaskUrl)) {
    return rasterLandMaskFromCountries(landMaskUrl, sampleW, sampleH);
  }
  return rasterLandStrengthFromImage(landMaskUrl, sampleW, sampleH);
}

function isLandPixel(lum: number, fromGeoJson: boolean): boolean {
  if (fromGeoJson) return lum > 0.45;
  // Specular map: oceans bright, land dark.
  return 1 - lum > 0.12;
}

/** Neutral scar height (0.5) so the stipple shader can stay bound while scars are off. */
function createNeutralScarTexture(): THREE.DataTexture {
  const data = new Uint8Array([128]);
  const tex = new THREE.DataTexture(
    data as unknown as ArrayBufferView<ArrayBuffer>,
    1,
    1,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface EarthStippleGlobeResult {
  points: THREE.Points;
  material: THREE.ShaderMaterial;
  /** Mid-grey stub; assign real scar map on this material’s `uScarMap` when in scar mode. */
  neutralScarTexture: THREE.DataTexture;
  /** Black stub for `uHeatMap` when heat overlay is off. */
  neutralHeatTexture: THREE.DataTexture;
  dispose: () => void;
}

/**
 * Point-stippled sphere: land silhouette from an equirectangular texture, rim emphasis in the vertex shader (reference-style).
 */
export async function createEarthStippleGlobe(
  radius: number,
  pointCount: number,
  landMaskUrl: string,
  initialTint: THREE.Vector3,
  initialShadeBase: THREE.Vector3,
  initialLandTint: THREE.Vector3,
  initialLandTintStrength: number,
  initialPixelRatio: number,
): Promise<EarthStippleGlobeResult> {
  let landSource: "geojson" | "image" | "empty" = "empty";
  let land;
  try {
    land = await loadLandMaskRaster(landMaskUrl);
    landSource = isGeoJsonLandMaskUrl(landMaskUrl) ? "geojson" : "image";
    console.info("[earthStippleGlobe] land mask ready:", landSource, landMaskUrl);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.warn(
      "[earthStippleGlobe] land mask failed, trying fallback texture:",
      detail,
      e,
    );
    try {
      land = await rasterLandStrengthFromImage(STIPPLE_LAND_TEXTURE_URL);
      landSource = "image";
    } catch {
      land = { data: new Uint8ClampedArray(4), w: 1, h: 1 };
    }
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const lands: number[] = [];

  for (let i = 0; i < pointCount; i++) {
    const p = fibonacciPointOnSphere(i, pointCount, radius);
    const dir = p.clone().multiplyScalar(1 / radius);
    const { u, v } = dirToLandMaskUV(dir);
    let L = 0.0;
    if (land.w > 1 && land.h > 1) {
      const lum = sampleLuminanceBilinear(land.data, land.w, land.h, u, v);
      L = isLandPixel(lum, landSource === "geojson") ? 1 : 0;
    }
    positions.push(p.x, p.y, p.z);
    normals.push(dir.x, dir.y, dir.z);
    lands.push(L);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute("aLand", new THREE.Float32BufferAttribute(lands, 1));

  const neutralScarTexture = createNeutralScarTexture();
  const neutralHeatTexture = createNeutralHeatTexture();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTint: { value: initialTint.clone() },
      uShadeBase: { value: initialShadeBase.clone() },
      uLandTint: { value: initialLandTint.clone() },
      uLandTintStrength: { value: initialLandTintStrength },
      uOceanAlphaBoost: { value: 1 },
      uOceanAlphaMin: { value: 0.32 },
      uOceanPointScale: { value: 1 },
      uPixelRatio: { value: initialPixelRatio },
      uScarMap: { value: neutralScarTexture },
      uScarDispScale: { value: 0 },
      uScarDispBias: { value: 0 },
      uScarActive: { value: 0 },
      uScarLandOnly: { value: 1 },
      uHeatMap: { value: neutralHeatTexture },
      uHeatActive: { value: 0 },
      uHeatStrength: { value: 0.58 },
      uHeatCool: { value: new THREE.Vector3(0.12, 0.2, 0.38) },
      uHeatHot: { value: initialTint.clone() },
      uShowLand: { value: 1 },
      uShowOcean: { value: 1 },
      uFacingCullMin: { value: 0.04 },
    },
    vertexShader: VS,
    fragmentShader: FS,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geom, material);
  points.renderOrder = 2;
  points.frustumCulled = false;

  return {
    points,
    material,
    neutralScarTexture,
    neutralHeatTexture,
    dispose: () => {
      geom.dispose();
      material.dispose();
      neutralScarTexture.dispose();
      neutralHeatTexture.dispose();
    },
  };
}
