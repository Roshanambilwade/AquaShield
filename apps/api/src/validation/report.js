import { z } from "zod";
import { ApiError } from "../middleware/errors.js";
import {
  PROBLEM_OPTIONS,
  WATER_LEVEL_OPTIONS,
  MAX_PHOTO_BYTES,
  LOCALITY_CENTERS,
} from "../../../../packages/shared/reportOptions.js";

export const citizenTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const reportIdSchema = z.string().regex(/^[a-f0-9]{24}$/i);

export const reportInputSchema = z
  .object({
    submissionId: z.uuid(),
    location: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .strict(),
    locationSource: z.enum(["DEVICE", "MANUAL", "LOCALITY_CENTER"]),
    accuracyMeters: z
      .number()
      .nonnegative()
      .max(100000)
      .nullable()
      .optional()
      .default(null),
    areaId: z
      .enum(LOCALITY_CENTERS.map((area) => area.id))
      .nullable()
      .optional()
      .default(null),
    locality: z.string().trim().min(2, "Enter an area or locality.").max(120),
    problem: z.enum(PROBLEM_OPTIONS.map((option) => option.value)),
    lastSupplyTime: z.iso
      .datetime({ offset: true })
      .refine(
        (value) => Date.parse(value) <= Date.now(),
        "Last supply time cannot be in the future.",
      )
      .nullable()
      .optional()
      .default(null),
    reportedDurationHours: z
      .number()
      .min(0)
      .max(8760)
      .nullable()
      .optional()
      .default(null),
    waterLevel: z.enum(WATER_LEVEL_OPTIONS.map((option) => option.value)),
    householdSize: z.number().int().min(1).max(100),
    description: z.string().trim().max(2000).optional().default(""),
    photo: z
      .string()
      .max(Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 40)
      .regex(
        /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/,
        "Use a JPEG or PNG photo.",
      )
      .optional(),
  })
  .strict();

export const reportQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    demo: z.enum(["true", "false"]).optional().default("false"),
  })
  .strict();

export function validate(
  schema,
  input,
  message = "Please check the report details.",
) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join(".") || "form";
      fields[field] ||= issue.message;
    }
    throw new ApiError(422, "VALIDATION_ERROR", message, { fields });
  }
  return result.data;
}
