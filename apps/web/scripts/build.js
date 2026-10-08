// The shared root .env sets the backend's development mode. Set the frontend
// build mode before loading Vite so React always uses its production runtime.
process.env.NODE_ENV = "production";
const { build } = await import("vite");
await build();
