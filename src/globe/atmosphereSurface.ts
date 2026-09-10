/** created by: Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach */
import * as THREE from "three";

interface AtmosphereSurfaceOptions {
  mode: "flat" | "mantle" | "cloudlets";
  depth: THREE.DepthTexture;
  drawingSize: THREE.Vector2;
  inverseEarth: THREE.Matrix4;
  colors: { temperature: string; co2: string };
}

const CLOUDLET_LIMIT = 4096;
const MAX_RADIUS = 1.08;
const FIELD_GLSL = /* glsl */ `
uniform sampler2D uField;
vec2 fieldUv(vec3 direction) {
  vec3 n = normalize(direction);
  // A pole is one position. Give duplicated pole vertices the same longitude.
  float u = dot(n.xz, n.xz) < 1e-12 ? 0.5 :
    fract(atan(n.z, -n.x) * 0.15915494309189535 + 1.0);
  // Borrowed fields have flipY=true: SphereGeometry's north is v=1.
  return vec2(u, 0.5 + asin(clamp(n.y, -1.0, 1.0)) * 0.3183098861837907);
}
float densityAt(vec3 direction) {
  return texture2D(uField, fieldUv(direction)).a;
}
`;

const FRAGMENT_COMMON = /* glsl */ `
${FIELD_GLSL}
uniform sampler2D uSceneDepth;
uniform vec2 uDrawingSize;
uniform mat4 uInverseEarth;
uniform vec3 uColor;
uniform float uAppearance;
varying vec3 vEarthPosition;
void discardBehindSurface() {
  float surfaceDepth = texture2D(uSceneDepth, gl_FragCoord.xy / uDrawingSize).r;
  if (gl_FragCoord.z > surfaceDepth) discard;
}
`;

const FLAT_VERTEX = /* glsl */ `
uniform float uBaseRadius;
varying vec3 vEarthPosition;
varying vec2 vFieldUv;
void main() {
  vFieldUv = uv;
  vEarthPosition = normalize(position) * uBaseRadius;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(vEarthPosition, 1.0);
}
`;

const FLAT_FRAGMENT = /* glsl */ `
${FRAGMENT_COMMON}
varying vec2 vFieldUv;
void main() {
  discardBehindSurface();
  float density = texture2D(uField, vFieldUv).a;
  if (density <= 0.0) discard;
  gl_FragColor = vec4(uColor, density * uAppearance);
  #include <colorspace_fragment>
}
`;

const MANTLE_VERTEX = /* glsl */ `
varying vec3 vEarthPosition;
varying vec3 vSurfaceNormal;
varying vec2 vFieldUv;
void main() {
  vFieldUv = uv;
  vSurfaceNormal = normal;
  vEarthPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(vEarthPosition, 1.0);
}
`;

const MANTLE_FRAGMENT = /* glsl */ `
${FRAGMENT_COMMON}
varying vec3 vSurfaceNormal;
varying vec2 vFieldUv;
uniform float uBaseRadius;
void main() {
  discardBehindSurface();
  float density = texture2D(uField, vFieldUv).a;
  if (density <= 0.0) discard;
  vec3 light = normalize(mat3(uInverseEarth) * vec3(4.0, 2.0, 3.0));
  float shade = 0.94 + 0.06 * max(0.0, dot(normalize(vSurfaceNormal), light));
  vec3 eye = (uInverseEarth * vec4(cameraPosition, 1.0)).xyz;
  vec3 towardEye = normalize(eye - vEarthPosition);
  float radius = length(vEarthPosition);
  float facing = abs(dot(vEarthPosition / radius, towardEye));
  // Approximate a soft atmospheric column with its local spherical chord. Unlike 1/facing,
  // this path naturally reaches zero at the outer edge, without a hard luminous shell.
  // Normalize by face-on thickness so the original field strength stays the same at center.
  float innerRadius = uBaseRadius - 0.012;
  float impactSquared = radius * radius * (1.0 - facing * facing);
  float path = radius * facing - sqrt(max(0.0, innerRadius * innerRadius - impactSquared));
  float opticalPath = max(0.0, path) / (radius - innerRadius);
  float edge = smoothstep(0.0, 0.45, abs(dot(normalize(vSurfaceNormal), towardEye)));
  float alpha = (1.0 - exp(-density * uAppearance * opticalPath)) * edge;
  gl_FragColor = vec4(uColor * shade, alpha);
  #include <colorspace_fragment>
}
`;

const CLOUDLET_VERTEX = /* glsl */ `
attribute vec3 aCenter;
attribute float aSize;
uniform mat4 uInverseEarth;
varying vec3 vEarthPosition;
varying vec2 vPuff;
varying vec3 vPuffLight;
void main() {
  vec3 right = normalize(mat3(uInverseEarth) *
    vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
  vec3 up = normalize(mat3(uInverseEarth) *
    vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]));
  vec3 toward = normalize(cross(right, up));
  // The central vertex lifts toward the viewer: a small real dome, not a flat alpha patch.
  vEarthPosition = aCenter + aSize *
    (right * position.x + up * position.y + toward * position.z * 0.3);
  vPuff = position.xy;
  vec3 light = normalize(mat3(uInverseEarth) * vec3(4.0, 2.0, 3.0));
  vPuffLight = vec3(dot(light, right), dot(light, up), dot(light, toward));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(vEarthPosition, 1.0);
}
`;

const CLOUDLET_FRAGMENT = /* glsl */ `
${FRAGMENT_COMMON}
varying vec2 vPuff;
varying vec3 vPuffLight;
void main() {
  discardBehindSurface();
  float r2 = dot(vPuff, vPuff);
  if (r2 >= 1.0) discard;
  // The interpolated dome position, not its anchor, determines geographic support.
  float density = densityAt(vEarthPosition);
  if (density <= 0.0) discard;
  float softness = 1.0 - smoothstep(0.15, 1.0, sqrt(r2));
  vec3 puffNormal = normalize(vec3(vPuff, sqrt(max(0.0, 1.0 - r2))));
  float shade = 0.55 + 0.45 * max(0.0, dot(puffNormal, normalize(vPuffLight)));
  gl_FragColor = vec4(uColor * shade, density * uAppearance * softness);
  #include <colorspace_fragment>
}
`;

interface AlphaImage {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

/** CPU image row zero is north; reproduce LINEAR sampling with wrapped texel centers. */
function sampleAlpha(image: AlphaImage, x: number, y: number, z: number): number {
  const { data, width, height } = image;
  const inverseLength = 1 / Math.hypot(x, y, z);
  x *= inverseLength;
  y *= inverseLength;
  z *= inverseLength;
  let u = Math.atan2(z, -x) / (2 * Math.PI);
  if (u < 0) u += 1;
  const v = 0.5 - Math.asin(THREE.MathUtils.clamp(y, -1, 1)) / Math.PI;
  const px = u * width - 0.5;
  const py = THREE.MathUtils.clamp(v * height - 0.5, 0, height - 1);
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const x1 = ((x0 + 1) % width + width) % width;
  const wrappedX0 = ((x0 % width) + width) % width;
  const y1 = Math.min(y0 + 1, height - 1);
  const tx = px - x0;
  const ty = py - y0;
  const a = THREE.MathUtils.lerp(data[(y0 * width + wrappedX0) * 4 + 3],
    data[(y0 * width + x1) * 4 + 3], tx);
  const b = THREE.MathUtils.lerp(data[(y1 * width + wrappedX0) * 4 + 3],
    data[(y1 * width + x1) * 4 + 3], tx);
  return THREE.MathUtils.lerp(a, b, ty) / 255;
}

function cloudletGeometry(): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry();
  const segments = 12;
  const positions = new Float32Array((segments + 1) * 3);
  const indices: number[] = [];
  positions[2] = 1;
  for (let i = 0; i < segments; i++) {
    const angle = i / segments * 2 * Math.PI;
    positions[(i + 1) * 3] = Math.cos(angle);
    positions[(i + 1) * 3 + 1] = Math.sin(angle);
    indices.push(0, i + 1, (i + 1) % segments + 1);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.setAttribute("aCenter", new THREE.InstancedBufferAttribute(new Float32Array(CLOUDLET_LIMIT * 3), 3)
    .setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aSize", new THREE.InstancedBufferAttribute(new Float32Array(CLOUDLET_LIMIT), 1)
    .setUsage(THREE.DynamicDrawUsage));
  geometry.instanceCount = 0;
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), MAX_RADIUS);
  return geometry;
}

/** Surface prototypes and their palette control. Field and depth textures remain borrowed. */
export function createAtmosphereSurface(options: AtmosphereSurfaceOptions) {
  const object = new THREE.Group();
  object.name = `atmosphere-${options.mode}`;
  object.renderOrder = -1;
  object.visible = false;
  const maximumRadius = options.mode === "cloudlets" ? MAX_RADIUS : 1.15;
  const sphere = options.mode !== "cloudlets" ? new THREE.SphereGeometry(1, 192, 128) : null;
  if (sphere) sphere.boundingSphere = new THREE.Sphere(new THREE.Vector3(), maximumRadius);
  const basePositions = options.mode === "mantle"
    ? (sphere!.getAttribute("position").array as Float32Array).slice() : null;
  const anchors = options.mode === "cloudlets" ? new Float32Array(CLOUDLET_LIMIT * 3) : null;
  if (anchors) {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < CLOUDLET_LIMIT; i++) {
      const y = 1 - 2 * (i + 0.5) / CLOUDLET_LIMIT;
      const radial = Math.sqrt(1 - y * y);
      const phase = (i + 43) * goldenAngle;
      anchors[i * 3] = radial * Math.cos(phase);
      anchors[i * 3 + 1] = y;
      anchors[i * 3 + 2] = radial * Math.sin(phase);
    }
  }
  const fields = ([
    { name: "temperature", appearance: options.mode === "mantle" ? 3.2 : 0.7,
      baseRadius: options.mode === "flat" ? 1.003 : 1.012, height: 0.05 },
    { name: "co2", appearance: options.mode === "mantle" ? 2.2 : 0.4,
      baseRadius: options.mode === "flat" ? 1.15 : options.mode === "mantle" ? 1.085 : 1.02,
      height: 0.055 },
  ] as const).map((field, index) => {
    const geometry = sphere ? basePositions && index > 0 ? sphere.clone() : sphere : cloudletGeometry();
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uField: { value: null as THREE.DataTexture | null },
        uSceneDepth: { value: options.depth },
        uDrawingSize: { value: options.drawingSize },
        uInverseEarth: { value: options.inverseEarth },
        uColor: { value: new THREE.Color(options.colors[field.name]) },
        uAppearance: { value: field.appearance },
        uBaseRadius: { value: field.baseRadius },
      },
      vertexShader: options.mode === "flat" ? FLAT_VERTEX : options.mode === "mantle" ? MANTLE_VERTEX : CLOUDLET_VERTEX,
      fragmentShader: options.mode === "flat" ? FLAT_FRAGMENT : options.mode === "mantle" ? MANTLE_FRAGMENT : CLOUDLET_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.FrontSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${options.mode}-${field.name}`;
    mesh.renderOrder = -1;
    mesh.visible = false;
    object.add(mesh);
    return { ...field, mesh, material, geometry, map: null as THREE.DataTexture | null, version: -1, count: 0 };
  });
  let disposed = false;

  function setField(index: number, map: THREE.DataTexture | null): void {
    const field = fields[index];
    if (map === field.map && (map?.version ?? -1) === field.version) return;
    field.map = map;
    field.version = map?.version ?? -1;
    field.material.uniforms.uField.value = map;
    field.mesh.visible = Boolean(map);
    field.count = 0;
    if (!anchors && !basePositions) return;
    const geometry = field.geometry as THREE.InstancedBufferGeometry;
    if (map) {
      const image = map.image as AlphaImage;
      if (map.format !== THREE.RGBAFormat || map.type !== THREE.UnsignedByteType ||
          !image.data || image.width < 1 || image.height < 1 ||
          image.data.length < image.width * image.height * 4) {
        throw new Error("Atmosphere geometry requires the existing byte RGBA field texture");
      }
      if (basePositions) {
        // The field is static during rotation. Bake its shape once per texture revision,
        // instead of sampling it five times per vertex on every frame.
        const positions = field.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < positions.count; i++) {
          let x = basePositions[i * 3], y = basePositions[i * 3 + 1], z = basePositions[i * 3 + 2];
          if (Math.abs(y) > 0.999999) { x = 0; y = Math.sign(y); z = 0; }
          const radius = field.baseRadius + field.height * sampleAlpha(image, x, y, z);
          positions.setXYZ(i, x * radius, y * radius, z * radius);
        }
        positions.needsUpdate = true;
        field.geometry.computeVertexNormals();
        const normals = field.geometry.getAttribute("normal") as THREE.BufferAttribute;
        const stride = sphere!.parameters.widthSegments + 1;
        const rows = sphere!.parameters.heightSegments;
        const average = new THREE.Vector3();
        // The sphere duplicates seam and pole vertices. Share their lighting normals too.
        for (let row = 1; row < rows; row++) {
          const a = row * stride, b = a + stride - 1;
          average.set(normals.getX(a) + normals.getX(b), normals.getY(a) + normals.getY(b),
            normals.getZ(a) + normals.getZ(b)).normalize();
          normals.setXYZ(a, average.x, average.y, average.z);
          normals.setXYZ(b, average.x, average.y, average.z);
        }
        for (let i = 0; i < stride; i++) {
          normals.setXYZ(i, 0, 1, 0);
          normals.setXYZ(rows * stride + i, 0, -1, 0);
        }
        normals.needsUpdate = true;
        return;
      }
      if (!anchors) return;
      const centers = geometry.getAttribute("aCenter") as THREE.InstancedBufferAttribute;
      const sizes = geometry.getAttribute("aSize") as THREE.InstancedBufferAttribute;
      for (let i = 0; i < CLOUDLET_LIMIT; i++) {
        const x = anchors[i * 3];
        const y = anchors[i * 3 + 1];
        const z = anchors[i * 3 + 2];
        const density = sampleAlpha(image, x, y, z);
        if (density <= 0) continue;
        const hash = (Math.imul(i ^ 43, 1664525) + 1013904223) >>> 0;
        const size = 0.016 + 0.006 * hash / 2 ** 32;
        // Height and puff size are artistic geometry; opacity still uses raw fragment density.
        const centerRadius = field.baseRadius + 0.004 + 0.02 * density;
        centers.setXYZ(field.count, x * centerRadius, y * centerRadius, z * centerRadius);
        sizes.setX(field.count, size);
        field.count++;
      }
      centers.needsUpdate = true;
      sizes.needsUpdate = true;
    }
    if (anchors) {
      geometry.instanceCount = field.count;
      field.mesh.visible = field.count > 0;
    }
  }

  return {
    object,
    setFields(temperature: THREE.DataTexture | null, co2: THREE.DataTexture | null): void {
      if (disposed) return;
      setField(0, temperature);
      setField(1, co2);
      object.visible = fields.some((field) => field.mesh.visible);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const geometry of new Set(fields.map((field) => field.geometry))) geometry.dispose();
      for (const field of fields) {
        field.material.dispose();
        field.material.uniforms.uField.value = null;
        field.map = null;
      }
      object.clear();
      object.visible = false;
    },
    stats() {
      const uniqueGeometries = new Set(fields.map((field) => field.geometry));
      let geometryBytes = 0;
      for (const geometry of uniqueGeometries) {
        geometryBytes += geometry.index?.array.byteLength ?? 0;
        for (const attribute of Object.values(geometry.attributes)) geometryBytes += attribute.array.byteLength;
      }
      return {
        additionalBytes: disposed ? 0 : geometryBytes * 2 + (anchors?.byteLength ?? 0) +
          (basePositions?.byteLength ?? 0) + 16_384,
        mode: options.mode,
        drawCalls: disposed ? 0 : fields.filter((field) => field.mesh.visible).length,
        temperatureCloudlets: disposed ? 0 : fields[0].count,
        co2Cloudlets: disposed ? 0 : fields[1].count,
        cloudletLimitPerField: CLOUDLET_LIMIT,
        maximumRadius,
      };
    },
  };
}
