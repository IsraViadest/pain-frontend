/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
import { applyFieldTexturePattern } from "../src/globe/fieldTexturePattern";

const makeBytes = () => new Uint8Array(24 * 24 * 4).fill(200);
const smooth = makeBytes();
applyFieldTexturePattern(smooth, 24, 24, "smooth");
if (smooth.some((value) => value !== 200)) {
  throw new Error("smooth field pattern changed the texture");
}

for (const pattern of ["grain", "hex", "fine-grain", "fine-hex"] as const) {
  const bytes = makeBytes();
  applyFieldTexturePattern(bytes, 24, 24, pattern);
  const alpha = new Set(Array.from({ length: 24 * 24 }, (_, i) => bytes[i * 4 + 3]));
  if (alpha.size < 2 || Math.max(...alpha) > 255) {
    throw new Error(`${pattern} field pattern did not modulate alpha safely`);
  }
}
