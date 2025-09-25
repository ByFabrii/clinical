// Crear esquema para validar el registro de usuarios (RegisterSchema), para validar el login (LoginSchema), y para validar la actualización del perfil del usuario (UpdateProfileSchema).

import { z } from 'zod';

const RegisterSchema = z.object({
    email: z.string().regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Email inválido").refine((email) => email.includes("@") && email.endsWith(".com"), {
        message: "El email debe contener @ y terminar en .com"
    }),
    first_name: z.string().min(2),
    last_name: z.string().min(2),
    password: z.string().min(8),
    role: z.enum(["admin", "dentist", "assistant", "recepcionist"]),
    terms_accepted: z.boolean("Debe aceptar los términos y condiciones"),
    privacy_accepted: z.boolean("Debe aceptar la política de privacidad"),
    clinic_id: z.uuid("ID de clínica inválido"),
});

const LoginSchema = z.object({
    email: z.string().regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Email inválido").refine((email) => email.includes("@") && email.endsWith(".com"), {
        message: "El email debe contener @ y terminar en .com"
    }),
    password: z.string().min(3, "Debe contener al menos 3 caracteres"),
});

const UpdateProfileSchema = z.object({
    first_name: z.string().min(2).optional(),
    last_name: z.string().min(2).optional(),
    email: z.email("Email inválido").optional(),
    role: z.enum(["admin", "dentist", "assistant", "recepcionist"]).optional(),
    password: z.string().min(8, "Debe contener al menos 8 caracteres").optional(),
});

export { RegisterSchema, LoginSchema, UpdateProfileSchema };