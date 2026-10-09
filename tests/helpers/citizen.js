import mongoose from "mongoose";
import { assertTestDatabase } from "./safety.js";
import { citizenSession } from "../../apps/api/test/helpers/citizen.js";
import { loadEnv } from "../../apps/api/src/config/env.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "../../apps/api/src/config/database.js";
import User from "../../apps/api/src/models/User.js";
import AdminSession from "../../apps/api/src/models/AdminSession.js";
export async function prepareBrowserCitizen() {
  const ownsConnection = mongoose.connection.readyState !== 1;
  if (ownsConnection) await connectDatabase(loadEnv());
  assertTestDatabase();
  const session = await citizenSession(loadEnv());
  return {
    ...session,
    async signIn(page) {
      await page.addInitScript(
        (token) => sessionStorage.setItem("aquashield-admin-session", token),
        session.token,
      );
    },
    async cleanup() {
      assertTestDatabase();
      await AdminSession.deleteMany({ userId: session.id });
      await User.deleteOne({ _id: session.id });
      if (ownsConnection) await disconnectDatabase();
    },
  };
}
