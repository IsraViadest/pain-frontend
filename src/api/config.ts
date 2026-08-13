function resolveUseMockApi(): boolean {
  const flag = import.meta.env.VITE_USE_MOCK_API?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  // Dev defaults to local mock; production build uses pain-server (/init/:layer).
  return import.meta.env.DEV;
}

/**
 * API mode for the static frontend.
 * - Mock (dev): in-repo fixtures (`mock/`).
 * - pain-server (prod): GET /init/:layer on the deployed backend.
 */
// TODO: convert useMockApi to a build-time constant (Vite define) so Rollup can drop mock
// branches entirely from dist. Dynamic import of mock/layers.ts may still emit a lazy
// chunk with fixture strings — verify with `grep environmental dist/assets/*.js` after build.
export const useMockApi = resolveUseMockApi();

/** Leading/trailing whitespace trimmed, then one trailing `/` removed. Empty string = same-origin relative paths. */
function getApiBase(): string {
  const base = import.meta.env.VITE_PAIN_API_BASE?.trim() ?? "";
  return base.replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBase();
  return base ? `${base}${p}` : p;
}
