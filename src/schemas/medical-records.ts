import { z } from 'zod';
import {
  BloodType,
  MaritalStatus,
  EducationLevel,
  OccupationType,
  Frequency,
  MedicalRecordStatus,
  MEDICAL_RECORD_CONSTRAINTS
} from '../types/medical-records';

// ============================================================================
// ESQUEMAS BASE
// ============================================================================

/**
 * Esquema para información demográfica
 */
export const demographicInfoSchema = z.object({
  birth_place: z.string().min(1).max(100).optional(),
  nationality: z.string().min(1).max(50).optional(),
  marital_status: z.nativeEnum(MaritalStatus).optional(),
  education_level: z.nativeEnum(EducationLevel).optional(),
  occupation: z.string().min(1).max(100).optional(),
  occupation_type: z.nativeEnum(OccupationType).optional(),
  emergency_contact_name: z.string().min(1).max(100).optional(),
  emergency_contact_phone: z.string().regex(/^[+]?[0-9\s\-\(\)]{10,15}$/).optional(),
  emergency_contact_relationship: z.string().min(1).max(50).optional()
}).strict();

/**
 * Esquema para antecedentes familiares
 */
export const familyHistorySchema = z.object({
  diabetes: z.boolean().optional(),
  hypertension: z.boolean().optional(),
  heart_disease: z.boolean().optional(),
  cancer: z.boolean().optional(),
  mental_illness: z.boolean().optional(),
  allergies: z.boolean().optional(),
  other_conditions: z.string().max(500).optional(),
  notes: z.string().max(1000).optional()
}).strict();

/**
 * Esquema para antecedentes personales
 */
export const personalHistorySchema = z.object({
  chronic_diseases: z.array(z.string().min(1).max(100)).max(20).optional(),
  surgeries: z.array(z.string().min(1).max(100)).max(20).optional(),
  hospitalizations: z.array(z.string().min(1).max(100)).max(20).optional(),
  allergies: z.array(z.string().min(1).max(100)).max(20).optional(),
  current_medications: z.array(z.string().min(1).max(100)).max(50).optional(),
  immunizations: z.array(z.string().min(1).max(100)).max(30).optional(),
  notes: z.string().max(1000).optional()
}).strict();

/**
 * Esquema para hábitos del paciente
 */
export const patientHabitsSchema = z.object({
  smoking: z.object({
    status: z.boolean(),
    frequency: z.nativeEnum(Frequency).optional(),
    quantity: z.string().max(50).optional(),
    duration: z.string().max(50).optional(),
    quit_date: z.string().datetime().optional()
  }).strict().optional(),
  
  alcohol: z.object({
    status: z.boolean(),
    frequency: z.nativeEnum(Frequency).optional(),
    quantity: z.string().max(50).optional(),
    type: z.string().max(50).optional()
  }).strict().optional(),
  
  drugs: z.object({
    status: z.boolean(),
    substances: z.array(z.string().min(1).max(50)).max(10).optional(),
    frequency: z.nativeEnum(Frequency).optional()
  }).strict().optional(),
  
  exercise: z.object({
    status: z.boolean(),
    frequency: z.nativeEnum(Frequency).optional(),
    type: z.string().max(100).optional(),
    duration: z.string().max(50).optional()
  }).strict().optional(),
  
  diet: z.object({
    type: z.string().max(100).optional(),
    restrictions: z.array(z.string().min(1).max(50)).max(20).optional(),
    notes: z.string().max(500).optional()
  }).strict().optional(),
  
  sleep: z.object({
    hours_per_night: z.number().min(0).max(24).optional(),
    quality: z.enum(['BUENA', 'REGULAR', 'MALA']).optional(),
    disorders: z.array(z.string().min(1).max(100)).max(10).optional()
  }).strict().optional()
}).strict();

/**
 * Esquema para signos vitales
 */
export const vitalSignsSchema = z.object({
  height: z.number()
    .min(MEDICAL_RECORD_CONSTRAINTS.VITAL_SIGNS.HEIGHT.MIN)
    .max(MEDICAL_RECORD_CONSTRAINTS.VITAL_SIGNS.HEIGHT.MAX)
    .optional(),
  weight: z.number()
    .min(MEDICAL_RECORD_CONSTRAINTS.VITAL_SIGNS.WEIGHT.MIN)
    .max(MEDICAL_RECORD_CONSTRAINTS.VITAL_SIGNS.WEIGHT.MAX)
    .optional(),
  bmi: z.number().min(10).max(100).optional(),
  blood_pressure_systolic: z.number()
    .min(MEDICAL_RECORD_CONSTRAINTS.VITAL_SIGNS.BLOOD_PRESSURE.MIN)
    .max(MEDICAL_RECORD_CONSTRAINTS.VITAL_SIGNS.BLOOD_PRESSURE.MAX)
    .optional(),
  blood_pressure_diastolic: z.number()
    .min(MEDICAL_RECORD_CONSTRAINTS.VITAL_SIGNS.BLOOD_PRESSURE.MIN)
    .max(MEDICAL_RECORD_CONSTRAINTS.VITAL_SIGNS.BLOOD_PRESSURE.MAX)
    .optional(),
  heart_rate: z.number()
    .min(MEDICAL_RECORD_CONSTRAINTS.VITAL_SIGNS.HEART_RATE.MIN)
    .max(MEDICAL_RECORD_CONSTRAINTS.VITAL_SIGNS.HEART_RATE.MAX)
    .optional(),
  respiratory_rate: z.number()
    .min(MEDICAL_RECORD_CONSTRAINTS.VITAL_SIGNS.RESPIRATORY_RATE.MIN)
    .max(MEDICAL_RECORD_CONSTRAINTS.VITAL_SIGNS.RESPIRATORY_RATE.MAX)
    .optional(),
  temperature: z.number()
    .min(MEDICAL_RECORD_CONSTRAINTS.VITAL_SIGNS.TEMPERATURE.MIN)
    .max(MEDICAL_RECORD_CONSTRAINTS.VITAL_SIGNS.TEMPERATURE.MAX)
    .optional(),
  oxygen_saturation: z.number()
    .min(MEDICAL_RECORD_CONSTRAINTS.VITAL_SIGNS.OXYGEN_SATURATION.MIN)
    .max(MEDICAL_RECORD_CONSTRAINTS.VITAL_SIGNS.OXYGEN_SATURATION.MAX)
    .optional(),
  recorded_at: z.string().datetime().optional(),
  recorded_by: z.string().uuid().optional()
}).strict()
.refine((data) => {
  // Validar que la presión sistólica sea mayor que la diastólica
  if (data.blood_pressure_systolic && data.blood_pressure_diastolic) {
    return data.blood_pressure_systolic > data.blood_pressure_diastolic;
  }
  return true;
}, {
  message: "La presión sistólica debe ser mayor que la diastólica",
  path: ["blood_pressure_systolic"]
})
.refine((data) => {
  // Calcular BMI si se proporcionan altura y peso
  if (data.height && data.weight) {
    const heightInMeters = data.height / 100;
    const calculatedBMI = data.weight / (heightInMeters * heightInMeters);
    
    if (data.bmi && Math.abs(data.bmi - calculatedBMI) > 0.5) {
      return false;
    }
  }
  return true;
}, {
  message: "El BMI calculado no coincide con el proporcionado",
  path: ["bmi"]
});

// ============================================================================
// ESQUEMAS PRINCIPALES
// ============================================================================

/**
 * Esquema para crear un expediente médico
 */
export const createMedicalRecordSchema = z.object({
  patient_id: z.string().uuid("ID de paciente debe ser un UUID válido"),
  demographic_info: demographicInfoSchema.optional(),
  blood_type: z.nativeEnum(BloodType).optional(),
  family_history: familyHistorySchema.optional(),
  personal_history: personalHistorySchema.optional(),
  habits: patientHabitsSchema.optional(),
  latest_vital_signs: vitalSignsSchema.optional(),
  notes: z.string().max(MEDICAL_RECORD_CONSTRAINTS.NOTES.MAX_LENGTH).optional()
}).strict()
.refine((data) => {
  // Validar que al menos un campo opcional esté presente
  const hasOptionalData = 
    data.demographic_info ||
    data.blood_type ||
    data.family_history ||
    data.personal_history ||
    data.habits ||
    data.latest_vital_signs ||
    data.notes;
  
  return hasOptionalData;
}, {
  message: "Debe proporcionar al menos un campo de información médica",
  path: ["root"]
});

/**
 * Esquema para actualizar un expediente médico
 */
export const updateMedicalRecordSchema = z.object({
  demographic_info: demographicInfoSchema.optional(),
  blood_type: z.nativeEnum(BloodType).optional(),
  family_history: familyHistorySchema.optional(),
  personal_history: personalHistorySchema.optional(),
  habits: patientHabitsSchema.optional(),
  latest_vital_signs: vitalSignsSchema.optional(),
  status: z.nativeEnum(MedicalRecordStatus).optional(),
  notes: z.string().max(MEDICAL_RECORD_CONSTRAINTS.NOTES.MAX_LENGTH).optional()
}).strict()
.refine((data) => {
  // Validar que al menos un campo esté presente para actualización
  const hasUpdateData = Object.keys(data).length > 0;
  return hasUpdateData;
}, {
  message: "Debe proporcionar al menos un campo para actualizar",
  path: ["root"]
});

/**
 * Esquema para filtros de búsqueda
 */
export const medicalRecordFiltersSchema = z.object({
  patient_id: z.string().uuid().optional(),
  status: z.nativeEnum(MedicalRecordStatus).optional(),
  blood_type: z.nativeEnum(BloodType).optional(),
  created_from: z.string().datetime().optional(),
  created_to: z.string().datetime().optional(),
  updated_from: z.string().datetime().optional(),
  updated_to: z.string().datetime().optional(),
  has_chronic_diseases: z.boolean().optional(),
  has_allergies: z.boolean().optional(),
  search: z.string().min(1).max(100).optional()
}).strict()
.refine((data) => {
  // Validar rangos de fechas
  if (data.created_from && data.created_to) {
    return new Date(data.created_from) <= new Date(data.created_to);
  }
  return true;
}, {
  message: "La fecha de inicio debe ser anterior a la fecha de fin",
  path: ["created_from"]
})
.refine((data) => {
  if (data.updated_from && data.updated_to) {
    return new Date(data.updated_from) <= new Date(data.updated_to);
  }
  return true;
}, {
  message: "La fecha de inicio debe ser anterior a la fecha de fin",
  path: ["updated_from"]
});

/**
 * Esquema para parámetros de paginación
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sort_by: z.enum(['created_at', 'updated_at', 'record_number', 'patient_name']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
}).strict();

/**
 * Esquema para parámetros de ID
 */
export const medicalRecordIdSchema = z.object({
  id: z.string().uuid("ID del expediente médico debe ser un UUID válido")
}).strict();

/**
 * Esquema para parámetros de ID de paciente
 */
export const patientIdSchema = z.object({
  patient_id: z.string().uuid("ID del paciente debe ser un UUID válido")
}).strict();

// ============================================================================
// ESQUEMAS DE RESPUESTA
// ============================================================================

/**
 * Esquema para expediente médico completo
 */
export const medicalRecordSchema = z.object({
  id: z.string().uuid(),
  patient_id: z.string().uuid(),
  record_number: z.string(),
  status: z.nativeEnum(MedicalRecordStatus),
  demographic_info: demographicInfoSchema.optional(),
  blood_type: z.nativeEnum(BloodType).optional(),
  family_history: familyHistorySchema.optional(),
  personal_history: personalHistorySchema.optional(),
  habits: patientHabitsSchema.optional(),
  latest_vital_signs: vitalSignsSchema.optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  created_by: z.string().uuid(),
  updated_by: z.string().uuid().optional(),
  notes: z.string().optional()
}).strict();

/**
 * Esquema para respuesta paginada
 */
export const medicalRecordsPaginatedResponseSchema = z.object({
  data: z.array(medicalRecordSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  totalPages: z.number().int().min(0)
}).strict();

/**
 * Esquema para resumen de expediente médico
 */
export const medicalRecordSummarySchema = z.object({
  id: z.string().uuid(),
  patient_id: z.string().uuid(),
  record_number: z.string(),
  status: z.nativeEnum(MedicalRecordStatus),
  blood_type: z.nativeEnum(BloodType).optional(),
  has_chronic_diseases: z.boolean(),
  has_allergies: z.boolean(),
  last_updated: z.string().datetime(),
  patient_name: z.string()
}).strict();

// ============================================================================
// VALIDADORES PERSONALIZADOS
// ============================================================================

/**
 * Validador para número de expediente
 */
export const validateRecordNumber = (recordNumber: string): boolean => {
  const { MIN_LENGTH, MAX_LENGTH, PATTERN } = MEDICAL_RECORD_CONSTRAINTS.RECORD_NUMBER;
  
  if (recordNumber.length < MIN_LENGTH || recordNumber.length > MAX_LENGTH) {
    return false;
  }
  
  return PATTERN.test(recordNumber);
};

/**
 * Validador para completitud del expediente
 */
export const validateRecordCompleteness = (record: any): {
  isComplete: boolean;
  missingFields: string[];
  completionPercentage: number;
} => {
  const requiredFields = [
    'blood_type',
    'family_history',
    'personal_history',
    'latest_vital_signs'
  ];
  
  const optionalFields = [
    'demographic_info',
    'habits',
    'notes'
  ];
  
  const allFields = [...requiredFields, ...optionalFields];
  const missingFields: string[] = [];
  let presentFields = 0;
  
  for (const field of allFields) {
    if (record[field] && Object.keys(record[field]).length > 0) {
      presentFields++;
    } else if (requiredFields.includes(field)) {
      missingFields.push(field);
    }
  }
  
  const completionPercentage = Math.round((presentFields / allFields.length) * 100);
  const isComplete = missingFields.length === 0;
  
  return {
    isComplete,
    missingFields,
    completionPercentage
  };
};

// ============================================================================
// EXPORTACIONES DE TIPOS INFERIDOS
// ============================================================================

export type CreateMedicalRecordInput = z.infer<typeof createMedicalRecordSchema>;
export type UpdateMedicalRecordInput = z.infer<typeof updateMedicalRecordSchema>;
export type MedicalRecordFiltersInput = z.infer<typeof medicalRecordFiltersSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type MedicalRecordIdInput = z.infer<typeof medicalRecordIdSchema>;
export type PatientIdInput = z.infer<typeof patientIdSchema>;
export type MedicalRecordOutput = z.infer<typeof medicalRecordSchema>;
export type MedicalRecordsPaginatedOutput = z.infer<typeof medicalRecordsPaginatedResponseSchema>;
export type MedicalRecordSummaryOutput = z.infer<typeof medicalRecordSummarySchema>;
export type DemographicInfoInput = z.infer<typeof demographicInfoSchema>;
export type FamilyHistoryInput = z.infer<typeof familyHistorySchema>;
export type PersonalHistoryInput = z.infer<typeof personalHistorySchema>;
export type PatientHabitsInput = z.infer<typeof patientHabitsSchema>;
export type VitalSignsInput = z.infer<typeof vitalSignsSchema>;