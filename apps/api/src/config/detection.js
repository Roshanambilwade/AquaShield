import { z } from "zod";

const positive = (value) => z.coerce.number().positive().default(value);
const weights = (defaults) =>
  z
    .object(
      Object.fromEntries(
        Object.entries(defaults).map(([key, value]) => [
          key,
          z.number().min(0).max(100).default(value),
        ]),
      ),
    )
    .strict()
    .default(defaults)
    .refine(
      (value) =>
        Math.abs(
          Object.values(value).reduce((sum, weight) => sum + weight, 0) - 100,
        ) < 0.001,
      "Weights must sum to 100",
    );
const json = (schema) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }, schema);

export const detectionSchema = z
  .object({
    CLUSTER_RADIUS_KM: positive(1).pipe(z.number().max(50)),
    CLUSTER_TIME_WINDOW_HOURS: positive(6).pipe(z.number().max(168)),
    CLUSTER_ACTIVE_HOURS: positive(24).pipe(z.number().max(720)),
    CLUSTER_MIN_REPORTS: z.coerce.number().int().min(2).max(100).default(3),
    DUPLICATE_RADIUS_KM: positive(0.1).pipe(z.number().max(10)),
    DUPLICATE_WINDOW_HOURS: positive(6).pipe(z.number().max(168)),
    SUSPICIOUS_SPEED_KMH: positive(200),
    DURATION_CONFLICT_HOURS: positive(6),
    CONFIDENCE_INDEPENDENT_TARGET: positive(10),
    CONFIDENCE_CONFIRMED_THRESHOLD: z.coerce
      .number()
      .min(0)
      .max(100)
      .default(60),
    CONFIDENCE_WEIGHTS: json(
      weights({
        consistency: 35,
        geographic: 25,
        independent: 20,
        infrastructure: 10,
        time: 10,
      }),
    ),
    SEVERITY_WEIGHTS: json(
      weights({
        duration: 25,
        population: 20,
        waterLevel: 20,
        environmental: 15,
        vulnerability: 10,
        confidence: 10,
      }),
    ),
    SEVERITY_THRESHOLDS: json(
      z
        .object({
          medium: z.number().min(1).max(99),
          high: z.number().min(1).max(99),
          critical: z.number().min(1).max(100),
        })
        .strict()
        .default({ medium: 30, high: 60, critical: 80 })
        .refine(
          (v) => v.medium < v.high && v.high < v.critical,
          "Thresholds must be ascending",
        ),
    ),
    SEVERITY_DURATION_MAX_HOURS: positive(25),
    SEVERITY_POPULATION_MAX: positive(750),
    SEVERITY_TEMPERATURE_MIN_C: z.coerce.number().default(25),
    SEVERITY_TEMPERATURE_MAX_C: z.coerce.number().default(44),
    SEVERITY_VULNERABILITY_MAX_RATIO: positive(0.25).pipe(z.number().max(1)),
    POPULATION_REPORT_COVERAGE: z.coerce
      .number()
      .positive()
      .max(1)
      .default(0.25),
  })
  .refine(
    (v) => v.SEVERITY_TEMPERATURE_MAX_C > v.SEVERITY_TEMPERATURE_MIN_C,
    "Temperature bounds must be ascending",
  );

export function detectionConfig(source = {}) {
  return detectionSchema.parse(source);
}
