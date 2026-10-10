// The shared root .env sets the backend's development mode. Set the frontend
// build mode before loading Vite so React always uses its production runtime.
process.env.NODE_ENV = "production";
const { build, loadEnv } = await import("vite");
const { fileURLToPath } = await import("node:url");
const { validateBuildEnv } = await import("./buildEnv.js");
validateBuildEnv({
  ...loadEnv(
    "production",
    fileURLToPath(new URL("../../../", import.meta.url)),
    "VITE_",
  ),
  ...process.env,
});
await build();
