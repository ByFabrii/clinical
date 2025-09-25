/**
 * =================================================================
 * ESQUEMAS DE VALIDACIÓN - CITAS MÉDICAS
 * =================================================================
 * 
 * Este archivo contiene todas las validaciones para el módulo de citas.
 * Incluye validaciones específicas para sistemas dentales:
 * 
 * 1. Horarios de consulta (8:00 AM - 8:00 PM)
 * 2. Duración de citas (15 min - 4 horas)
 * 3. Estados específicos de citas dentales
 * 4. Tipos de procedimientos dentales
 * 
 * =================================================================
 */

import { z } from 'zod';

// =================================================================
// ENUMS Y CONSTANTES
// =================================================================

/**
 * Estados posibles de una cita dental
 * Basado en flujo real de clínicas dentales
 */
export enum AppointmentStatus {
  SCHEDULED = 'scheduled',     // Programada
  CONFIRMED = 'confirmed',     // Confirmada por paciente
  IN_PROGRESS = 'in_progress', // En curso
  COMPLETED = 'completed',     // Completada
  CANCELLED = 'cancelled',     // Cancelada
  NO_SHOW = 'no_show'         // Paciente no se presentó
}

/**
 * Tipos de citas dentales más comunes
 */
export enum AppointmentType {
  CONSULTATION = 'consultation',           // Consulta general
  CLEANING = 'cleaning',                   // Limpieza dental
  FILLING = 'filling',                     // Empaste/Obturación
  EXTRACTION = 'extraction',               // Extracción
  ROOT_CANAL = 'root_canal',              // Endodoncia
  CROWN = 'crown',                        // Corona
  ORTHODONTICS = 'orthodontics',          // Ortodoncia
  SURGERY = 'surgery',                    // Cirugía oral
  EMERGENCY = 'emergency',                // Emergencia
  FOLLOW_UP = 'follow_up'                 // Seguimiento
}

// =================================================================
// VALIDACIONES AUXILIARES
// =================================================================

/**
 * Validación de horario de consulta
 * Las clínicas dentales típicamente operan de 8:00 AM a 8:00 PM
 */
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

const validateBusinessHours = (time: string): boolean => {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = (hours || 0) * 60 + (minutes || 0);
  
  // 8:00 AM = 480 minutos, 8:00 PM = 1200 minutos
  return totalMinutes >= 480 && totalMinutes <= 1200;
};

/**
 * Validación de duración de cita
 * Mínimo 15 minutos, máximo 4 horas (240 minutos)
 */
const validateDuration = (duration: number): boolean => {
  return duration >= 15 && duration <= 240 && duration % 15 === 0;
};

// =================================================================
// TIPOS TYPESCRIPT
// =================================================================

export interface Appointment {
  id: string;
  patient_id: string;
  dentist_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  reason_for_visit?: string;
  notes?: string;
  cancellation_reason?: string;
  reminder_sent: boolean;
  reminder_sent_at?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
  clinic_id: string;
}

// =================================================================
// ESQUEMAS DE VALIDACIÓN
// =================================================================

/**
 * Schema para crear una nueva cita
 */
export const CreateAppointmentSchema = z.object({
  patient_id: z.string()
    .uuid('ID de paciente debe ser un UUID válido'),

  dentist_id: z.string()
    .uuid('ID de dentista debe ser un UUID válido'),

  appointment_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD')
    .refine((date) => {
      const appointmentDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // No permitir citas en el pasado
      return appointmentDate >= today;
    }, 'No se pueden programar citas en fechas pasadas'),

  start_time: z.string()
    .regex(timeRegex, 'Hora debe estar en formato HH:MM')
    .refine(validateBusinessHours, 'Hora debe estar entre 8:00 AM y 8:00 PM'),

  end_time: z.string()
    .regex(timeRegex, 'Hora debe estar en formato HH:MM')
    .refine(validateBusinessHours, 'Hora debe estar entre 8:00 AM y 8:00 PM'),

  duration_minutes: z.number()
    .int('Duración debe ser un número entero')
    .refine(validateDuration, 'Duración debe ser entre 15-240 minutos, múltiplo de 15'),

  appointment_type: z.nativeEnum(AppointmentType, {
    message: 'Tipo de cita inválido'
  }),

  reason_for_visit: z.string()
    .max(500, 'Motivo de visita no puede exceder 500 caracteres')
    .optional(),

  notes: z.string()
    .max(1000, 'Notas no pueden exceder 1000 caracteres')
    .optional()
})
.refine((data) => {
  // Validar que end_time sea después de start_time
  const [startHours, startMinutes] = data.start_time.split(':').map(Number);
  const [endHours, endMinutes] = data.end_time.split(':').map(Number);
  
  const startTotalMinutes = (startHours || 0) * 60 + (startMinutes || 0);
  const endTotalMinutes = (endHours || 0) * 60 + (endMinutes || 0);
  
  return endTotalMinutes > startTotalMinutes;
}, {
  message: 'Hora de fin debe ser posterior a hora de inicio',
  path: ['end_time']
})
.refine((data) => {
  // Validar que la duración coincida con el tiempo calculado
  const [startHours, startMinutes] = data.start_time.split(':').map(Number);
  const [endHours, endMinutes] = data.end_time.split(':').map(Number);
  
  const startTotalMinutes = (startHours || 0) * 60 + (startMinutes || 0);
  const endTotalMinutes = (endHours || 0) * 60 + (endMinutes || 0);
  const calculatedDuration = endTotalMinutes - startTotalMinutes;
  
  return calculatedDuration === data.duration_minutes;
}, {
  message: 'Duración no coincide con horario especificado',
  path: ['duration_minutes']
});

/**
 * Schema para actualizar una cita
 */
export const UpdateAppointmentSchema = CreateAppointmentSchema.partial()
  .omit({ patient_id: true }) // No se puede cambiar el paciente
  .extend({
    status: z.nativeEnum(AppointmentStatus).optional(),
    cancellation_reason: z.string()
      .max(500, 'Razón de cancelación no puede exceder 500 caracteres')
      .optional()
  });

/**
 * Schema para filtros de búsqueda
 */
export const AppointmentFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  
  // Filtros de fecha
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  
  // Filtros por entidades
  patient_id: z.string().uuid().optional(),
  dentist_id: z.string().uuid().optional(),
  
  // Filtros por estado y tipo
  status: z.nativeEnum(AppointmentStatus).optional(),
  appointment_type: z.nativeEnum(AppointmentType).optional(),
  
  // Búsqueda de texto
  search: z.string().max(100).optional(),
  
  // Ordenamiento
  sort_by: z.enum(['appointment_date', 'created_at', 'patient_name', 'dentist_name']).default('appointment_date'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

/**
 * Schema para cambiar estado de cita
 */
export const UpdateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
  cancellation_reason: z.string()
    .max(500, 'Razón de cancelación no puede exceder 500 caracteres')
    .optional()
})
.refine((data) => {
  // Si el estado es cancelado, debe haber una razón
  if (data.status === AppointmentStatus.CANCELLED) {
    return data.cancellation_reason && data.cancellation_reason.trim().length > 0;
  }
  return true;
}, {
  message: 'Razón de cancelación es requerida cuando se cancela una cita',
  path: ['cancellation_reason']
});

// =================================================================
// TIPOS DERIVADOS
// =================================================================

export type CreateAppointmentData = z.infer<typeof CreateAppointmentSchema>;
export type UpdateAppointmentData = z.infer<typeof UpdateAppointmentSchema>;
export type AppointmentFilters = z.infer<typeof AppointmentFiltersSchema>;
export type UpdateAppointmentStatusData = z.infer<typeof UpdateAppointmentStatusSchema>;

/**
 * =================================================================
 * NOTAS DE IMPLEMENTACIÓN
 * =================================================================
 * 
 * 1. **HORARIOS DE NEGOCIO**: Validamos que las citas estén dentro
 *    del horario típico de clínicas dentales (8 AM - 8 PM)
 * 
 * 2. **DURACIÓN REALISTA**: Las citas deben durar entre 15 minutos
 *    (consulta rápida) y 4 horas (cirugía compleja)
 * 
 * 3. **ESTADOS ESPECÍFICOS**: Los estados reflejan el flujo real
 *    de una clínica dental, incluyendo "no_show" que es común
 * 
 * 4. **TIPOS DE CITA**: Cubrimos los procedimientos dentales más
 *    comunes en clínicas mexicanas
 * 
 * 5. **VALIDACIONES CRUZADAS**: Verificamos que los horarios sean
 *    consistentes y que la duración coincida
 * 
 * 6. **CANCELACIONES**: Requerimos razón cuando se cancela una cita
 *    para mantener registros completos
 * 
 * =================================================================
 */