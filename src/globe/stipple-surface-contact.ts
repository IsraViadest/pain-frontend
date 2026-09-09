/** created by: Christian Stelmach (chrisp.stel@gmail.com) */
import { BufferAttribute, Ray, SphereGeometry, Vector3 } from "three";

/** Cache dot floors on the actual display triangles, not the continuous displacement texture.
 * Runs only when the field or geometry changes. The sphere grid bounds each search to 18 triangles.
 */
export function stippleSurfaceRadii(points: BufferAttribute, surface: SphereGeometry, bias: number): Float32Array {
  const width = surface.parameters.widthSegments, height = surface.parameters.heightSegments;
  const vertices = surface.getAttribute("position");
  const result = new Float32Array(points.count);
  const direction = new Vector3(), a = new Vector3(), b = new Vector3(), c = new Vector3(), hit = new Vector3();
  const ray = new Ray(new Vector3(), direction);
  const neighbors = [0, -1, 1];
  const triangleRadius = (ia: number, ib: number, ic: number) => {
    a.fromBufferAttribute(vertices, ia); b.fromBufferAttribute(vertices, ib); c.fromBufferAttribute(vertices, ic);
    return ray.intersectTriangle(a, b, c, false, hit) ? hit.length() : 0;
  };
  for (let i = 0; i < points.count; i++) {
    direction.fromBufferAttribute(points, i).normalize();
    if (Math.abs(direction.y) > 1 - 1e-12) {
      result[i] = a.fromBufferAttribute(vertices, direction.y > 0 ? 0 : height * (width + 1)).length() + bias;
      continue;
    }
    const u = ((Math.atan2(direction.z, -direction.x) / (2 * Math.PI)) % 1 + 1) % 1;
    const v = .5 - Math.asin(direction.y) / Math.PI;
    const column = Math.min(width - 1, Math.floor(u * width));
    const row = Math.min(height - 1, Math.floor(v * height));
    let radius = 0;
    // The containing cell normally succeeds immediately; neighbors only handle curved cell edges.
    search: for (const offset of neighbors) {
      const y = row + offset;
      if (y < 0 || y >= height) continue;
      for (const delta of neighbors) {
        const x = (column + delta + width) % width;
        const p = y * (width + 1) + x;
        const q = p + width + 1;
        radius = triangleRadius(p + 1, p, q + 1) || triangleRadius(p, q, q + 1);
        if (radius) break search;
      }
    }
    if (!radius) throw new Error("Stipple direction missed its display surface");
    result[i] = radius + bias;
  }
  return result;
}
