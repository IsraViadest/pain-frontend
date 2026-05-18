import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const useMockApi =
    env.VITE_USE_MOCK_API !== "false" && env.VITE_USE_MOCK_API !== "0";

  const mockPort = Number(env.PAIN_API_PORT ?? 3847);
  const painServerPort = Number(env.PAIN_SERVER_PORT ?? 3000);

  const proxy = useMockApi
    ? {
        "/api": {
          target: `http://127.0.0.1:${mockPort}`,
          changeOrigin: true,
        },
      }
    : {
        "/init": {
          target: `http://127.0.0.1:${painServerPort}`,
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
