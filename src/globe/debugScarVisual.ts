/**
 * TEMPORARY scar-debug palette. Set `enabled` to false (or delete this file) before release.
 * Import only from globe rendering code — not used in production builds when disabled.
 */
export const DEBUG_SCAR_VISUAL = {
  enabled: true,
  /** WebGL + scene backdrop */
  sceneBackground: 0xf4f4f4,
  /** Solid sphere mesh (MeshStandardMaterial) — normally hidden in stipple display mode */
  globeMeshColor: 0xff6600,
  globeMeshOpacity: 0.35,
  /**
   * Solid `globe` mesh with procedural layer texture — looks like a gray shell under stipple.
   * Keep false while debugging stipple/borders; set true only to check wrong-layer displacement.
   */
  showGlobeMeshInScarMode: false,
  /** Point stipple (Points) */
  stippleLandRgb: [0.05, 0.05, 0.05] as const,
  stippleOceanRgb: [0.12, 0.42, 0.92] as const,
  stippleTintRgb: [0.2, 0.55, 1.0] as const,
  /** Ocean dots use low base alpha in the shader; crank up for debug visibility */
  stippleOceanAlphaBoost: 5,
  /** Keep 1 — larger sprites look like a separate, outer shell vs coastlines */
  stippleOceanPointScale: 1,
  /** Vector coastlines + country borders (LineSegments2) */
  coastOutlineHex: 0xcc0000,
  innerBorderHex: 0x006600,
  coastLineWidth: 0.005,
  innerBorderLineWidth: 0.0012,
  /** Log scar sync to console */
  logScarSync: true,
} as const;

export function isDebugScarVisual(): boolean {
  return DEBUG_SCAR_VISUAL.enabled;
}
