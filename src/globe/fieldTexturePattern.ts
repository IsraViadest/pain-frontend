export type FieldTexturePattern = "smooth" | "grain" | "hex";

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function grainMultiplier(x: number, y: number): number {
  const cellX = Math.floor(x / 4);
  const cellY = Math.floor(y / 4);
  const raw = Math.sin(cellX * 12.9898 + cellY * 78.233) * 43758.5453;
  return 0.76 + 0.48 * (raw - Math.floor(raw));
}

function hexMultiplier(x: number, y: number): number {
  const size = 12;
  const gridHeight = Math.sqrt(3);
  const ux = x / size;
  const uy = y / size;
  const ax = modulo(ux, 1) - 0.5;
  const ay = modulo(uy, gridHeight) - gridHeight / 2;
  const bx = modulo(ux - 0.5, 1) - 0.5;
  const by = modulo(uy - gridHeight / 2, gridHeight) - gridHeight / 2;
  const useA = ax * ax + ay * ay < bx * bx + by * by;
  const gx = Math.abs(useA ? ax : bx);
  const gy = Math.abs(useA ? ay : by);
  const distance = Math.max(gx, gx * 0.5 + gy * Math.sqrt(3) / 2);
  const edge = Math.max(0, Math.min(1, (distance - 0.38) / 0.1));
  return 0.82 + 0.36 * edge;
}

/** Apply a cosmetic pattern to RGBA alpha without changing its underlying field. */
export function applyFieldTexturePattern(
  bytes: Uint8Array,
  width: number,
  height: number,
  pattern: FieldTexturePattern,
): void {
  if (pattern === "smooth") return;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alphaIndex = (y * width + x) * 4 + 3;
      const multiplier = pattern === "grain"
        ? grainMultiplier(x, y)
        : hexMultiplier(x, y);
      bytes[alphaIndex] = Math.min(255, Math.round(bytes[alphaIndex]! * multiplier));
    }
  }
}
