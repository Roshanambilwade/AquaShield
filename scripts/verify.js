import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { testEnvironment } from "./testEnvironment.js";

export const verificationSteps = [
  ["unit/API and reliability", ["test"]],
  ["MongoDB integration", ["run", "test:mongo"]],
  ["lint", ["run", "lint"]],
  ["production frontend build", ["run", "build"]],
  ["secret exposure", ["run", "security:check"]],
  ["configuration parsing", ["run", "config:check"]],
  ["desktop/mobile browsers", ["run", "test:e2e"]],
  ["development origins", ["run", "test:dev-origins"]],
];

export function verify({ run, log = console.info, steps = verificationSteps }) {
  for (const [label, args] of steps) {
    const started = performance.now();
    log(`VERIFY_START ${label}`);
    let result;
    try {
      result = run(args);
    } catch {
      result = { status: 1 };
    }
    if (result?.status !== 0 || result?.error || result?.signal) {
      log(`VERIFY_FAILED ${label}`);
      return 1;
    }
    log(`VERIFY_PASS ${label} ${Math.round(performance.now() - started)}ms`);
  }
  return 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (!process.env.npm_execpath) {
    console.error("Run this workflow with npm run verify.");
    process.exitCode = 1;
  } else {
    const env = testEnvironment(process.env);
    // Each test suite allocates its own UUID database. Never accept a caller's
    // browser database as an owned disposable database.
    delete env.MONGODB_TEST_DB_NAME;
    env.AQUASHIELD_BROWSER_DEV_PORT ||= "5175";
    process.exitCode = verify({
      run: (args) =>
        spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
          cwd: fileURLToPath(new URL("../", import.meta.url)),
          env,
          stdio: "inherit",
          windowsHide: true,
        }),
    });
  }
}
