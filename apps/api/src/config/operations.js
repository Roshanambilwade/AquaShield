import { z } from "zod";
export const operationsSchema = z.object({
  OPERATIONS_STALE_HOURS: z.coerce.number().min(0.1).max(168).default(12),
  ROUTING_AVERAGE_SPEED_KPH: z.coerce.number().min(5).max(100).default(25),
  ROUTING_TIMEOUT_MS: z.coerce.number().int().min(100).max(10000).default(5000),
  ROUTING_BASE_URL: z
    .string()
    .default("")
    .refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        );
      } catch {
        return false;
      }
    }),
  DELIVERY_OTP_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(900)
    .default(300),
  DELIVERY_OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  DELIVERY_OTP_REISSUE_SECONDS: z.coerce
    .number()
    .int()
    .min(15)
    .max(300)
    .default(60),
});
