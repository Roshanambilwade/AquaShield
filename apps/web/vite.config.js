import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const envDir = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  const target =
    process.env.API_PROXY_TARGET ||
    env.API_PROXY_TARGET ||
    `http://127.0.0.1:${process.env.PORT || env.PORT || 5000}`;
  const proxy = { "/api": { target, changeOrigin: true } };
  return {
    plugins: [react()],
    envDir,
    server: { port: 5173, strictPort: true, proxy },
    preview: { port: 4173, strictPort: true, proxy },
  };
});
