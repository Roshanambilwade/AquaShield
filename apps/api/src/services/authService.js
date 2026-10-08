import {
  randomBytes,
  scrypt as cryptoScrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import User from "../models/User.js";
import AdminSession from "../models/AdminSession.js";
import { ApiError } from "../middleware/errors.js";

const scrypt = promisify(cryptoScrypt);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, options);
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password, encoded) {
  const [, salt, key] = encoded.split(":");
  const actual = await scrypt(password, salt, 64, options);
  const expected = Buffer.from(key, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
const publicUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
});
const initialized = new WeakMap();
export async function initializeAuthStorage() {
  const database = User.db.db;
  if (!database) throw new Error("MongoDB is not connected.");
  if (!initialized.has(database))
    initialized.set(
      database,
      Promise.all([User.createIndexes(), AdminSession.createIndexes()]).catch(
        (error) => {
          initialized.delete(database);
          throw error;
        },
      ),
    );
  return initialized.get(database);
}
export async function createAdmin({
  email,
  password,
  name = "Municipal administrator",
}) {
  await initializeAuthStorage();
  // Provisioning never overwrites an existing account or escalates its role.
  return User.create({
    email: email.toLowerCase(),
    name,
    passwordHash: await hashPassword(password),
    role: "ADMIN",
  });
}
export async function loginAdmin(email, password, config) {
  await initializeAuthStorage();
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+passwordHash",
  );
  // Always perform the expensive hash, including for unknown accounts.
  const dummy = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;
  const valid = await verifyPassword(password, user?.passwordHash || dummy);
  if (!valid || !user || user.disabled || user.role !== "ADMIN")
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "Email or password is incorrect.",
    );
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + config.ADMIN_SESSION_HOURS * 3600000);
  await AdminSession.create({
    tokenHash: tokenHash(token),
    userId: user._id,
    expiresAt,
  });
  return { token, expiresAt, user: publicUser(user) };
}
export function bearerToken(req) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(req.get("Authorization") || "");
  if (!match)
    throw new ApiError(
      401,
      "AUTH_REQUIRED",
      "Sign in with an administrator account.",
    );
  return match[1];
}
export async function authenticate(token) {
  const session = await AdminSession.findOne({
    tokenHash: tokenHash(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session)
    throw new ApiError(
      401,
      "SESSION_EXPIRED",
      "Your session has expired. Please sign in again.",
    );
  const user = await User.findById(session.userId);
  if (!user || user.disabled)
    throw new ApiError(
      401,
      "SESSION_EXPIRED",
      "Your session has expired. Please sign in again.",
    );
  if (user.role !== "ADMIN")
    throw new ApiError(
      403,
      "ADMIN_REQUIRED",
      "Administrator access is required.",
    );
  return publicUser(user);
}
export async function logoutAdmin(token) {
  await AdminSession.deleteOne({ tokenHash: tokenHash(token) });
}
