import { z } from "zod";

export const loginSchema = z.object({
  email: z.email({ error: "Ingresá un email válido" }),
  password: z.string().min(8, { error: "La contraseña debe tener al menos 8 caracteres" }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    fullName: z.string().min(2, { error: "Tu nombre completo es requerido" }),
    email: z.email({ error: "Ingresá un email válido" }),
    password: z.string().min(8, { error: "La contraseña debe tener al menos 8 caracteres" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email({ error: "Ingresá un email válido" }),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
