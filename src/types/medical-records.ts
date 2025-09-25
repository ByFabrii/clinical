import { z } from 'zod';

// ============================================================================
// ENUMS Y CONSTANTES
// ============================================================================

/**
 * Tipos de sangre según clasificación ABO y Rh
 */
export enum BloodType {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-',
  UNKNOWN = 'DESCONOCIDO'
}

/**
 * Estados civiles reconocidos
 */
export enum MaritalStatus {
  SINGLE = 'SOLTERO',
  MARRIED = 'CASADO',
  DIVORCED = 'DIVORCIADO',
  WIDOWED = 'VIUDO',
  SEPARATED = 'SEPARADO',
  COMMON_LAW = 'UNION_LIBRE',
  OTHER = 'OTRO'
}

/**
 * Niveles de educación
 */
export enum EducationLevel {
  NONE = 'SIN_ESTUDIOS',
  PRIMARY = 'PRIMARIA',
  SECONDARY = 'SECUNDARIA',
  HIGH_SCHOOL = 'PREPARATORIA',
  TECHNICAL = 'TECNICO',
  BACHELOR = 'LICENCIATURA',
  MASTER = 'MAESTRIA',
  DOCTORATE = 'DOCTORADO',
  OTHER = 'OTRO'
}

/**
 * Tipos de ocupación
 */
export enum OccupationType {
  STUDENT = 'ESTUDIANTE',
  EMPLOYEE = 'EMPLEADO',
  SELF_EMPLOYED = 'INDEPENDIENTE',
  UNEMPLOYED = 'DESEMPLEADO',
  RETIRED = 'JUBILADO',
  HOMEMAKER = 'HOGAR',
  OTHER = 'OTRO'
}

/**
 * Frecuencias para hábitos
 */
export enum Frequency {
  NEVER = 'NUNCA',
  RARELY = 'RARA_VEZ',
  OCCASIONALLY = 'OCASIONALMENTE',
  FREQUENTLY = 'FRECUENTEMENTE',
  DAILY = 'DIARIAMENTE',
  WEEKLY = 'SEMANALMENTE',
  MONTHLY = 'MENSUALMENTE'
}

/**
 * Estados del expediente médico
 */
export enum MedicalRecordStatus {
  ACTIVE = 'ACTIVO',
  INACTIVE = 'INACTIVO',
  ARCHIVED = 'ARCHIVADO',
  TRANSFERRED = 'TRANSFERIDO'
}

// ============================================================================
// INTERFACES PRINCIPALES
// ============================================================================

/**
 * Información demográfica del paciente
 */
export interface DemographicInfo {
  birth_place?: string;
  nationality?: string;
  marital_status?: MaritalStatus;
  education_level?: EducationLevel;
  occupation?: string;
  occupation_type?: OccupationType;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
}

/**
 * Antecedentes médicos familiares
 */
export interface FamilyHistory {
  diabetes?: boolean;
  hypertension?: boolean;
  heart_disease?: boolean;
  cancer?: boolean;
  mental_illness?: boolean;
  allergies?: boolean;
  other_conditions?: string;
  notes?: string;
}

/**
 * Antecedentes médicos personales
 */
export interface PersonalHistory {
  chronic_diseases?: string[];
  surgeries?: string[];
  hospitalizations?: string[];
  allergies?: string[];
  current_medications?: string[];
  immunizations?: string[];
  notes?: string;
}

/**
 * Hábitos del paciente
 */
export interface PatientHabits {
  smoking?: {
    status: boolean;
    frequency?: Frequency;
    quantity?: string;
    duration?: string;
    quit_date?: string;
  };
  alcohol?: {
    status: boolean;
    frequency?: Frequency;
    quantity?: string;
    type?: string;
  };
  drugs?: {
    status: boolean;
    substances?: string[];
    frequency?: Frequency;
  };
  exercise?: {
    status: boolean;
    frequency?: Frequency;
    type?: string;
    duration?: string;
  };
  diet?: {
    type?: string;
    restrictions?: string[];
    notes?: string;
  };
  sleep?: {
    hours_per_night?: number;
    quality?: 'BUENA' | 'REGULAR' | 'MALA';
    disorders?: string[];
  };
}

/**
 * Signos vitales
 */
export interface VitalSigns {
  height?: number; // cm
  weight?: number; // kg
  bmi?: number;
  blood_pressure_systolic?: number; // mmHg
  blood_pressure_diastolic?: number; // mmHg
  heart_rate?: number; // bpm
  respiratory_rate?: number; // rpm
  temperature?: number; // °C
  oxygen_saturation?: number; // %
  recorded_at?: string;
  recorded_by?: string;
}

/**
 * Expediente médico completo
 */
export interface MedicalRecord {
  id: string;
  patient_id: string;
  record_number: string;
  status: MedicalRecordStatus;
  
  // Información demográfica
  demographic_info?: DemographicInfo;
  
  // Información médica básica
  blood_type?: BloodType;
  
  // Antecedentes
  family_history?: FamilyHistory;
  personal_history?: PersonalHistory;
  
  // Hábitos
  habits?: PatientHabits;
  
  // Signos vitales más recientes
  latest_vital_signs?: VitalSigns;
  
  // Metadatos
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
  notes?: string;
}

/**
 * Datos para crear un nuevo expediente médico
 */
export interface CreateMedicalRecordData {
  patient_id: string;
  demographic_info?: DemographicInfo;
  blood_type?: BloodType;
  family_history?: FamilyHistory;
  personal_history?: PersonalHistory;
  habits?: PatientHabits;
  latest_vital_signs?: VitalSigns;
  notes?: string;
}

/**
 * Datos para actualizar un expediente médico
 */
export interface UpdateMedicalRecordData {
  demographic_info?: DemographicInfo;
  blood_type?: BloodType;
  family_history?: FamilyHistory;
  personal_history?: PersonalHistory;
  habits?: PatientHabits;
  latest_vital_signs?: VitalSigns;
  status?: MedicalRecordStatus;
  notes?: string;
}

/**
 * Filtros para búsqueda de expedientes médicos
 */
export interface MedicalRecordFilters {
  patient_id?: string;
  status?: MedicalRecordStatus;
  blood_type?: BloodType;
  created_from?: string;
  created_to?: string;
  updated_from?: string;
  updated_to?: string;
  has_chronic_diseases?: boolean;
  has_allergies?: boolean;
  search?: string; // Búsqueda en notas y número de expediente
}

/**
 * Respuesta paginada de expedientes médicos
 */
export interface MedicalRecordsPaginatedResponse {
  data: MedicalRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// TIPOS DE UTILIDAD
// ============================================================================

/**
 * Expediente médico con información del paciente
 */
export interface MedicalRecordWithPatient extends MedicalRecord {
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    date_of_birth?: string;
  };
}

/**
 * Resumen del expediente médico para listados
 */
export interface MedicalRecordSummary {
  id: string;
  patient_id: string;
  record_number: string;
  status: MedicalRecordStatus;
  blood_type?: BloodType;
  has_chronic_diseases: boolean;
  has_allergies: boolean;
  last_updated: string;
  patient_name: string;
}

/**
 * Estadísticas del expediente médico
 */
export interface MedicalRecordStats {
  total_records: number;
  active_records: number;
  inactive_records: number;
  archived_records: number;
  records_with_chronic_diseases: number;
  records_with_allergies: number;
  blood_type_distribution: Record<BloodType, number>;
}

// ============================================================================
// ERRORES ESPECÍFICOS
// ============================================================================

export class MedicalRecordNotFoundError extends Error {
  constructor(id: string) {
    super(`Expediente médico con ID ${id} no encontrado`);
    this.name = 'MedicalRecordNotFoundError';
  }
}

export class MedicalRecordAlreadyExistsError extends Error {
  constructor(patientId: string) {
    super(`Ya existe un expediente médico para el paciente ${patientId}`);
    this.name = 'MedicalRecordAlreadyExistsError';
  }
}

export class InvalidMedicalRecordDataError extends Error {
  constructor(message: string) {
    super(`Datos del expediente médico inválidos: ${message}`);
    this.name = 'InvalidMedicalRecordDataError';
  }
}

// ============================================================================
// CONSTANTES DE VALIDACIÓN
// ============================================================================

export const MEDICAL_RECORD_CONSTRAINTS = {
  RECORD_NUMBER: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 20,
    PATTERN: /^[A-Z0-9-]+$/
  },
  NOTES: {
    MAX_LENGTH: 2000
  },
  VITAL_SIGNS: {
    HEIGHT: { MIN: 50, MAX: 250 }, // cm
    WEIGHT: { MIN: 1, MAX: 500 }, // kg
    BLOOD_PRESSURE: { MIN: 50, MAX: 300 }, // mmHg
    HEART_RATE: { MIN: 30, MAX: 200 }, // bpm
    RESPIRATORY_RATE: { MIN: 5, MAX: 60 }, // rpm
    TEMPERATURE: { MIN: 30, MAX: 45 }, // °C
    OXYGEN_SATURATION: { MIN: 50, MAX: 100 } // %
  }
} as const;

/**
 * Campos requeridos según NOM-013-SSA2-2015
 */
export const REQUIRED_FIELDS_NOM_013 = [
  'patient_id',
  'record_number'
] as const;

/**
 * Campos recomendados para un expediente completo
 */
export const RECOMMENDED_FIELDS = [
  'blood_type',
  'family_history',
  'personal_history',
  'latest_vital_signs'
] as const;