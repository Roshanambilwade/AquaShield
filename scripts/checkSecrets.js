import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

// Reports paths and rule names only, never matching content or configured secrets.
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const source = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const findings = [];
const privatePath =
  /(?:^|\/)(?:\.env(?:\..*)?|[^/]*credentials[^/]*\.json|[^/]+\.(?:pem|key|p12|pfx|dump|archive))$/i;
for (const file of tracked) {
  if (file !== ".env.example" && privatePath.test(file))
    findings.push({ file, rule: "PRIVATE_FILE_TRACKED" });
}
const patterns = [
  ["GOOGLE_KEY_LITERAL", /AIza[\w-]{35}/],
  ["AWS_ACCESS_KEY_LITERAL", /(?:AKIA|ASIA)[A-Z0-9]{16}/],
  ["PRIVATE_KEY_LITERAL", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];
function inspect(file) {
  const data = readFileSync(file, "utf8");
  for (const [rule, pattern] of patterns)
    if (pattern.test(data)) findings.push({ file, rule });
  for (const name of [
    "GEMINI_API_KEY",
    "ADMIN_PASSWORD",
    "AWS_SECRET_ACCESS_KEY",
  ]) {
    const value = process.env[name];
    if (value && value.length >= 12 && data.includes(value))
      findings.push({ file, rule: "CONFIGURED_SECRET_PRESENT" });
  }
}
for (const file of new Set(source))
  if (existsSync(file) && statSync(file).isFile()) inspect(file);
function inspectBundle(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = resolve(dir, entry.name);
    if (entry.isDirectory()) inspectBundle(file);
    else inspect(file);
  }
}
if (existsSync("apps/web/dist")) inspectBundle("apps/web/dist");
for (const file of [
  ".env",
  ".env.production",
  ".local/demo-credentials.json",
  "backup.archive",
  "private.key",
]) {
  try {
    execFileSync("git", ["check-ignore", "--quiet", file]);
  } catch {
    findings.push({ file, rule: "SECRET_EXCLUSION_MISSING" });
  }
}
console.info(
  JSON.stringify({
    event: "SECRET_EXCLUSION_CHECK",
    passed: findings.length === 0,
    sourceFiles: new Set(source).size,
    findings,
  }),
);
if (findings.length) process.exitCode = 1;
