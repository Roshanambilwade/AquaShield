import { ApiError } from "./errors.js";

export function createSubmissionLimiter({
  max = 30,
  windowMs = 15 * 60 * 1000,
  now = Date.now,
} = {}) {
  const entries = new Map();
  let lastCleanup = 0;
  return function submissionLimit(req, res, next) {
    const time = now();
    if (time - lastCleanup >= 60000) {
      for (const [key, entry] of entries)
        if (entry.expires <= time) entries.delete(key);
      lastCleanup = time;
    }
    const key = req.ip;
    let entry = entries.get(key);
    if (!entry || entry.expires <= time) {
      if (entries.size >= 5000 && !entry)
        return next(
          new ApiError(
            429,
            "RATE_LIMITED",
            "Too many submissions. Please try again later.",
          ),
        );
      entry = { count: 0, expires: time + windowMs };
      entries.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.expires - time) / 1000)));
      return next(
        new ApiError(
          429,
          "RATE_LIMITED",
          "Too many submissions from this connection. Please try again later.",
        ),
      );
    }
    next();
  };
}
