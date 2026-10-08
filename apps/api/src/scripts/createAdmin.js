import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { loadEnv } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { createAdmin } from "../services/authService.js";
try {
  const config = loadEnv();
  const generated = !process.env.ADMIN_PASSWORD;
  if (
    config.NODE_ENV === "production" &&
    (generated || !process.env.ADMIN_EMAIL)
  )
    throw new Error(
      "Production provisioning requires ADMIN_EMAIL and ADMIN_PASSWORD.",
    );
  const email = z
    .email()
    .parse(process.env.ADMIN_EMAIL || "admin@aquashield.local");
  const password = z
    .string()
    .min(12)
    .max(256)
    .parse(process.env.ADMIN_PASSWORD || randomBytes(24).toString("base64url"));
  await connectDatabase(config);
  await createAdmin({
    email,
    password,
    name: process.env.ADMIN_NAME || "Municipal administrator",
  });
  if (generated) {
    const directory = fileURLToPath(
      new URL("../../../../.local/", import.meta.url),
    );
    await mkdir(directory, { recursive: true });
    await writeFile(
      `${directory}/admin-access.json`,
      JSON.stringify({ email, password }, null, 2),
      { mode: 0o600 },
    );
    console.info(
      "Administrator created. Generated local credentials are in .local/admin-access.json; never commit or share this file.",
    );
  } else console.info("Administrator created using the supplied credentials.");
} catch (error) {
  console.error(
    error.code === 11000
      ? "Account already exists; no password or role was changed."
      : "Administrator provisioning failed. Check MongoDB and email/password requirements (12–256 characters).",
  );
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
