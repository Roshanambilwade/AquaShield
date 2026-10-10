import { z } from "zod";

export const predictionSchema = z
  .object({
    PREDICTION_WINDOW_HOURS: z.coerce
      .number()
      .refine((v) => [3, 6, 12].includes(v))
      .default(6),
    PREDICTION_HISTORY_WINDOWS: z.coerce
      .number()
      .int()
      .min(8)
      .max(28)
      .default(12),
    PREDICTION_MIN_REPORTS: z.coerce
      .number()
      .int()
      .min(8)
      .max(1000)
      .default(18),
    PREDICTION_MIN_REPORTERS: z.coerce
      .number()
      .int()
      .min(3)
      .max(100)
      .default(6),
    PREDICTION_STALE_HOURS: z.coerce.number().min(3).max(72).default(12),
    PREDICTION_MODERATE_THRESHOLD: z.coerce.number().min(1).max(98).default(25),
    PREDICTION_HIGH_THRESHOLD: z.coerce.number().min(2).max(99).default(50),
    PREDICTION_CRITICAL_THRESHOLD: z.coerce
      .number()
      .min(3)
      .max(100)
      .default(75),
  })
  .refine(
    (v) =>
      v.PREDICTION_MODERATE_THRESHOLD < v.PREDICTION_HIGH_THRESHOLD &&
      v.PREDICTION_HIGH_THRESHOLD < v.PREDICTION_CRITICAL_THRESHOLD,
    "Risk thresholds must ascend",
  );
export const predictionConfig = (source = {}) => predictionSchema.parse(source);
