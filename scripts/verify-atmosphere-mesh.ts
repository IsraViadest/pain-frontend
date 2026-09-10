/** created by: Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach */
// node --import tsx scripts/verify-atmosphere-mesh.ts
import assert from "node:assert/strict";
import * as THREE from "three";
import { createAtmosphereSurface } from "../src/globe/atmosphereSurface";

const texture = (alpha: number) => {
  const data = new Uint8Array(16 * 8 * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = alpha;
  return new THREE.DataTexture(data, 16, 8, THREE.RGBAFormat);
};
const temperature = texture(128), co2 = texture(192), depth = new THREE.DepthTexture(1,1);
const air = createAtmosphereSurface({mode:"mantle",depth,drawingSize:new THREE.Vector2(1920,1080),
  inverseEarth:new THREE.Matrix4(),colors:{temperature:"#d74846",co2:"#b4ffd2"}});
const meshes = air.object.children as THREE.Mesh<THREE.SphereGeometry>[];
assert.notEqual(meshes[0].geometry, meshes[1].geometry, "Separate fields need separate shapes");
function checkRadius(mesh: THREE.Mesh, radius: number) {
  const position = mesh.geometry.getAttribute("position");
  for (let i=0;i<position.count;i++) assert(Math.abs(Math.hypot(position.getX(i),position.getY(i),position.getZ(i))-radius)<2e-6);
}
air.setFields(temperature,co2);
checkRadius(meshes[0],1.012+.05*128/255);
checkRadius(meshes[1],1.085+.055*192/255);
const positions = meshes.map(mesh=>mesh.geometry.getAttribute("position"));
const versions = positions.map(position=>position.version);
const first = positions[0].array.slice();
air.object.rotation.y=1;
air.setFields(temperature,co2);
assert.deepEqual(positions.map(position=>position.version),versions,"Rotation and unchanged data must not rebuild geometry");
temperature.image.data.fill(0); temperature.needsUpdate=true;
air.setFields(temperature,co2); checkRadius(meshes[0],1.012);
assert.equal(positions[1].version,versions[1],"Temperature updates must not rebuild CO2");
for(let i=3;i<temperature.image.data.length;i+=4)temperature.image.data[i]=128;
temperature.needsUpdate=true; air.setFields(temperature,co2);
assert.deepEqual(positions[0].array,first,"Repeated updates must start from the base sphere");
for(const mesh of meshes) {
  const normals=mesh.geometry.getAttribute("normal"), p=mesh.geometry.parameters, stride=p.widthSegments+1;
  for(let row=1;row<p.heightSegments;row++) {
    const a=row*stride,b=a+stride-1;
    assert.deepEqual([normals.getX(a),normals.getY(a),normals.getZ(a)],
      [normals.getX(b),normals.getY(b),normals.getZ(b)]);
  }
  for(let i=0;i<stride;i++)assert.equal(normals.getY(i),1);
}
air.setFields(temperature,null); assert.equal(air.stats().drawCalls,1);
air.setFields(null,null); assert.equal(air.object.visible,false);
let disposed=0;
meshes.forEach(mesh=>mesh.geometry.addEventListener("dispose",()=>disposed++));
air.dispose(); air.dispose();
assert.equal(disposed,2); assert.equal(air.stats().additionalBytes,0);
temperature.dispose(); co2.dispose(); depth.dispose();
console.log("Atmosphere shape caching, independent fields, seam normals and disposal PASS");
