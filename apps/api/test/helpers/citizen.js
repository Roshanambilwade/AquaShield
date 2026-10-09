import { randomUUID, randomBytes } from "node:crypto";
import { createCitizen, loginAdmin } from "../../src/services/authService.js";
export async function citizenSession(config) {
  const email = `citizen-${randomUUID()}@example.test`;
  const password = randomBytes(24).toString("hex");
  const user = await createCitizen({
    name: "Integration citizen",
    email,
    password,
  });
  return {
    ...(await loginAdmin(email, password, config, ["CITIZEN"])),
    password,
    id: user.id,
  };
}
