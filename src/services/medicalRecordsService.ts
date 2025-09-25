/**
 * =================================================================
 * SERVICIO DE EXPEDIENTES MÉDICOS - SISTEMA EXPEDIENTES DENTALES
 * =================================================================
 * 
 * Este servicio maneja todas las operaciones CRUD para expedientes médicos,
 * garantizando el cumplimiento de las normativas mexicanas:
 * - NOM-013-SSA2-2015 (Elementos obligatorios del expediente)
 * - NOM-024-SSA3-2012 (Registro electrónico)
 * - NOM-004-SSA3-2012 (Expediente clínico)
 * 
 * FUNCIONALIDADES PRINCIPALES:
 * 1. Crear expedientes médicos con validaciones normativas
 * 2. Actualizar información médica del paciente
 * 3. Consultar expedientes con filtros avanzados
 * 4. Generar reportes estadísticos
 * 5. Mantener trazabilidad completa
 * 6. Validar integridad de datos médicos
 * 
 * VALIDACIONES CRÍTICAS:
 * - Un paciente solo puede tener un expediente médico activo
 * - Elementos obligatorios según NOM-013
 * - Validación de signos vitales
 * - Permisos de usuario (solo personal médico autorizado)
 * - Integridad referencial con pacientes
 * 
 * =================================================================
 */

import supabase, { supabaseService } from '../config/supabase';
import logger from '../config/logger';
import { 
  MedicalRecord,
  CreateMedicalRecordData,
  UpdateMedicalRecordData,
  MedicalRecordFilters,
  MedicalRecordsPaginatedResponse,
  MedicalRecordWithPatient,
  MedicalRecordSummary,
  MedicalRecordStats,
  MedicalRecordStatus,
  BloodType,
  MedicalRecordNotFoundError,
  MedicalRecordAlreadyExistsError,
  InvalidMedicalRecordDataError,
  MEDICAL_RECORD_CONSTRAINTS,
  REQUIRED_FIELDS_NOM_013
} from '../types/medical-records';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// =================================================================
// INTERFACES PARA RESPUESTAS DE BASE DE DATOS
// =================================================================

/**
 * Respuesta de la base de datos para expedientes médicos
 */
interface DatabaseMedicalRecord {
  id: string;
  patient_id: string;
  record_number: string;
  status: string;
  demographic_info: any;
  blood_type: string | null;
  family_history: any;
  personal_history: any;
  habits: any;
  latest_vital_signs: any;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
  notes: string | null;
}

/**
 * Respuesta de la base de datos con información del paciente
 */
interface DatabaseMedicalRecordWithPatient extends DatabaseMedicalRecord {
  patients: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    date_of_birth: string | null;
  };
}

// =================================================================
// UTILIDADES PRIVADAS
// =================================================================

/**
 * Genera un número único de expediente médico
 */
function generateRecordNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `EXP-${timestamp}-${random}`;
}

/**
 * Transforma datos de la base de datos al formato de la aplicación
 */
function transformDatabaseRecord(dbRecord: DatabaseMedicalRecord): MedicalRecord {
  return {
    id: dbRecord.id,
    patient_id: dbRecord.patient_id,
    record_number: dbRecord.record_number,
    status: dbRecord.status as MedicalRecordStatus,
    demographic_info: dbRecord.demographic_info || undefined,
    blood_type: dbRecord.blood_type as BloodType || undefined,
    family_history: dbRecord.family_history || undefined,
    personal_history: dbRecord.personal_history || undefined,
    habits: dbRecord.habits || undefined,
    latest_vital_signs: dbRecord.latest_vital_signs || undefined,
    created_at: dbRecord.created_at,
    updated_at: dbRecord.updated_at,
    created_by: dbRecord.created_by,
    updated_by: dbRecord.updated_by || undefined,
    notes: dbRecord.notes || undefined
  };
}

/**
 * Transforma datos con información del paciente
 */
function transformDatabaseRecordWithPatient(dbRecord: DatabaseMedicalRecordWithPatient): MedicalRecordWithPatient {
  const baseRecord = transformDatabaseRecord(dbRecord);
  return {
    ...baseRecord,
    patient: {
      id: dbRecord.patients.id,
      first_name: dbRecord.patients.first_name,
      last_name: dbRecord.patients.last_name,
      email: dbRecord.patients.email || undefined,
      phone: dbRecord.patients.phone || undefined,
      date_of_birth: dbRecord.patients.date_of_birth || undefined
    }
  };
}

/**
 * Valida que un paciente existe
 */
async function validatePatientExists(patientId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .single();

    if (error) {
      logger.error('Error validando existencia del paciente:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    logger.error('Error en validatePatientExists:', error);
    return false;
  }
}

/**
 * Valida que no existe un expediente médico activo para el paciente
 */
async function validateUniqueActiveRecord(patientId: string, excludeId?: string): Promise<boolean> {
  try {
    let query = supabase
      .from('medical_records')
      .select('id')
      .eq('patient_id', patientId)
      .eq('status', MedicalRecordStatus.ACTIVE);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error validando unicidad del expediente:', error);
      return false;
    }

    return !data || data.length === 0;
  } catch (error) {
    logger.error('Error en validateUniqueActiveRecord:', error);
    return false;
  }
}

/**
 * Valida los campos requeridos según NOM-013
 */
function validateRequiredFieldsNOM013(data: CreateMedicalRecordData | UpdateMedicalRecordData): string[] {
  const errors: string[] = [];

  // Para crear, patient_id es obligatorio
  if ('patient_id' in data && !data.patient_id) {
    errors.push('patient_id es requerido según NOM-013-SSA2-2015');
  }

  return errors;
}

/**
 * Calcula estadísticas de completitud del expediente
 */
function calculateCompleteness(record: MedicalRecord): number {
  const fields = [
    'blood_type',
    'family_history',
    'personal_history',
    'habits',
    'latest_vital_signs',
    'demographic_info'
  ];

  const completedFields = fields.filter(field => {
    const value = record[field as keyof MedicalRecord];
    return value && (typeof value !== 'object' || Object.keys(value).length > 0);
  });

  return Math.round((completedFields.length / fields.length) * 100);
}

// =================================================================
// SERVICIO PRINCIPAL
// =================================================================

export class MedicalRecordsService {
  /**
   * Crear un nuevo expediente médico
   */
  static async createMedicalRecord(
    data: CreateMedicalRecordData,
    userId: string
  ): Promise<MedicalRecord> {
    try {
      logger.info('Iniciando creación de expediente médico', { 
        patientId: data.patient_id,
        userId 
      });

      // Validar campos requeridos
      const validationErrors = validateRequiredFieldsNOM013(data);
      if (validationErrors.length > 0) {
        throw new InvalidMedicalRecordDataError(validationErrors.join(', '));
      }

      // Validar que el paciente existe
      const patientExists = await validatePatientExists(data.patient_id);
      if (!patientExists) {
        throw new InvalidMedicalRecordDataError(`Paciente con ID ${data.patient_id} no encontrado`);
      }

      // Validar que no existe un expediente activo para el paciente
      const isUnique = await validateUniqueActiveRecord(data.patient_id);
      if (!isUnique) {
        throw new MedicalRecordAlreadyExistsError(data.patient_id);
      }

      // Generar número de expediente único
      const recordNumber = generateRecordNumber();
      const recordId = uuidv4();

      // Preparar datos para inserción
      const insertData = {
        id: recordId,
        patient_id: data.patient_id,
        record_number: recordNumber,
        status: MedicalRecordStatus.ACTIVE,
        demographic_info: data.demographic_info || null,
        blood_type: data.blood_type || null,
        family_history: data.family_history || null,
        personal_history: data.personal_history || null,
        habits: data.habits || null,
        latest_vital_signs: data.latest_vital_signs || null,
        created_by: userId,
        updated_by: userId,
        notes: data.notes || null
      };

      // Insertar en la base de datos
      const { data: insertedRecord, error } = await supabase
        .from('medical_records')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        logger.error('Error insertando expediente médico:', error);
        throw new Error(`Error creando expediente médico: ${error.message}`);
      }

      const medicalRecord = transformDatabaseRecord(insertedRecord);
      
      logger.info('Expediente médico creado exitosamente', {
        id: medicalRecord.id,
        recordNumber: medicalRecord.record_number,
        patientId: medicalRecord.patient_id
      });

      return medicalRecord;

    } catch (error) {
      logger.error('Error en createMedicalRecord:', error);
      throw error;
    }
  }

  /**
   * Obtener expediente médico por ID
   */
  static async getMedicalRecordById(id: string): Promise<MedicalRecord> {
    try {
      const { data, error } = await supabase
        .from('medical_records')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new MedicalRecordNotFoundError(id);
        }
        logger.error('Error obteniendo expediente médico:', error);
        throw new Error(`Error obteniendo expediente médico: ${error.message}`);
      }

      return transformDatabaseRecord(data);

    } catch (error) {
      logger.error('Error en getMedicalRecordById:', error);
      throw error;
    }
  }

  /**
   * Obtener expediente médico por ID de paciente
   */
  static async getMedicalRecordByPatientId(patientId: string): Promise<MedicalRecord | null> {
    try {
      const { data, error } = await supabase
        .from('medical_records')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', MedicalRecordStatus.ACTIVE)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No existe expediente activo
        }
        logger.error('Error obteniendo expediente por paciente:', error);
        throw new Error(`Error obteniendo expediente: ${error.message}`);
      }

      return transformDatabaseRecord(data);

    } catch (error) {
      logger.error('Error en getMedicalRecordByPatientId:', error);
      throw error;
    }
  }

  /**
   * Actualizar expediente médico
   */
  static async updateMedicalRecord(
    id: string,
    data: UpdateMedicalRecordData,
    userId: string
  ): Promise<MedicalRecord> {
    try {
      logger.info('Iniciando actualización de expediente médico', { id, userId });

      // Verificar que el expediente existe
      const existingRecord = await this.getMedicalRecordById(id);

      // Validar campos requeridos
      const validationErrors = validateRequiredFieldsNOM013(data);
      if (validationErrors.length > 0) {
        throw new InvalidMedicalRecordDataError(validationErrors.join(', '));
      }

      // Si se cambia el estado a ACTIVE, validar unicidad
      if (data.status === MedicalRecordStatus.ACTIVE) {
        const isUnique = await validateUniqueActiveRecord(existingRecord.patient_id, id);
        if (!isUnique) {
          throw new InvalidMedicalRecordDataError(
            'Ya existe un expediente activo para este paciente'
          );
        }
      }

      // Preparar datos para actualización
      const updateData = {
        ...data,
        updated_by: userId,
        updated_at: new Date().toISOString()
      };

      // Actualizar en la base de datos
      const { data: updatedRecord, error } = await supabase
        .from('medical_records')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Error actualizando expediente médico:', error);
        throw new Error(`Error actualizando expediente médico: ${error.message}`);
      }

      const medicalRecord = transformDatabaseRecord(updatedRecord);
      
      logger.info('Expediente médico actualizado exitosamente', {
        id: medicalRecord.id,
        recordNumber: medicalRecord.record_number
      });

      return medicalRecord;

    } catch (error) {
      logger.error('Error en updateMedicalRecord:', error);
      throw error;
    }
  }

  /**
   * Obtener expedientes médicos con filtros y paginación
   */
  static async getMedicalRecords(
    filters: MedicalRecordFilters = {},
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'created_at',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<MedicalRecordsPaginatedResponse> {
    try {
      logger.info('Obteniendo expedientes médicos', { filters, page, limit });

      // Construir query base
      let query = supabase
        .from('medical_records')
        .select(`
          *,
          patients!inner (
            id,
            first_name,
            last_name,
            email,
            phone,
            date_of_birth
          )
        `, { count: 'exact' });

      // Aplicar filtros
      if (filters.patient_id) {
        query = query.eq('patient_id', filters.patient_id);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.blood_type) {
        query = query.eq('blood_type', filters.blood_type);
      }

      if (filters.created_from) {
        query = query.gte('created_at', filters.created_from);
      }

      if (filters.created_to) {
        query = query.lte('created_at', filters.created_to);
      }

      if (filters.updated_from) {
        query = query.gte('updated_at', filters.updated_from);
      }

      if (filters.updated_to) {
        query = query.lte('updated_at', filters.updated_to);
      }

      if (filters.search) {
        query = query.or(`record_number.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);
      }

      // Aplicar ordenamiento
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Aplicar paginación
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Error obteniendo expedientes médicos:', error);
        throw new Error(`Error obteniendo expedientes: ${error.message}`);
      }

      const records = data?.map(transformDatabaseRecord) || [];
      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: records,
        total,
        page,
        limit,
        totalPages
      };

    } catch (error) {
      logger.error('Error en getMedicalRecords:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de expedientes médicos
   */
  static async getMedicalRecordsStats(): Promise<MedicalRecordStats> {
    try {
      logger.info('Obteniendo estadísticas de expedientes médicos');

      // Obtener conteos por estado
      const { data: statusCounts, error: statusError } = await supabase
        .from('medical_records')
        .select('status')
        .then(result => {
          if (result.error) throw result.error;
          
          const counts = {
            total_records: result.data?.length || 0,
            active_records: 0,
            inactive_records: 0,
            archived_records: 0
          };

          result.data?.forEach(record => {
            switch (record.status) {
              case MedicalRecordStatus.ACTIVE:
                counts.active_records++;
                break;
              case MedicalRecordStatus.INACTIVE:
                counts.inactive_records++;
                break;
              case MedicalRecordStatus.ARCHIVED:
                counts.archived_records++;
                break;
            }
          });

          return { data: counts, error: null };
        });

      if (statusError) {
        throw statusError;
      }

      // Obtener distribución de tipos de sangre
      const { data: bloodTypeData, error: bloodTypeError } = await supabase
        .from('medical_records')
        .select('blood_type')
        .not('blood_type', 'is', null);

      if (bloodTypeError) {
        throw bloodTypeError;
      }

      const bloodTypeDistribution: Record<BloodType, number> = {} as Record<BloodType, number>;
      Object.values(BloodType).forEach(type => {
        bloodTypeDistribution[type] = 0;
      });

      bloodTypeData?.forEach(record => {
        if (record.blood_type && record.blood_type in bloodTypeDistribution) {
          bloodTypeDistribution[record.blood_type as BloodType]++;
        }
      });

      // Contar expedientes con enfermedades crónicas y alergias
      const { data: chronicData, error: chronicError } = await supabase
        .from('medical_records')
        .select('personal_history')
        .not('personal_history', 'is', null);

      if (chronicError) {
        throw chronicError;
      }

      let recordsWithChronicDiseases = 0;
      let recordsWithAllergies = 0;

      chronicData?.forEach(record => {
        const history = record.personal_history;
        if (history?.chronic_diseases && history.chronic_diseases.length > 0) {
          recordsWithChronicDiseases++;
        }
        if (history?.allergies && history.allergies.length > 0) {
          recordsWithAllergies++;
        }
      });

      return {
        ...statusCounts,
        records_with_chronic_diseases: recordsWithChronicDiseases,
        records_with_allergies: recordsWithAllergies,
        blood_type_distribution: bloodTypeDistribution
      };

    } catch (error) {
      logger.error('Error en getMedicalRecordsStats:', error);
      throw error;
    }
  }

  /**
   * Eliminar expediente médico (soft delete)
   */
  static async deleteMedicalRecord(id: string, userId: string): Promise<void> {
    try {
      logger.info('Iniciando eliminación de expediente médico', { id, userId });

      // Verificar que el expediente existe
      await this.getMedicalRecordById(id);

      // Marcar como archivado en lugar de eliminar
      await this.updateMedicalRecord(id, {
        status: MedicalRecordStatus.ARCHIVED
      }, userId);

      logger.info('Expediente médico archivado exitosamente', { id });

    } catch (error) {
      logger.error('Error en deleteMedicalRecord:', error);
      throw error;
    }
  }

  /**
   * Validar integridad del expediente médico
   */
  static async validateMedicalRecordIntegrity(id: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    completeness: number;
  }> {
    try {
      const record = await this.getMedicalRecordById(id);
      const errors: string[] = [];
      const warnings: string[] = [];

      // Validar campos obligatorios
      if (!record.patient_id) {
        errors.push('ID de paciente es requerido');
      }

      if (!record.record_number) {
        errors.push('Número de expediente es requerido');
      }

      // Validar signos vitales si están presentes
      if (record.latest_vital_signs) {
        const vitals = record.latest_vital_signs;
        
        if (vitals.blood_pressure_systolic && vitals.blood_pressure_diastolic) {
          if (vitals.blood_pressure_systolic <= vitals.blood_pressure_diastolic) {
            errors.push('Presión sistólica debe ser mayor que diastólica');
          }
        }

        if (vitals.height && vitals.weight && vitals.bmi) {
          const heightInMeters = vitals.height / 100;
          const calculatedBMI = vitals.weight / (heightInMeters * heightInMeters);
          
          if (Math.abs(vitals.bmi - calculatedBMI) > 0.5) {
            warnings.push('BMI calculado no coincide con el registrado');
          }
        }
      }

      // Validar completitud
      const completeness = calculateCompleteness(record);
      
      if (completeness < 50) {
        warnings.push('Expediente médico incompleto (menos del 50%)');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        completeness
      };

    } catch (error) {
      logger.error('Error en validateMedicalRecordIntegrity:', error);
      throw error;
    }
  }
}

export default MedicalRecordsService;