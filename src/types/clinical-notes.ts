/**
 * =================================================================
 * TIPOS DE NOTAS CLÍNICAS - SISTEMA EXPEDIENTES DENTALES
 * =================================================================
 * 
 * Este archivo define todos los tipos TypeScript relacionados con
 * las notas clínicas del sistema, cumpliendo con:
 * - NOM-013-SSA2-2015 (Para la atención integral a la salud)
 * - NOM-024-SSA3-2012 (Sistemas de información de registro electrónico)
 * 
 * CONCEPTOS CLAVE:
 * 1. Nota clínica obligatoria por consulta
 * 2. Elementos mínimos requeridos por normativa
 * 3. Trazabilidad y auditoría
 * 4. Integración con citas y expedientes
 * 
 * ELEMENTOS OBLIGATORIOS NOM-013:
 * - Fecha y hora de la consulta
 * - Motivo de consulta (chief_complaint)
 * - Exploración clínica (clinical_examination)
 * - Diagnóstico con código CIE-10 (diagnosis + icd10_code)
 * - Plan de tratamiento (treatment_plan)
 * - Evolución clínica (present_illness)
 * - Signos vitales cuando aplique
 * - Nombre y firma del profesional
 * 
 * =================================================================
 */

// =================================================================
// ENUMS Y CONSTANTES
// =================================================================

/**
 * Tipos de notas clínicas según el propósito
 */
export enum ClinicalNoteType {
  // Primera consulta/evaluación inicial
  INITIAL_CONSULTATION = 'initial_consultation',
  
  // Consulta de seguimiento
  FOLLOW_UP = 'follow_up',
  
  // Consulta de urgencia/emergencia
  EMERGENCY = 'emergency',
  
  // Consulta de control post-tratamiento
  POST_TREATMENT = 'post_treatment',
  
  // Consulta de revisión/mantenimiento
  MAINTENANCE = 'maintenance',
  
  // Interconsulta con especialista
  REFERRAL = 'referral'
}

/**
 * Estados de la nota clínica
 */
export enum ClinicalNoteStatus {
  // Borrador (en proceso de creación)
  DRAFT = 'draft',
  
  // Completada y firmada
  COMPLETED = 'completed',
  
  // Revisada por supervisor
  REVIEWED = 'reviewed',
  
  // Archivada (solo lectura)
  ARCHIVED = 'archived'
}

/**
 * Prioridad de la consulta
 */
export enum ConsultationPriority {
  // Rutina/programada
  ROUTINE = 'routine',
  
  // Urgente (mismo día)
  URGENT = 'urgent',
  
  // Emergencia (inmediata)
  EMERGENCY = 'emergency'
}

/**
 * Tipos de tratamiento
 */
export enum TreatmentType {
  // Tratamientos preventivos
  CLEANING = 'cleaning',
  FLUORIDE = 'fluoride',
  SEALANTS = 'sealants',
  
  // Tratamientos restaurativos
  FILLING = 'filling',
  CROWN = 'crown',
  BRIDGE = 'bridge',
  INLAY_ONLAY = 'inlay_onlay',
  
  // Tratamientos endodónticos
  ROOT_CANAL = 'root_canal',
  PULPOTOMY = 'pulpotomy',
  
  // Tratamientos periodontales
  SCALING = 'scaling',
  ROOT_PLANING = 'root_planing',
  PERIODONTAL_SURGERY = 'periodontal_surgery',
  
  // Tratamientos quirúrgicos
  EXTRACTION = 'extraction',
  IMPLANT = 'implant',
  ORAL_SURGERY = 'oral_surgery',
  
  // Tratamientos ortodónticos
  BRACES = 'braces',
  ALIGNERS = 'aligners',
  RETAINER = 'retainer',
  
  // Tratamientos protésicos
  DENTURE = 'denture',
  PARTIAL_DENTURE = 'partial_denture',
  
  // Otros
  OTHER = 'other'
}

/**
 * Tipos de diagnóstico
 */
export enum DiagnosisType {
  // Diagnóstico principal
  PRIMARY = 'primary',
  
  // Diagnóstico secundario
  SECONDARY = 'secondary',
  
  // Diagnóstico diferencial
  DIFFERENTIAL = 'differential',
  
  // Diagnóstico presuntivo
  PRESUMPTIVE = 'presumptive'
}

/**
 * Frecuencia de prescripciones
 */
export enum PrescriptionFrequency {
  // Una vez al día
  ONCE_DAILY = 'once_daily',
  
  // Dos veces al día
  TWICE_DAILY = 'twice_daily',
  
  // Tres veces al día
  THREE_TIMES_DAILY = 'three_times_daily',
  
  // Cuatro veces al día
  FOUR_TIMES_DAILY = 'four_times_daily',
  
  // Cada 4 horas
  EVERY_4_HOURS = 'every_4_hours',
  
  // Cada 6 horas
  EVERY_6_HOURS = 'every_6_hours',
  
  // Cada 8 horas
  EVERY_8_HOURS = 'every_8_hours',
  
  // Cada 12 horas
  EVERY_12_HOURS = 'every_12_hours',
  
  // Según necesidad
  AS_NEEDED = 'as_needed',
  
  // Una sola vez
  SINGLE_DOSE = 'single_dose'
}

/**
 * Unidades de prescripción
 */
export enum PrescriptionUnit {
  // Unidades sólidas
  TABLET = 'tablet',
  CAPSULE = 'capsule',
  PILL = 'pill',
  
  // Unidades líquidas
  ML = 'ml',
  DROPS = 'drops',
  TEASPOON = 'teaspoon',
  TABLESPOON = 'tablespoon',
  
  // Unidades de peso
  MG = 'mg',
  G = 'g',
  MCG = 'mcg',
  
  // Unidades tópicas
  APPLICATION = 'application',
  SPRAY = 'spray',
  RINSE = 'rinse',
  
  // Otras
  UNIT = 'unit',
  DOSE = 'dose'
}

// =================================================================
// INTERFACES PRINCIPALES
// =================================================================

/**
 * Signos vitales (cuando aplique según NOM-013)
 */
export interface VitalSigns {
  // Presión arterial (sistólica/diastólica)
  blood_pressure?: string; // Formato: "120/80"
  
  // Frecuencia cardíaca (latidos por minuto)
  heart_rate?: number;
  
  // Temperatura corporal (°C)
  temperature?: number;
  
  // Frecuencia respiratoria (respiraciones por minuto)
  respiratory_rate?: number;
  
  // Saturación de oxígeno (%)
  oxygen_saturation?: number;
  
  // Notas adicionales sobre signos vitales
  notes?: string;
}

/**
 * Información de diagnóstico con código CIE-10
 */
export interface DiagnosisInfo {
  // Diagnóstico principal (texto libre)
  primary_diagnosis: string;
  
  // Código CIE-10 principal (obligatorio)
  primary_icd10_code: string;
  
  // Descripción del código CIE-10
  primary_icd10_description?: string;
  
  // Diagnósticos secundarios
  secondary_diagnoses?: Array<{
    diagnosis: string;
    icd10_code: string;
    icd10_description?: string;
  }>;
  
  // Diagnóstico diferencial
  differential_diagnosis?: string;
  
  // Pronóstico
  prognosis?: string;
}

/**
 * Plan de tratamiento detallado
 */
export interface TreatmentPlan {
  // Descripción general del plan
  description: string;
  
  // Procedimientos a realizar
  procedures?: Array<{
    name: string;
    tooth_numbers?: number[];
    priority: 'high' | 'medium' | 'low';
    estimated_sessions?: number;
    notes?: string;
  }>;
  
  // Medicamentos prescritos
  prescriptions?: Array<{
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }>;
  
  // Recomendaciones generales
  recommendations?: string;
  
  // Instrucciones de cuidado en casa
  home_care_instructions?: string;
  
  // Fecha estimada de próxima cita
  next_appointment_date?: string;
  
  // Notas para próxima cita
  next_appointment_notes?: string;
}

/**
 * Nota clínica completa (entidad principal)
 */
export interface ClinicalNote {
  // Identificadores únicos
  id: string;
  clinic_id: string;
  
  // Relaciones obligatorias
  appointment_id: string;
  medical_record_id: string;
  patient_id: string; // Denormalizado para consultas rápidas
  
  // Información del profesional
  created_by: string; // ID del dentista/profesional
  updated_by?: string;
  
  // Metadatos de la nota
  note_type: ClinicalNoteType;
  status: ClinicalNoteStatus;
  priority: ConsultationPriority;
  
  // ELEMENTOS OBLIGATORIOS NOM-013
  // 1. Motivo de consulta (obligatorio)
  chief_complaint: string;
  
  // 2. Historia de la enfermedad actual
  present_illness?: string;
  
  // 3. Exploración clínica (obligatorio)
  clinical_examination: string;
  
  // 4. Diagnóstico con CIE-10 (obligatorio)
  diagnosis: DiagnosisInfo;
  
  // 5. Plan de tratamiento (obligatorio)
  treatment_plan: TreatmentPlan;
  
  // ELEMENTOS ADICIONALES
  // Procedimientos realizados en esta consulta
  procedures_performed?: string;
  
  // Materiales utilizados
  materials_used?: string;
  
  // Signos vitales (cuando aplique)
  vital_signs?: VitalSigns;
  
  // Observaciones adicionales
  additional_notes?: string;
  
  // Archivos adjuntos (IDs de imágenes, documentos)
  attached_files?: string[];
  
  // Control de versiones y auditoría
  version: number;
  created_at: string;
  updated_at: string;
  
  // Firma digital (hash de la nota)
  digital_signature?: string;
  
  // Indica si la nota ha sido modificada después de firma
  is_modified_after_signature: boolean;
}

// =================================================================
// TIPOS PARA REQUESTS/RESPONSES
// =================================================================

/**
 * Request para crear nueva nota clínica
 */
export interface CreateClinicalNoteRequest {
  // Relaciones obligatorias
  appointment_id: string;
  medical_record_id: string;
  
  // Tipo y prioridad
  note_type: ClinicalNoteType;
  priority?: ConsultationPriority;
  
  // Elementos obligatorios
  chief_complaint: string;
  clinical_examination: string;
  
  // Diagnóstico (mínimo el principal)
  diagnosis: {
    primary_diagnosis: string;
    primary_icd10_code: string;
    primary_icd10_description?: string;
    secondary_diagnoses?: Array<{
      diagnosis: string;
      icd10_code: string;
      icd10_description?: string;
    }>;
    differential_diagnosis?: string;
    prognosis?: string;
  };
  
  // Plan de tratamiento
  treatment_plan: {
    description: string;
    procedures?: Array<{
      name: string;
      tooth_numbers?: number[];
      priority: 'high' | 'medium' | 'low';
      estimated_sessions?: number;
      notes?: string;
    }>;
    prescriptions?: Array<{
      medication: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions: string;
    }>;
    recommendations?: string;
    home_care_instructions?: string;
    next_appointment_date?: string;
    next_appointment_notes?: string;
  };
  
  // Elementos opcionales
  present_illness?: string;
  procedures_performed?: string;
  materials_used?: string;
  vital_signs?: VitalSigns;
  additional_notes?: string;
  attached_files?: string[];
}

/**
 * Request para actualizar nota clínica
 */
export interface UpdateClinicalNoteRequest {
  // Solo se pueden actualizar ciertos campos si no está firmada
  chief_complaint?: string;
  present_illness?: string;
  clinical_examination?: string;
  
  diagnosis?: {
    primary_diagnosis?: string;
    primary_icd10_code?: string;
    primary_icd10_description?: string;
    secondary_diagnoses?: Array<{
      diagnosis: string;
      icd10_code: string;
      icd10_description?: string;
    }>;
    differential_diagnosis?: string;
    prognosis?: string;
  };
  
  treatment_plan?: {
    description?: string;
    procedures?: Array<{
      name: string;
      tooth_numbers?: number[];
      priority: 'high' | 'medium' | 'low';
      estimated_sessions?: number;
      notes?: string;
    }>;
    prescriptions?: Array<{
      medication: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions: string;
    }>;
    recommendations?: string;
    home_care_instructions?: string;
    next_appointment_date?: string;
    next_appointment_notes?: string;
  };
  
  procedures_performed?: string;
  materials_used?: string;
  vital_signs?: VitalSigns;
  additional_notes?: string;
  attached_files?: string[];
  
  // Cambio de estado
  status?: ClinicalNoteStatus;
}

/**
 * Filtros para búsqueda de notas clínicas
 */
export interface ClinicalNoteFilters {
  // Filtros por entidad
  patient_id?: string;
  dentist_id?: string;
  appointment_id?: string;
  
  // Filtros por tipo y estado
  note_type?: ClinicalNoteType;
  status?: ClinicalNoteStatus;
  priority?: ConsultationPriority;
  
  // Filtros por fecha
  date_from?: string;
  date_to?: string;
  
  // Filtros por diagnóstico
  icd10_code?: string;
  diagnosis_contains?: string;
  
  // Paginación
  page?: number;
  limit?: number;
  
  // Ordenamiento
  sort_by?: 'created_at' | 'updated_at' | 'appointment_date';
  sort_order?: 'asc' | 'desc';
}

/**
 * Response paginada de notas clínicas
 */
export interface ClinicalNotesResponse {
  data: ClinicalNote[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_records: number;
    records_per_page: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
  filters_applied: ClinicalNoteFilters;
}

/**
 * Estadísticas de notas clínicas
 */
export interface ClinicalNotesStats {
  total_notes: number;
  notes_by_type: Record<ClinicalNoteType, number>;
  notes_by_status: Record<ClinicalNoteStatus, number>;
  notes_by_priority: Record<ConsultationPriority, number>;
  most_common_diagnoses: Array<{
    icd10_code: string;
    icd10_description: string;
    count: number;
  }>;
  notes_by_month: Array<{
    month: string;
    count: number;
  }>;
}

// =================================================================
// TIPOS PARA VALIDACIÓN Y ERRORES
// =================================================================

/**
 * Errores específicos del módulo de notas clínicas
 */
export enum ClinicalNoteErrorCode {
  // Errores de validación
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_ICD10_CODE = 'INVALID_ICD10_CODE',
  INVALID_APPOINTMENT = 'INVALID_APPOINTMENT',
  INVALID_MEDICAL_RECORD = 'INVALID_MEDICAL_RECORD',
  
  // Errores de estado
  NOTE_ALREADY_SIGNED = 'NOTE_ALREADY_SIGNED',
  NOTE_CANNOT_BE_MODIFIED = 'NOTE_CANNOT_BE_MODIFIED',
  APPOINTMENT_ALREADY_HAS_NOTE = 'APPOINTMENT_ALREADY_HAS_NOTE',
  
  // Errores de permisos
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  NOT_ASSIGNED_DENTIST = 'NOT_ASSIGNED_DENTIST',
  
  // Errores de negocio
  APPOINTMENT_NOT_COMPLETED = 'APPOINTMENT_NOT_COMPLETED',
  PATIENT_NOT_FOUND = 'PATIENT_NOT_FOUND',
  MEDICAL_RECORD_NOT_FOUND = 'MEDICAL_RECORD_NOT_FOUND'
}

/**
 * Error de validación con detalles
 */
export interface ClinicalNoteValidationError {
  code: ClinicalNoteErrorCode;
  message: string;
  field?: string;
  details?: any;
}

// =================================================================
// TIPOS PARA INTEGRACIÓN CON OTROS MÓDULOS
// =================================================================

/**
 * Información resumida de nota clínica para otros módulos
 */
export interface ClinicalNoteSummary {
  id: string;
  appointment_id: string;
  patient_id: string;
  dentist_id: string;
  note_type: ClinicalNoteType;
  status: ClinicalNoteStatus;
  chief_complaint: string;
  primary_diagnosis: string;
  primary_icd10_code: string;
  created_at: string;
  updated_at: string;
}

/**
 * Datos para generar reportes
 */
export interface ClinicalNoteReportData {
  note: ClinicalNote;
  patient_info: {
    full_name: string;
    date_of_birth: string;
    patient_number: string;
  };
  dentist_info: {
    full_name: string;
    professional_license: string;
  };
  clinic_info: {
    name: string;
    address: string;
    phone: string;
  };
  appointment_info: {
    appointment_date: string;
    start_time: string;
    end_time: string;
  };
}

export default ClinicalNote;