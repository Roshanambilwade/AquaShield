import { randomBytes, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import {
  createAdmin,
  loginAdmin,
} from "../../apps/api/src/services/authService.js";
import User from "../../apps/api/src/models/User.js";
import AdminSession from "../../apps/api/src/models/AdminSession.js";
import { loadEnv } from "../../apps/api/src/config/env.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "../../apps/api/src/config/database.js";

export async function prepareBrowserAdmin() {
  const ownsConnection = mongoose.connection.readyState !== 1;
  if (ownsConnection) await connectDatabase(loadEnv());
  const email = `browser-admin-${randomUUID()}@example.test`;
  const password = randomBytes(24).toString("hex");
  const user = await createAdmin({
    email,
    password,
    name: "Browser test administrator",
  });
  const session = await loginAdmin(email, password, loadEnv());
  return {
    email,
    password,
    user,
    async signIn(page) {
      await page.addInitScript(
        (token) => sessionStorage.setItem("aquashield-admin-session", token),
        session.token,
      );
    },
    async cleanup() {
      await AdminSession.deleteMany({ userId: user._id });
      await User.deleteOne({ _id: user._id });
      if (ownsConnection) await disconnectDatabase();
    },
  };
}
