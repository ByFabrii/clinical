/**
 * =================================================================
 * ESQUEMAS DE VALIDACIÓN - NOTAS CLÍNICAS
 * =================================================================
 * 
 * Este archivo contiene todos los esquemas de validación para el módulo
 * de notas clínicas usando Zod. Incluye validaciones para:
 * 
 * 1. Creación de notas clínicas
 * 2. Actualización de notas clínicas
 * 3. Filtros de búsqueda
 * 4. Validaciones específicas por campo
 * 5. Cumplimiento normativo NOM-013 y NOM-024
 * 
 * =================================================================
 */

import { z } from 'zod';
import { 
  ClinicalNoteType, 
  ClinicalNoteStatus, 
  TreatmentType, 
  DiagnosisType,
  PrescriptionFrequency,
  PrescriptionUnit
} from '../types/clinical-notes';

// =================================================================
// VALIDACIONES AUXILIARES
// =================================================================

/**
 * Validación para códigos CIE-10 (Clasificación Internacional de Enfermedades)
 * Formato: Letra + 2-3 dígitos + punto opcional + 1-2 dígitos/letras
 */
const cie10Regex = /^[A-Z][0-9]{2,3}(\.[0-9A-Z]{1,2})?$/;

/**
 * Validación para códigos de medicamentos (formato mexicano)
 * Acepta códigos alfanuméricos de 6-20 caracteres
 */
const medicationCodeRegex = /^[A-Z0-9]{6,20}$/;

/**
 * Validación para dosis de medicamentos
 * Acepta números decimales seguidos de unidades
 */
const dosageRegex = /^[0-9]+(\.[0-9]+)?\s*(mg|g|ml|l|mcg|UI|%)?$/i;

/**
 * Validación para presión arterial
 * Formato: sistólica/diastólica (ej: 120/80)
 */
const bloodPressureRegex = /^[0-9]{2,3}\/[0-9]{2,3}$/;

/**
 * Validación para frecuencia cardíaca
 * Rango normal: 40-200 latidos por minuto
 */
const heartRateSchema = z.number().min(40).max(200);

/**
 * Validación para temperatura corporal
 * Rango normal: 35-42 grados Celsius
 */
const temperatureSchema = z.number().min(35).max(42);

// =================================================================
// ESQUEMAS AUXILIARES
// =================================================================

/**
 * Esquema para signos vitales
 */
export const VitalSignsSchema = z.object({
  blood_pressure: z.string()
    .regex(bloodPressureRegex, 'Formato de presión arterial inválido (ej: 120/80)')
    .optional(),
  
  heart_rate: heartRateSchema.optional(),
  
  temperature: temperatureSchema.optional(),
  
  respiratory_rate: z.number()
    .min(8, 'Frecuencia respiratoria mínima: 8 rpm')
    .max(60, 'Frecuencia respiratoria máxima: 60 rpm')
    .optional(),
  
  oxygen_saturation: z.number()
    .min(70, 'Saturación de oxígeno mínima: 70%')
    .max(100, 'Saturación de oxígeno máxima: 100%')
    .optional(),
  
  weight: z.number()
    .min(0.5, 'Peso mínimo: 0.5 kg')
    .max(500, 'Peso máximo: 500 kg')
    .optional(),
  
  height: z.number()
    .min(30, 'Altura mínima: 30 cm')
    .max(250, 'Altura máxima: 250 cm')
    .optional()
});

/**
 * Esquema para diagnósticos
 */
export const DiagnosisSchema = z.object({
  type: z.nativeEnum(DiagnosisType, {
    message: 'Tipo de diagnóstico inválido'
  }),
  
  cie10_code: z.string()
    .regex(cie10Regex, 'Código CIE-10 inválido')
    .optional(),
  
  description: z.string()
    .min(10, 'La descripción del diagnóstico debe tener al menos 10 caracteres')
    .max(1000, 'La descripción del diagnóstico no puede exceder 1000 caracteres'),
  
  severity: z.enum(['leve', 'moderado', 'severo', 'crítico'], {
    message: 'Severidad inválida'
  }).optional(),
  
  notes: z.string()
    .max(500, 'Las notas del diagnóstico no pueden exceder 500 caracteres')
    .optional()
});

/**
 * Esquema para tratamientos
 */
export const TreatmentSchema = z.object({
  type: z.nativeEnum(TreatmentType, {
    message: 'Tipo de tratamiento inválido'
  }),
  
  description: z.string()
    .min(10, 'La descripción del tratamiento debe tener al menos 10 caracteres')
    .max(1000, 'La descripción del tratamiento no puede exceder 1000 caracteres'),
  
  duration_days: z.number()
    .min(1, 'La duración mínima es 1 día')
    .max(365, 'La duración máxima es 365 días')
    .optional(),
  
  instructions: z.string()
    .max(1000, 'Las instrucciones no pueden exceder 1000 caracteres')
    .optional(),
  
  follow_up_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe estar en formato YYYY-MM-DD')
    .optional(),
  
  notes: z.string()
    .max(500, 'Las notas del tratamiento no pueden exceder 500 caracteres')
    .optional()
});

/**
 * Esquema para prescripciones médicas
 */
export const PrescriptionSchema = z.object({
  medication_name: z.string()
    .min(2, 'El nombre del medicamento debe tener al menos 2 caracteres')
    .max(200, 'El nombre del medicamento no puede exceder 200 caracteres'),
  
  medication_code: z.string()
    .regex(medicationCodeRegex, 'Código de medicamento inválido')
    .optional(),
  
  dosage: z.string()
    .regex(dosageRegex, 'Formato de dosis inválido (ej: 500mg, 2.5ml)')
    .max(50, 'La dosis no puede exceder 50 caracteres'),
  
  frequency: z.nativeEnum(PrescriptionFrequency, {
    message: 'Frecuencia de prescripción inválida'
  }),
  
  unit: z.nativeEnum(PrescriptionUnit, {
    message: 'Unidad de prescripción inválida'
  }),
  
  duration_days: z.number()
    .min(1, 'La duración mínima es 1 día')
    .max(365, 'La duración máxima es 365 días'),
  
  instructions: z.string()
    .min(5, 'Las instrucciones deben tener al menos 5 caracteres')
    .max(500, 'Las instrucciones no pueden exceder 500 caracteres'),
  
  contraindications: z.string()
    .max(500, 'Las contraindicaciones no pueden exceder 500 caracteres')
    .optional(),
  
  side_effects: z.string()
    .max(500, 'Los efectos secundarios no pueden exceder 500 caracteres')
    .optional()
});

// =================================================================
// ESQUEMA PRINCIPAL DE CREACIÓN
// =================================================================

export const CreateClinicalNoteSchema = z.object({
  // IDENTIFICADORES
  appointment_id: z.string()
    .uuid('ID de cita inválido'),

  medical_record_id: z.string()
    .uuid('ID de expediente médico inválido')
    .optional(),

  note_type: z.nativeEnum(ClinicalNoteType, {
    message: 'Tipo de nota clínica inválido'
  }),

  priority: z.enum(['routine', 'urgent', 'emergency'], {
    message: 'Prioridad inválida'
  }).optional(),
  
  // Motivo de consulta (requerido por NOM-013)
  chief_complaint: z.string()
    .min(10, 'El motivo de consulta debe tener al menos 10 caracteres')
    .max(1000, 'El motivo de consulta no puede exceder 1000 caracteres'),
  
  // Historia de la enfermedad actual (opcional)
  present_illness: z.string()
    .min(20, 'La historia de la enfermedad actual debe tener al menos 20 caracteres')
    .max(2000, 'La historia de la enfermedad actual no puede exceder 2000 caracteres')
    .optional(),
  
  // Exploración clínica (requerida por NOM-013)
  clinical_examination: z.string()
    .min(20, 'La exploración clínica debe tener al menos 20 caracteres')
    .max(2000, 'La exploración clínica no puede exceder 2000 caracteres'),
  
  // Signos vitales
  vital_signs: VitalSignsSchema.optional(),
  
  // Diagnóstico (obligatorio según NOM-013)
  diagnosis: z.object({
    primary_diagnosis: z.string()
      .min(5, 'El diagnóstico primario debe tener al menos 5 caracteres')
      .max(500, 'El diagnóstico primario no puede exceder 500 caracteres'),
    
    primary_icd10_code: z.string()
      .regex(cie10Regex, 'Código CIE-10 inválido'),
    
    primary_icd10_description: z.string()
      .max(500, 'La descripción CIE-10 no puede exceder 500 caracteres')
      .optional(),
    
    secondary_diagnoses: z.array(z.object({
      diagnosis: z.string().min(5).max(500),
      icd10_code: z.string().regex(cie10Regex),
      icd10_description: z.string().max(500).optional()
    })).optional(),
    
    differential_diagnosis: z.string()
      .max(1000, 'El diagnóstico diferencial no puede exceder 1000 caracteres')
      .optional(),
    
    prognosis: z.string()
      .max(500, 'El pronóstico no puede exceder 500 caracteres')
      .optional()
  }),

  // Plan de tratamiento (obligatorio según NOM-013)
  treatment_plan: z.object({
    description: z.string()
      .min(10, 'La descripción del plan debe tener al menos 10 caracteres')
      .max(2000, 'La descripción del plan no puede exceder 2000 caracteres'),
    
    procedures: z.array(z.object({
      name: z.string().min(2).max(200),
      tooth_numbers: z.array(z.number().min(1).max(32)).optional(),
      priority: z.enum(['high', 'medium', 'low']),
      estimated_sessions: z.number().min(1).max(50).optional(),
      notes: z.string().max(500).optional()
    })).optional(),
    
    prescriptions: z.array(z.object({
      medication: z.string().min(2).max(200),
      dosage: z.string().min(1).max(100),
      frequency: z.string().min(2).max(100),
      duration: z.string().min(2).max(100),
      instructions: z.string().min(5).max(500)
    })).optional(),
    
    recommendations: z.string()
      .max(1000, 'Las recomendaciones no pueden exceder 1000 caracteres')
      .optional(),
    
    home_care_instructions: z.string()
      .max(1000, 'Las instrucciones de cuidado no pueden exceder 1000 caracteres')
      .optional(),
    
    next_appointment_date: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe estar en formato YYYY-MM-DD')
      .optional(),
    
    next_appointment_notes: z.string()
      .max(500, 'Las notas de la próxima cita no pueden exceder 500 caracteres')
      .optional()
  }),

  // Procedimientos realizados
  procedures_performed: z.string()
    .max(2000, 'Los procedimientos realizados no pueden exceder 2000 caracteres')
    .optional(),

  // Materiales utilizados
  materials_used: z.string()
    .max(1000, 'Los materiales utilizados no pueden exceder 1000 caracteres')
    .optional(),

  // Notas adicionales
  additional_notes: z.string()
    .max(2000, 'Las notas adicionales no pueden exceder 2000 caracteres')
    .optional(),

  // Archivos adjuntos
  attached_files: z.array(z.string())
    .max(10, 'Máximo 10 archivos adjuntos')
    .optional()
});

// =================================================================
// ESQUEMA DE ACTUALIZACIÓN
// =================================================================

export const UpdateClinicalNoteSchema = CreateClinicalNoteSchema.partial().extend({
  status: z.nativeEnum(ClinicalNoteStatus, {
    message: 'Estado de nota clínica inválido'
  }).optional(),
  
  // Campos de auditoría (solo para actualización)
  reviewed_by: z.string()
    .uuid('ID de revisor inválido')
    .optional(),
  
  reviewed_at: z.string()
    .datetime('Fecha de revisión inválida')
    .optional(),
  
  revision_notes: z.string()
    .max(1000, 'Las notas de revisión no pueden exceder 1000 caracteres')
    .optional()
});

// =================================================================
// ESQUEMAS DE FILTROS Y BÚSQUEDA
// =================================================================

export const ClinicalNoteFiltersSchema = z.object({
  patient_id: z.string().uuid().optional(),
  type: z.nativeEnum(ClinicalNoteType).optional(),
  status: z.nativeEnum(ClinicalNoteStatus).optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  created_by: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
});

// =================================================================
// TIPOS DERIVADOS
// =================================================================

export type CreateClinicalNoteRequest = z.infer<typeof CreateClinicalNoteSchema>;
export type UpdateClinicalNoteRequest = z.infer<typeof UpdateClinicalNoteSchema>;
export type ClinicalNoteFilters = z.infer<typeof ClinicalNoteFiltersSchema>;
export type VitalSigns = z.infer<typeof VitalSignsSchema>;
export type Diagnosis = z.infer<typeof DiagnosisSchema>;
export type Treatment = z.infer<typeof TreatmentSchema>;
export type Prescription = z.infer<typeof PrescriptionSchema>;