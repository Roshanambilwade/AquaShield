import { z } from "zod";
export const emptyTripInput = z.object({}).strict();
export const otpInput = z
  .object({ code: z.string().regex(/^\d{6}$/) })
  .strict();
export const completeInput = z
  .object({ litresDelivered: z.number().int().positive().max(100000) })
  .strict();
