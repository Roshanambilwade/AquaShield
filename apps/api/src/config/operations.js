import { z } from "zod";
export const operationsSchema = z.object({
  OPERATIONS_STALE_HOURS: z.coerce.number().min(0.1).max(168).default(12),
});
