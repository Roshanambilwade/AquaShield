import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { accountDefinitions, SEED_VERSION } from "./scenario.js";
export const credentialsPath = fileURLToPath(
  new URL("../../../../.local/demo-credentials.json", import.meta.url),
);
export async function demoCredentials(databaseName) {
  await mkdir(fileURLToPath(new URL("../../../../.local/", import.meta.url)), {
    recursive: true,
  });
  let data;
  try {
    data = JSON.parse(await readFile(credentialsPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT")
      throw new Error(
        "The local demo credential file is invalid; it was preserved.",
        { cause: error },
      );
    data = {
      version: SEED_VERSION,
      databaseName,
      accounts: accountDefinitions.map((a) => ({
        key: a.key,
        email: a.email,
        role: a.role,
        password: randomBytes(24).toString("base64url"),
      })),
    };
    try {
      await writeFile(credentialsPath, JSON.stringify(data, null, 2), {
        flag: "wx",
        mode: 0o600,
      });
    } catch (writeError) {
      if (writeError.code !== "EEXIST") throw writeError;
      data = JSON.parse(await readFile(credentialsPath, "utf8"));
    }
  }
  if (
    data.version !== SEED_VERSION ||
    data.databaseName !== databaseName ||
    !accountDefinitions.every((a) =>
      data.accounts?.some(
        (v) =>
          v.key === a.key &&
          v.email === a.email &&
          v.role === a.role &&
          typeof v.password === "string" &&
          v.password.length >= 24,
      ),
    )
  )
    throw new Error(
      "Demo credentials do not match this target; existing credentials were preserved.",
    );
  return Object.fromEntries(data.accounts.map((a) => [a.key, a.password]));
}
