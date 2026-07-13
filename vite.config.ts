/**
 * Vite dev proxies only — production `dist/` is static; the host must serve
 * GET /init/:layer (same origin) or set VITE_PAIN_API_BASE at build time.
 *
 * - VITE_USE_MOCK_API true (default in dev): proxy /api → local mock (:3847)
 * - VITE_USE_MOCK_API false: proxy /init → pain-server (PAIN_SERVER_HOST:PORT), use dev:pain-server
 */
import { defineConfig, loadEnv, type ProxyOptions } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const useMockApi =
    env.VITE_USE_MOCK_API !== "false" && env.VITE_USE_MOCK_API !== "0";

  const mockPort = Number(env.PAIN_API_PORT ?? 3847);
  const painServerHost = env.PAIN_SERVER_HOST?.trim() || "127.0.0.1";
  const painServerPort = Number(env.PAIN_SERVER_PORT ?? 3000);

  const proxy: Record<string, ProxyOptions> = useMockApi
    ? {
        "/api": {
          target: `http://127.0.0.1:${mockPort}`,
          changeOrigin: true,
        },
      }
    : {
        "/init": {
          target: `http://${painServerHost}:${painServerPort}`,
          changeOrigin: true,
        },
      };

  return {
    server: {
      port: 5173,
      proxy,
    },
  };
});
