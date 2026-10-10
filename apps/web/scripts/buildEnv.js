export function validateBuildEnv(env) {
  const unsafe = Object.keys(env).filter(
    (name) =>
      name.startsWith("VITE_") &&
      name !== "VITE_API_BASE_URL" &&
      !(
        name === "VITE_USER_NODE_ENV" &&
        ["development", "test", "production"].includes(env[name])
      ),
  );
  if (unsafe.length)
    throw new Error(
      "Unsupported public VITE_* configuration; only VITE_API_BASE_URL is allowed",
    );
  const value = env.VITE_API_BASE_URL || "/api";
  if (value === "/api") return;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/api\/?$/.test(url.pathname)
    )
      return;
  } catch {
    /* Return a field name only, never a configured URL. */
  }
  throw new Error(
    "Invalid production VITE_API_BASE_URL: use /api with a reverse proxy, or https://<api-host>/api",
  );
}
