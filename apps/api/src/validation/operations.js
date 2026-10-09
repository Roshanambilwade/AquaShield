import { z } from "zod";
import { reportIdSchema } from "./report.js";
const quantity = z.number().int().min(0).max(100000);
const observedAt = z.iso
  .datetime()
  .transform((v) => new Date(v))
  .refine((v) => v <= new Date(), "Observation cannot be in the future.");
export const tankerInput = z
  .object({
    identifier: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9-]{2,40}$/),
    name: z.string().trim().min(2).max(120),
    capacityLitres: quantity.refine((v) => v > 0),
    availableLitres: quantity.nullable(),
    status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
    currentLocation: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .strict()
      .nullable(),
    observedAt: observedAt.nullable(),
    operatorId: reportIdSchema.nullable(),
  })
  .strict()
  .refine(
    (v) => v.availableLitres == null || v.availableLitres <= v.capacityLitres,
    "Available water exceeds capacity.",
  );
export const tankerUpdate = z
  .object({ revision: z.number().int().nonnegative(), tanker: tankerInput })
  .strict();
export const evidenceInput = z
  .object({
    demandLitres: z.number().positive().max(10000000).nullable(),
    recentDeliveredLitres: z.number().nonnegative().max(10000000).nullable(),
    source: z.string().trim().min(5).max(500),
    observedAt,
  })
  .strict();
export const recommendInput = z
  .object({
    eventId: reportIdSchema,
    requestId: z.uuid(),
    notes: z.string().trim().max(1200).default(""),
    useAi: z.boolean().default(false),
  })
  .strict();
