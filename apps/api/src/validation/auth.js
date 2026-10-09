import { z } from "zod";
export const registrationInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z
      .string()
      .trim()
      .pipe(z.email().max(254))
      .transform((v) => v.toLowerCase()),
    password: z.string().min(12).max(256),
  })
  .strict();
