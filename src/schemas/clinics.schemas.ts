import { z } from 'zod';

// Esquema para crear una nueva clínica

export const CreateClinicSchema = z.object({
    clinic_name: z.string()
        .min(2, 'El nombre debe tener al menos 2 caracteres')
        .max(200, 'El nombre no puede exceder 200 caracteres'),

    clinic_code: z.string()
        .min(2, 'El código debe tener al menos 2 caracteres')
        .max(50, 'El código no puede exceder 50 caracteres')
        .regex(/^[A-Z0-9_-]+$/, 'El código solo puede contener letras mayúsculas, números, guiones y guiones bajos'),

    email: z.email('Email inválido').optional(),

    phone: z.string()
        .regex(/^[+]?[0-9\s\-\(\)]{10,20}$/, 'Formato de teléfono inválido')
        .optional(),

    website: z.url('URL inválida').optional(),

    // Dirección
    street: z.string().max(255).optional(),
    neighborhood: z.string().max(100).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    postal_code: z.string()
        .regex(/^[0-9]{5}$/, 'Código postal debe tener 5 dígitos')
        .optional(),
    country: z.string().max(100).default('México'),

    // Información fiscal
    rfc: z.string()
        .regex(/^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/, 'RFC inválido')
        .optional(),
    business_name: z.string().max(200).optional(),
    tax_regime: z.string().max(100).optional(),

    // Configuraciones
    timezone: z.string().default('America/Mexico_City'),
    currency: z.string().length(3).default('MXN'),
    language: z.string().length(2).default('es'),

    // Plan
    subscription_plan: z.enum(['basic', 'professional', 'enterprise']).default('basic'),
    max_users: z.number().int().min(1).max(1000).default(5),
    max_patients: z.number().int().min(1).max(100000).default(1000)
});

// Esquema para actualizar clínica
export const UpdateClinicSchema = CreateClinicSchema.partial().omit({
    clinic_code: true, // El código no debería poder cambiarse.
}).extend({
    is_active: z.boolean().optional() // Permitir cambiar el estado de la clínica
});

// Esquema para filtros de búsqueda
export const ClinicFiltersSchema = z.object({
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
  subscription_plan: z.enum(['basic', 'professional', 'enterprise']).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10)
});

// Tipos TypeScript inferidos
export type CreateClinicData = z.infer<typeof CreateClinicSchema>;
export type UpdateClinicData = z.infer<typeof UpdateClinicSchema>;
export type ClinicFilters = z.infer<typeof ClinicFiltersSchema>;