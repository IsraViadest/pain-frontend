/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/** Box blur with clipped latitude and optional periodic longitude. Radius is a nonnegative integer. */
export function boxBlurField(
  src: Float32Array,
  width: number,
  height: number,
  radius: number,
  wrapX: boolean,
): Float32Array {
  // Keep unnormalized sums in double precision until the final Float32 write.
  const horizontal = new Float64Array(src.length);
  const out = new Float32Array(src.length);
  const span = 2 * radius + 1;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    if (wrapX) {
      // Count repeated samples when the window is wider than the periodic row.
      const cycles = Math.floor(span / width);
      if (cycles > 0) {
        for (let x = 0; x < width; x++) sum += src[row + x]!;
        sum *= cycles;
      }
      let leaving = (width - (radius % width)) % width;
      let entering = leaving;
      for (let i = 0; i < span % width; i++) {
        sum += src[row + entering]!;
        if (++entering === width) entering = 0;
      }
      for (let x = 0; x < width; x++) {
        horizontal[row + x] = sum;
        sum += src[row + entering]! - src[row + leaving]!;
        if (++leaving === width) leaving = 0;
        if (++entering === width) entering = 0;
      }
    } else {
      for (let x = 0; x <= Math.min(radius, width - 1); x++) sum += src[row + x]!;
      for (let x = 0; x < width; x++) {
        horizontal[row + x] = sum;
        if (x - radius >= 0) sum -= src[row + x - radius]!;
        if (x + radius + 1 < width) sum += src[row + x + radius + 1]!;
      }
    }
  }

  for (let x = 0; x < width; x++) {
    const countX = wrapX
      ? span
      : Math.min(width - 1, x + radius) - Math.max(0, x - radius) + 1;
    let sum = 0;
    for (let y = 0; y <= Math.min(radius, height - 1); y++) {
      sum += horizontal[y * width + x]!;
    }
    for (let y = 0; y < height; y++) {
      const countY = Math.min(height - 1, y + radius) - Math.max(0, y - radius) + 1;
      out[y * width + x] = sum / (countX * countY);
      if (y - radius >= 0) sum -= horizontal[(y - radius) * width + x]!;
      if (y + radius + 1 < height) sum += horizontal[(y + radius + 1) * width + x]!;
    }
  }
  return out;
}
