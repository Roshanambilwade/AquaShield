import { z } from "zod";
import { ApiError } from "../middleware/errors.js";
import { validate } from "./report.js";

export const targetTypes = [
  "REPORT",
  "ALLOCATION",
  "TANKER",
  "DELIVERY",
  "ALLOCATION_EVIDENCE",
  "EARLY_WARNING_ALERT",
];
const timestamp = z.iso.datetime({ offset: true });
const base = {
  demo: z.enum(["true", "false"]).default("false"),
  from: timestamp.optional(),
  to: timestamp.optional(),
};
export const analyticsQuery = z
  .object({
    ...base,
    areaId: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]{1,39}$/)
      .optional(),
  })
  .strict();
export const auditQuery = z
  .object({
    ...base,
    page: z.coerce.number().int().min(1).max(100).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    eventType: z
      .string()
      .regex(/^[A-Z][A-Z_]{1,63}$/)
      .optional(),
    actorId: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .transform((v) => v.toLowerCase())
      .optional(),
    targetType: z.enum(targetTypes).optional(),
    targetId: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .transform((v) => v.toLowerCase())
      .optional(),
    outcome: z.enum(["SUCCESS", "FAILURE", "PENDING", "RECOVERED"]).optional(),
    correlationId: z
      .uuid()
      .transform((v) => v.toLowerCase())
      .optional(),
  })
  .strict();
export const auditId = z
  .string()
  .regex(
    /^(?:REPORT|ALLOCATION|TANKER|DELIVERY|ALLOCATION_EVIDENCE|EARLY_WARNING_ALERT):[a-f0-9]{24}:(?:[a-f0-9]{24}|r\d{1,4}|i\d{1,6})$/i,
  )
  .transform((v) => {
    const [type, target, key] = v.split(":");
    return `${type.toUpperCase()}:${target.toLowerCase()}:${key.toLowerCase()}`;
  });
export function dateWindow(query, now = new Date()) {
  if (Boolean(query.from) !== Boolean(query.to))
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      "Supply both window timestamps.",
    );
  const to = query.to ? new Date(query.to) : now;
  const from = query.from ? new Date(query.from) : new Date(+to - 7 * 86400000);
  if (+from >= +to || +to > +now + 60000 || +to - +from > 90 * 86400000)
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      "Choose an increasing window of at most 90 days, ending no later than now.",
    );
  return { from, to, timezone: "UTC", bounds: "FROM_INCLUSIVE_TO_EXCLUSIVE" };
}
export function parseAnalyticsQuery(source, now) {
  const query = validate(analyticsQuery, source);
  return { ...query, window: dateWindow(query, now) };
}
