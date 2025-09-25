/**
 * =================================================================
 * ESQUEMAS DE VALIDACIÓN - PACIENTES
 * =================================================================
 * 
 * Este archivo contiene todos los esquemas de validación para el módulo
 * de pacientes usando Zod. Incluye validaciones para:
 * 
 * 1. Creación de pacientes
 * 2. Actualización de pacientes
 * 3. Filtros de búsqueda
 * 4. Validaciones específicas por campo
 * 
 * =================================================================
 */

import { z } from 'zod';

// =================================================================
// VALIDACIONES AUXILIARES
// =================================================================

/**
 * Validación para CURP (Clave Única de Registro de Población)
 * Formato: 4 letras + 6 dígitos + 1 letra + 1 dígito + 1 letra + 2 caracteres
 */
const curpRegex = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z][0-9]$/;

/**
 * Validación para RFC (Registro Federal de Contribuyentes)
 * Formato: 4 letras + 6 dígitos + 3 caracteres alfanuméricos
 */
const rfcRegex = /^[A-Z&Ñ]{4}[0-9]{6}[A-Z0-9]{3}$/;

/**
 * Validación para teléfonos mexicanos
 * Acepta formatos: +52 55 1234 5678, 55-1234-5678, (55) 1234-5678, etc.
 */
const phoneRegex = /^[+]?[0-9\s\-\(\)]{10,20}$/;

/**
 * Validación para código postal mexicano (5 dígitos)
 */
const postalCodeRegex = /^[0-9]{5}$/;

// =================================================================
// ESQUEMA PRINCIPAL DE CREACIÓN
// =================================================================

export const CreatePatientSchema = z.object({
  // Información personal básica
  first_name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras y espacios'),

  last_name: z.string()
    .min(2, 'El apellido paterno debe tener al menos 2 caracteres')
    .max(100, 'El apellido paterno no puede exceder 100 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El apellido solo puede contener letras y espacios'),

  second_last_name: z.string()
    .min(2, 'El apellido materno debe tener al menos 2 caracteres')
    .max(100, 'El apellido materno no puede exceder 100 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El apellido solo puede contener letras y espacios')
    .optional(),

  date_of_birth: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe estar en formato YYYY-MM-DD')
    .refine((date) => {
      const birthDate = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      return age >= 0 && age <= 120;
    }, 'La fecha de nacimiento debe ser válida y la edad entre 0 y 120 años'),

  gender: z.enum(['male', 'female', 'other'], {
    message: 'El género debe ser male, female o other'
  }),

  // Documentos de identificación
  curp: z.string()
    .length(18, 'El CURP debe tener exactamente 18 caracteres')
    .regex(curpRegex, 'Formato de CURP inválido')
    .optional(),

  rfc: z.string()
    .length(13, 'El RFC debe tener exactamente 13 caracteres')
    .regex(rfcRegex, 'Formato de RFC inválido')
    .optional(),

  // Información de contacto
  email: z.string()
    .email('Formato de email inválido')
    .max(255, 'El email no puede exceder 255 caracteres')
    .optional(),

  phone: z.string()
    .regex(phoneRegex, 'Formato de teléfono inválido')
    .optional(),

  mobile_phone: z.string()
    .regex(phoneRegex, 'Formato de teléfono móvil inválido')
    .optional(),

  // Contacto de emergencia
  emergency_contact_name: z.string()
    .min(2, 'El nombre del contacto de emergencia debe tener al menos 2 caracteres')
    .max(200, 'El nombre del contacto de emergencia no puede exceder 200 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras y espacios')
    .optional(),

  emergency_contact_phone: z.string()
    .regex(phoneRegex, 'Formato de teléfono de emergencia inválido')
    .optional(),

  // Dirección
  street: z.string()
    .max(255, 'La calle no puede exceder 255 caracteres')
    .optional(),

  neighborhood: z.string()
    .max(100, 'La colonia no puede exceder 100 caracteres')
    .optional(),

  city: z.string()
    .max(100, 'La ciudad no puede exceder 100 caracteres')
    .optional(),

  state: z.string()
    .max(100, 'El estado no puede exceder 100 caracteres')
    .optional(),

  postal_code: z.string()
    .regex(postalCodeRegex, 'El código postal debe tener 5 dígitos')
    .optional(),

  country: z.string()
    .max(100, 'El país no puede exceder 100 caracteres')
    .default('México'),

  // Información del seguro médico
  insurance_company: z.string()
    .max(200, 'La compañía de seguros no puede exceder 200 caracteres')
    .optional(),

  insurance_number: z.string()
    .max(100, 'El número de seguro no puede exceder 100 caracteres')
    .optional(),

  insurance_type: z.enum(['IMSS', 'ISSSTE', 'PEMEX', 'SEDENA', 'SEMAR', 'PRIVADO', 'OTRO'], {
    message: 'Tipo de seguro inválido'
  }).optional(),

  // Información médica básica
  blood_type: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], {
    message: 'Tipo de sangre inválido'
  }).optional(),

  // Información personal adicional
  marital_status: z.enum(['SOLTERO', 'CASADO', 'DIVORCIADO', 'VIUDO', 'UNION_LIBRE'], {
    message: 'Estado civil inválido'
  }).optional(),

  occupation: z.string()
    .max(100, 'La ocupación no puede exceder 100 caracteres')
    .optional(),

  // Campos adicionales para expediente médico
  // Campos birth_place, nationality y education_level removidos
  // porque no existen en la tabla patients de la base de datos

  // Campo emergency_contact_relationship removido
  // porque no existe en la tabla patients de la base de datos

  // Campo opcional para auditoría (se obtiene automáticamente del usuario autenticado)
  created_by: z.string()
    .uuid('El ID del usuario creador debe ser un UUID válido')
    .optional()

});

// =================================================================
// ESQUEMA DE ACTUALIZACIÓN
// =================================================================

/**
 * Schema para actualizar pacientes
 * Todos los campos son opcionales excepto aquellos que no deberían cambiar
 */
export const UpdatePatientSchema = CreatePatientSchema.partial().extend({
  is_active: z.boolean().optional() // Permitir cambiar el estado del paciente
});

// =================================================================
// ESQUEMA DE FILTROS DE BÚSQUEDA
// =================================================================

export const PatientFiltersSchema = z.object({
  // Búsqueda general
  search: z.string()
    .max(255, 'El término de búsqueda no puede exceder 255 caracteres')
    .optional(),

  // Filtros específicos
  is_active: z.coerce.boolean().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  blood_type: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  marital_status: z.enum(['SOLTERO', 'CASADO', 'DIVORCIADO', 'VIUDO', 'UNION_LIBRE']).optional(),
  insurance_type: z.enum(['IMSS', 'ISSSTE', 'PEMEX', 'SEDENA', 'SEMAR', 'PRIVADO', 'OTRO']).optional(),

  // Filtros de ubicación
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),

  // Filtros de edad
  min_age: z.coerce.number().int().min(0).max(120).optional(),
  max_age: z.coerce.number().int().min(0).max(120).optional(),

  // Filtros de fecha
  registration_date_from: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe estar en formato YYYY-MM-DD')
    .optional(),
  registration_date_to: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe estar en formato YYYY-MM-DD')
    .optional(),

  // Paginación
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),

  // Ordenamiento
  sort_by: z.enum(['first_name', 'last_name', 'date_of_birth', 'registration_date', 'created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
}).refine((data) => {
  // Validar que min_age no sea mayor que max_age
  if (data.min_age !== undefined && data.max_age !== undefined) {
    return data.min_age <= data.max_age;
  }
  return true;
}, {
  message: 'La edad mínima no puede ser mayor que la edad máxima',
  path: ['min_age']
}).refine((data) => {
  // Validar que registration_date_from no sea mayor que registration_date_to
  if (data.registration_date_from && data.registration_date_to) {
    return new Date(data.registration_date_from) <= new Date(data.registration_date_to);
  }
  return true;
}, {
  message: 'La fecha de inicio no puede ser mayor que la fecha de fin',
  path: ['registration_date_from']
});

// =================================================================
// ESQUEMAS AUXILIARES
// =================================================================

/**
 * Schema para validar solo el ID del paciente
 */
export const PatientIdSchema = z.object({
  id: z.string().uuid('ID de paciente inválido')
});

/**
 * Schema para operaciones de cambio de estado
 */
export const TogglePatientStatusSchema = z.object({
  is_active: z.boolean()
});

// =================================================================
// TIPOS TYPESCRIPT
// =================================================================

export type CreatePatientData = z.infer<typeof CreatePatientSchema>;
export type UpdatePatientData = z.infer<typeof UpdatePatientSchema>;
export type PatientFilters = z.infer<typeof PatientFiltersSchema>;
export type PatientId = z.infer<typeof PatientIdSchema>;
export type TogglePatientStatus = z.infer<typeof TogglePatientStatusSchema>;

// =================================================================
// NOTAS DE IMPLEMENTACIÓN
// =================================================================
/*

1. **VALIDACIONES ESPECÍFICAS PARA MÉXICO**:
   - CURP: Validación completa del formato oficial
   - RFC: Validación del formato fiscal mexicano
   - Código postal: 5 dígitos numéricos
   - Tipos de seguro: Instituciones mexicanas comunes

2. **FLEXIBILIDAD**:
   - Muchos campos son opcionales para permitir registro gradual
   - Validaciones de formato pero no de existencia real
   - Soporte para diferentes tipos de contacto

3. **SEGURIDAD**:
   - Validación de longitudes para prevenir ataques
   - Sanitización de caracteres especiales
   - Validación de formatos de email y teléfono

4. **USABILIDAD**:
   - Mensajes de error descriptivos en español
   - Validaciones cruzadas (fechas, edades)
   - Valores por defecto sensatos

5. **ESCALABILIDAD**:
   - Esquemas modulares y reutilizables
   - Tipos TypeScript exportados
   - Fácil extensión para nuevos campos

*/

