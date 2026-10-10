import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, sep } from "node:path";
import { randomUUID } from "node:crypto";

// Copy only Git-visible source into a fresh ignored directory; no private .env,
// credentials, .git, installed modules or existing build artifacts are copied.
const root = process.cwd();
const target = resolve(root, ".local", `clean-build-${randomUUID()}`);
mkdirSync(target, { recursive: true });
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
for (const file of new Set(files)) {
  const from = resolve(root, file);
  const to = resolve(target, file);
  if (!from.startsWith(root + sep) || !to.startsWith(target + sep))
    throw new Error("Source path outside repository");
  if (
    /(?:^|\/)(?:\.env(?:\..*)?|\.local|node_modules|dist)(?:\/|$)/.test(file) &&
    file !== ".env.example"
  )
    throw new Error("Private or generated source in clean build inventory");
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
}
const canary = `phase9-backend-only-${randomUUID()}`;
const env = {
  ...process.env,
  NPM_CONFIG_CACHE: resolve(root, ".local", "npm-cache"),
  GEMINI_API_KEY: canary,
  ADMIN_PASSWORD: canary,
  VITE_API_BASE_URL: "/api",
};
for (const args of [
  ["ci", "--no-audit", "--no-fund"],
  ["run", "build"],
]) {
  const run = spawnSync("npm", args, {
    cwd: target,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (run.error || run.status !== 0) {
    console.error("CLEAN_BUILD_FAILED");
    process.exit(1);
  }
}
let scanned = 0;
function check(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = resolve(dir, entry.name);
    if (entry.isDirectory()) check(file);
    else {
      scanned++;
      if (readFileSync(file).includes(Buffer.from(canary)))
        throw new Error("BACKEND_SECRET_EMBEDDED");
    }
  }
}
check(resolve(target, "apps/web/dist"));
console.info(
  JSON.stringify({
    event: "CLEAN_BUILD_VERIFIED",
    secretCanaryAbsent: true,
    filesScanned: scanned,
  }),
);
