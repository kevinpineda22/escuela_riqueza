import { z } from "zod";
import { PLANS } from "@/types/user";

export const createLiveSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(500).optional().default(""),
  startsAt: z.iso.datetime({ error: "Fecha inválida" }),
  durationMinutes: z.number().int().min(15).max(480),
  requiredPlan: z.enum([PLANS.INDIVIDUAL, PLANS.VIP]),
});

export type CreateLiveInput = z.infer<typeof createLiveSchema>;
