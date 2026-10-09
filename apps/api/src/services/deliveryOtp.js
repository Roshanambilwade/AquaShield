import { randomInt, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
const binding = (delivery, salt) =>
  `${salt}:${delivery._id}:${delivery.allocationId}:${delivery.eventId}`;
export async function generateOtp(delivery) {
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  const salt = randomBytes(32).toString("hex");
  const hash = (await derive(code, binding(delivery, salt), 32)).toString(
    "hex",
  );
  return { code, salt, hash };
}
export async function matchesOtp(code, delivery) {
  if (
    !/^\d{6}$/.test(code) ||
    !/^[a-f0-9]{64}$/.test(delivery.otpHash || "") ||
    !delivery.otpSalt
  )
    return false;
  const hash = await derive(code, binding(delivery, delivery.otpSalt), 32);
  return timingSafeEqual(hash, Buffer.from(delivery.otpHash, "hex"));
}
