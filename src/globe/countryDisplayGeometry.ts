import {
  buildCountryGeometries,
  type CountryGeometry,
  type IndexedCountryGeometry,
} from "./countryGeometry";

interface Vertex {
  key: string;
  point: number[];
  edges: Edge[];
  pinned: boolean;
  rounded?: number[][];
}

interface Edge {
  a: Vertex;
  b: Vertex;
  owners: Set<number>;
  occurrences: number;
}

const pointKey = (point: number[]): string => `${point[0]},${point[1]}`;
const otherEnd = (edge: Edge, vertex: Vertex): Vertex =>
  edge.a === vertex ? edge.b : edge.a;
const isBorder = (edge: Edge): boolean => edge.owners.size > 1;

function distanceToSegment(point: number[], a: number[], b: number[]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared,
  ));
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}

/**
 * Derive one display boundary network without changing canonical lookup geometry.
 * Every fillet stays in a disk disjoint from unrelated edges and other fillet disks.
 * This local deformation preserves ring winding, components and hole containment.
 */
export function buildCountryDisplayGeometry(
  countries: readonly IndexedCountryGeometry[],
  maxDeviationDegrees: number,
) {
  if (!Number.isFinite(maxDeviationDegrees) || maxDeviationDegrees < 0) {
    throw new RangeError("Display deviation must be a finite nonnegative angle");
  }
  const trim = Math.min(maxDeviationDegrees, 0.005);
  const vertices = new Map<string, Vertex>();
  const edges = new Map<string, Edge>();
  const ringVertices = new Map<number[][], Vertex[]>();
  let inputRings = 0;
  let edgeOccurrences = 0;

  countries.forEach((country, owner) => {
    const polygons = country.geometry.type === "Polygon"
      ? [country.geometry.coordinates] : country.geometry.coordinates;
    for (const polygon of polygons) {
      for (const ring of polygon) {
        inputRings++;
        const closed = ring.length > 1 && pointKey(ring[0]) === pointKey(ring[ring.length - 1]);
        const points = closed ? ring.slice(0, -1) : ring;
        const unsafe = !closed || points.length < 3 || points.some((point, i) =>
          !Number.isFinite(point[0]) || !Number.isFinite(point[1]) ||
          Math.abs(point[1]) >= 85 || Math.abs(point[0]) >= 179.5 ||
          Math.abs(point[0] - points[(i + 1) % points.length][0]) > 180,
        );
        const nodes = points.map((point) => {
          const key = pointKey(point);
          let vertex = vertices.get(key);
          if (!vertex) {
            vertex = { key, point, edges: [], pinned: false };
            vertices.set(key, vertex);
          }
          vertex.pinned ||= unsafe;
          return vertex;
        });
        ringVertices.set(ring, nodes);
        nodes.forEach((a, i) => {
          const b = nodes[(i + 1) % nodes.length];
          if (a === b) {
            a.pinned = true;
            return;
          }
          edgeOccurrences++;
          const key = a.key < b.key ? `${a.key}|${b.key}` : `${b.key}|${a.key}`;
          let edge = edges.get(key);
          if (!edge) {
            edge = { a, b, owners: new Set(), occurrences: 0 };
            edges.set(key, edge);
            a.edges.push(edge);
            b.edges.push(edge);
          }
          edge.owners.add(owner);
          edge.occurrences++;
        });
      }
    }
  });

  const displacementPairs: Array<{ source: number[]; display: number[] }> = [];
  let roundedCorners = 0;
  let maxActualDeviationDegrees = 0;
  if (trim > 0) {
    for (const vertex of vertices.values()) {
      if (vertex.pinned || vertex.edges.length !== 2) continue;
      const [first, second] = vertex.edges;
      if (first.occurrences > 2 || second.occurrences > 2 ||
          first.owners.size !== second.owners.size ||
          [...first.owners].some((owner) => !second.owners.has(owner))) continue;
      const a = otherEnd(first, vertex).point;
      const b = otherEnd(second, vertex).point;
      const v = vertex.point;
      const lengthA = Math.hypot(a[0] - v[0], a[1] - v[1]);
      const lengthB = Math.hypot(b[0] - v[0], b[1] - v[1]);
      if (Math.min(lengthA, lengthB) < 4 * trim) continue;
      const u = [(a[0] - v[0]) / lengthA, (a[1] - v[1]) / lengthA];
      const w = [(b[0] - v[0]) / lengthB, (b[1] - v[1]) / lengthB];
      if (Math.abs(u[0] * w[1] - u[1] * w[0]) < 1e-5) continue;

      // ponytail: quadratic scan suits the 7,697 bundled edges; index if that asset grows.
      const clearance = 2 * trim;
      let blocked = false;
      for (const edge of edges.values()) {
        if (edge === first || edge === second) continue;
        const p = edge.a.point;
        const q = edge.b.point;
        if (Math.min(p[0], q[0]) > v[0] + clearance ||
            Math.max(p[0], q[0]) < v[0] - clearance ||
            Math.min(p[1], q[1]) > v[1] + clearance ||
            Math.max(p[1], q[1]) < v[1] - clearance) continue;
        if (distanceToSegment(v, p, q) <= clearance) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      vertex.rounded = [];
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const display = [
          v[0] + trim * ((1 - t) ** 2 * u[0] + t ** 2 * w[0]),
          v[1] + trim * ((1 - t) ** 2 * u[1] + t ** 2 * w[1]),
        ];
        const direction = t <= 0.5 ? u : w;
        const source = [
          v[0] + trim * Math.abs(1 - 2 * t) * direction[0],
          v[1] + trim * Math.abs(1 - 2 * t) * direction[1],
        ];
        vertex.rounded.push(display);
        displacementPairs.push({ source, display });
        maxActualDeviationDegrees = Math.max(maxActualDeviationDegrees,
          Math.hypot(source[0] - display[0], source[1] - display[1]));
      }
      roundedCorners++;
    }
  }

  function displayPath(nodes: Vertex[], closed: boolean): number[][] {
    const path: number[][] = [];
    nodes.forEach((vertex, i) => {
      const previous = nodes[(i + nodes.length - 1) % nodes.length];
      if (vertex.rounded && (closed || (i > 0 && i < nodes.length - 1))) {
        const forward = otherEnd(vertex.edges[0], vertex) === previous;
        path.push(...(forward ? vertex.rounded : vertex.rounded.slice().reverse()));
      } else {
        path.push(vertex.point.slice());
      }
    });
    if (closed && path.length) path.push(path[0].slice());
    return path;
  }

  const visited = new Set<Edge>();
  const coastLines: number[][][] = [];
  const borderLines: number[][][] = [];
  const canContinue = (vertex: Vertex, edge: Edge): boolean =>
    vertex.edges.length === 2 && vertex.edges.every((next) => isBorder(next) === isBorder(edge));

  function trace(start: Vertex, first: Edge): void {
    const nodes = [start];
    let vertex = start;
    let edge = first;
    let closed = false;
    while (!visited.has(edge)) {
      visited.add(edge);
      vertex = otherEnd(edge, vertex);
      if (vertex === start) {
        closed = true;
        break;
      }
      nodes.push(vertex);
      if (!canContinue(vertex, edge)) break;
      edge = vertex.edges.find((next) => next !== edge)!;
    }
    (isBorder(first) ? borderLines : coastLines).push(displayPath(nodes, closed));
  }
  for (const edge of edges.values()) {
    if (!visited.has(edge) && (!canContinue(edge.a, edge) || !canContinue(edge.b, edge))) {
      trace(canContinue(edge.a, edge) ? edge.b : edge.a, edge);
    }
  }
  for (const edge of edges.values()) {
    if (!visited.has(edge)) trace(edge.a, edge);
  }

  const displayCountries = trim === 0 ? countries : buildCountryGeometries({
    features: countries.map((country) => {
      const polygon = (rings: number[][][]): number[][][] => rings.map((ring) =>
        displayPath(ringVertices.get(ring)!, ring.length > 1 &&
          pointKey(ring[0]) === pointKey(ring[ring.length - 1])),
      );
      const geometry: CountryGeometry = country.geometry.type === "Polygon"
        ? { type: "Polygon", coordinates: polygon(country.geometry.coordinates) }
        : { type: "MultiPolygon", coordinates: country.geometry.coordinates.map(polygon) };
      return { properties: { ISO_A3: country.key }, geometry };
    }),
  });

  return {
    countries: displayCountries,
    coastLines,
    borderLines,
    displacementPairs,
    stats: {
      inputCountries: countries.length,
      inputRings,
      edgeOccurrences,
      uniqueEdges: edges.size,
      sharedEdges: [...edges.values()].filter(isBorder).length,
      roundedCorners,
      pinnedCorners: vertices.size - roundedCorners,
      maxDeviationDegrees: trim,
      maxActualDeviationDegrees,
    },
  };
}
