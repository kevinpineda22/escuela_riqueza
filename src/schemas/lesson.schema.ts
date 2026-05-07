import { z } from "zod";

export const uploadLessonSchema = z.object({
  title: z.string().min(3, { error: "El título debe tener al menos 3 caracteres" }).max(120),
  moduleId: z.string().min(1, { error: "Seleccioná un módulo" }),
  description: z.string().max(500).optional().default(""),
  isPremium: z.boolean().default(true),
});

export type UploadLessonInput = z.infer<typeof uploadLessonSchema>;
