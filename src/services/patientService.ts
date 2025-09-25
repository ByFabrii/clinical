// src/services/patientService.ts
import supabase, { supabaseService } from '../config/supabase';
import logger from '../config/logger';
import { 
  CreatePatientData, 
  UpdatePatientData, 
  PatientFilters 
} from '../schemas/patients.schemas';
import { MedicalRecordsService } from './medicalRecordsService';
import { CreateMedicalRecordData, MaritalStatus, EducationLevel } from '../types/medical-records';
import { v4 as uuidv4 } from 'uuid';

// Tipos para las respuestas
export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  second_last_name?: string;
  date_of_birth: string;
  gender: 'M' | 'F' | 'O';
  curp?: string;
  rfc?: string;
  email?: string;
  phone?: string;
  mobile_phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;
  insurance_company?: string;
  insurance_number?: string;
  insurance_type?: 'IMSS' | 'ISSSTE' | 'PEMEX' | 'SEDENA' | 'SEMAR' | 'PRIVADO' | 'OTRO';
  blood_type?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  marital_status?: 'SOLTERO' | 'CASADO' | 'DIVORCIADO' | 'VIUDO' | 'UNION_LIBRE';
  occupation?: string;
  registration_date: string;
  is_active: boolean;
  clinic_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PatientListResponse {
  patients: Patient[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class PatientService {
  
  /**
   * Crear un nuevo paciente
   */
  async createPatient(patientData: CreatePatientData, clinicId: string, createdBy: string, requestId: string): Promise<Patient> {
    try {
      logger.info(`[${requestId}] Iniciando creación de paciente`, {
        clinic_id: clinicId,
        patient_name: `${patientData.first_name} ${patientData.last_name}`
      });

      const patientId = uuidv4();
      const now = new Date().toISOString();

      // Verificar que la clínica existe y está activa
      const { data: clinic, error: clinicError } = await supabaseService
        .from('clinics')
        .select('id, is_active')
        .eq('id', clinicId)
        .eq('is_active', true)
        .single();

      if (clinicError || !clinic) {
        logger.error(`[${requestId}] Clínica no encontrada o inactiva`, {
          clinic_id: clinicId,
          error: clinicError
        });
        throw new Error('Clínica no encontrada o inactiva');
      }

      // Verificar si ya existe un paciente con el mismo CURP en la clínica
      if (patientData.curp) {
        const { data: existingPatient } = await supabaseService
          .from('patients')
          .select('id')
          .eq('clinic_id', clinicId)
          .eq('curp', patientData.curp)
          .single();

        if (existingPatient) {
          logger.warn(`[${requestId}] Paciente con CURP ya existe`, {
            curp: patientData.curp,
            clinic_id: clinicId
          });
          throw new Error('Ya existe un paciente con este CURP en la clínica');
        }
      }

      // Verificar si ya existe un paciente con el mismo email en la clínica
      if (patientData.email) {
        const { data: existingPatient } = await supabaseService
          .from('patients')
          .select('id')
          .eq('clinic_id', clinicId)
          .eq('email', patientData.email)
          .single();

        if (existingPatient) {
          logger.warn(`[${requestId}] Paciente con email ya existe`, {
            email: patientData.email,
            clinic_id: clinicId
          });
          throw new Error('Ya existe un paciente con este email en la clínica');
        }
      }

      const newPatient = {
        id: patientId,
        ...patientData,
        clinic_id: clinicId,
        created_by: createdBy,
        is_active: true,
        created_at: now,
        updated_at: now
      };

      const { data, error } = await supabaseService
        .from('patients')
        .insert([newPatient])
        .select()
        .single();

      if (error) {
        logger.error(`[${requestId}] Error al crear paciente`, {
          error: error.message,
          patient_data: newPatient
        });
        throw new Error(`Error al crear paciente: ${error.message}`);
      }

      logger.info(`[${requestId}] Paciente creado exitosamente`, {
        patient_id: data.id,
        patient_name: `${data.first_name} ${data.last_name}`
      });

      // Crear expediente médico automáticamente
      try {
        logger.info(`[${requestId}] Creando expediente médico automático para paciente`, {
          patient_id: data.id
        });

        // Función para convertir string de estado civil a enum
        const convertMaritalStatus = (status?: string): MaritalStatus | undefined => {
          if (!status) return undefined;
          switch (status) {
            case 'SOLTERO': return MaritalStatus.SINGLE;
            case 'CASADO': return MaritalStatus.MARRIED;
            case 'DIVORCIADO': return MaritalStatus.DIVORCED;
            case 'VIUDO': return MaritalStatus.WIDOWED;
            case 'UNION_LIBRE': return MaritalStatus.COMMON_LAW;
            default: return undefined;
          }
        };

        // Crear expediente médico básico según esquema real de la base de datos
        const medicalRecordData = {
          patient_id: data.id,
          allergies: null,
          current_medications: null,
          medical_history: null,
          family_medical_history: null,
          surgical_history: null,
          previous_dental_treatments: null,
          dental_trauma_history: null,
          orthodontic_history: null,
          periodontal_history: null,
          smoking_habits: null,
          alcohol_consumption: null,
          bruxism: false,
          nail_biting: false,
          other_habits: null,
          blood_pressure: null,
          heart_rate: null,
          temperature: null,
          emergency_medical_conditions: null,
          medication_allergies: null,
          blood_type: data.blood_type || null,
          emergency_contact_relationship: null,
          created_by: createdBy,
          clinic_id: clinicId
        };

        // Generar número de expediente único
        const recordNumber = `MR${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
        
        // Insertar directamente en la base de datos usando el cliente de servicio
        const { error: medicalRecordError } = await supabaseService
          .from('medical_records')
          .insert({
            ...medicalRecordData,
            record_number: recordNumber
          });
          
        if (medicalRecordError) {
          throw new Error(`Error creando expediente médico: ${medicalRecordError.message}`);
        }
        
        logger.info(`[${requestId}] Expediente médico creado automáticamente`, {
          patient_id: data.id
        });

      } catch (medicalRecordError) {
        // Log del error pero no fallar la creación del paciente
        logger.error(`[${requestId}] Error al crear expediente médico automático`, {
          patient_id: data.id,
          error: medicalRecordError instanceof Error ? medicalRecordError.message : 'Error desconocido'
        });
        
        // Nota: No lanzamos el error para no fallar la creación del paciente
        // El expediente médico se puede crear manualmente después
      }

      return data as Patient;

    } catch (error) {
      logger.error(`[${requestId}] Error en createPatient`, {
        error: error instanceof Error ? error.message : 'Error desconocido',
        clinic_id: clinicId
      });
      throw error;
    }
  }

  /**
   * Obtener un paciente por ID
   */
  async getPatientById(patientId: string, clinicId: string, requestId: string): Promise<Patient | null> {
    try {
      logger.info(`[${requestId}] Obteniendo paciente por ID`, {
        patient_id: patientId,
        clinic_id: clinicId
      });

      const { data, error } = await supabaseService
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .eq('clinic_id', clinicId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          logger.info(`[${requestId}] Paciente no encontrado`, {
            patient_id: patientId,
            clinic_id: clinicId
          });
          return null;
        }
        logger.error(`[${requestId}] Error al obtener paciente`, {
          error: error.message,
          patient_id: patientId
        });
        throw new Error(`Error al obtener paciente: ${error.message}`);
      }

      logger.info(`[${requestId}] Paciente obtenido exitosamente`, {
        patient_id: data.id,
        patient_name: `${data.first_name} ${data.last_name}`
      });

      return data as Patient;

    } catch (error) {
      logger.error(`[${requestId}] Error en getPatientById`, {
        error: error instanceof Error ? error.message : 'Error desconocido',
        patient_id: patientId
      });
      throw error;
    }
  }

  /**
   * Listar pacientes con filtros y paginación
   */
  async listPatients(filters: PatientFilters, clinicId: string, requestId: string): Promise<PatientListResponse> {
    try {
      logger.info(`[${requestId}] Listando pacientes`, {
        filters,
        clinic_id: clinicId
      });

      let query = supabaseService
        .from('patients')
        .select('*', { count: 'exact' })
        .eq('clinic_id', clinicId);

      // Aplicar filtros
      if (filters.search) {
        query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,second_last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,curp.ilike.%${filters.search}%`);
      }

      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      if (filters.gender) {
        query = query.eq('gender', filters.gender);
      }

      if (filters.blood_type) {
        query = query.eq('blood_type', filters.blood_type);
      }

      if (filters.marital_status) {
        query = query.eq('marital_status', filters.marital_status);
      }

      if (filters.insurance_type) {
        query = query.eq('insurance_type', filters.insurance_type);
      }

      if (filters.city) {
        query = query.ilike('city', `%${filters.city}%`);
      }

      if (filters.state) {
        query = query.ilike('state', `%${filters.state}%`);
      }

      if (filters.country) {
        query = query.ilike('country', `%${filters.country}%`);
      }

      // Filtros de edad
      if (filters.min_age !== undefined || filters.max_age !== undefined) {
        const currentYear = new Date().getFullYear();
        
        if (filters.min_age !== undefined) {
          const maxBirthYear = currentYear - filters.min_age;
          query = query.lte('date_of_birth', `${maxBirthYear}-12-31`);
        }
        
        if (filters.max_age !== undefined) {
          const minBirthYear = currentYear - filters.max_age;
          query = query.gte('date_of_birth', `${minBirthYear}-01-01`);
        }
      }

      // Filtros de fecha de registro
      if (filters.registration_date_from) {
        query = query.gte('registration_date', filters.registration_date_from);
      }

      if (filters.registration_date_to) {
        query = query.lte('registration_date', filters.registration_date_to);
      }

      // Ordenamiento
      query = query.order(filters.sort_by, { ascending: filters.sort_order === 'asc' });

      // Paginación
      const from = (filters.page - 1) * filters.limit;
      const to = from + filters.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        logger.error(`[${requestId}] Error al listar pacientes`, {
          error: error.message,
          filters
        });
        throw new Error(`Error al listar pacientes: ${error.message}`);
      }

      const totalPages = Math.ceil((count || 0) / filters.limit);

      logger.info(`[${requestId}] Pacientes listados exitosamente`, {
        total: count,
        page: filters.page,
        limit: filters.limit,
        totalPages
      });

      return {
        patients: data as Patient[],
        total: count || 0,
        page: filters.page,
        limit: filters.limit,
        totalPages
      };

    } catch (error) {
      logger.error(`[${requestId}] Error en listPatients`, {
        error: error instanceof Error ? error.message : 'Error desconocido',
        filters
      });
      throw error;
    }
  }

  /**
   * Actualizar un paciente
   */
  async updatePatient(patientId: string, updateData: UpdatePatientData, clinicId: string, requestId: string): Promise<Patient> {
    try {
      logger.info(`[${requestId}] Actualizando paciente`, {
        patient_id: patientId,
        clinic_id: clinicId,
        update_fields: Object.keys(updateData)
      });

      // Verificar que el paciente existe y pertenece a la clínica
      const existingPatient = await this.getPatientById(patientId, clinicId, requestId);
      if (!existingPatient) {
        throw new Error('Paciente no encontrado');
      }

      // Verificar unicidad de CURP si se está actualizando
      if (updateData.curp && updateData.curp !== existingPatient.curp) {
        const { data: duplicatePatient } = await supabaseService
          .from('patients')
          .select('id')
          .eq('clinic_id', clinicId)
          .eq('curp', updateData.curp)
          .neq('id', patientId)
          .single();

        if (duplicatePatient) {
          throw new Error('Ya existe otro paciente con este CURP en la clínica');
        }
      }

      // Verificar unicidad de email si se está actualizando
      if (updateData.email && updateData.email !== existingPatient.email) {
        const { data: duplicatePatient } = await supabaseService
          .from('patients')
          .select('id')
          .eq('clinic_id', clinicId)
          .eq('email', updateData.email)
          .neq('id', patientId)
          .single();

        if (duplicatePatient) {
          throw new Error('Ya existe otro paciente con este email en la clínica');
        }
      }

      const updatedData = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabaseService
        .from('patients')
        .update(updatedData)
        .eq('id', patientId)
        .eq('clinic_id', clinicId)
        .select()
        .single();

      if (error) {
        logger.error(`[${requestId}] Error al actualizar paciente`, {
          error: error.message,
          patient_id: patientId,
          update_data: updatedData
        });
        throw new Error(`Error al actualizar paciente: ${error.message}`);
      }

      logger.info(`[${requestId}] Paciente actualizado exitosamente`, {
        patient_id: data.id,
        patient_name: `${data.first_name} ${data.last_name}`
      });

      return data as Patient;

    } catch (error) {
      logger.error(`[${requestId}] Error en updatePatient`, {
        error: error instanceof Error ? error.message : 'Error desconocido',
        patient_id: patientId
      });
      throw error;
    }
  }

  /**
   * Cambiar el estado activo/inactivo de un paciente
   */
  async togglePatientStatus(patientId: string, isActive: boolean, clinicId: string, requestId: string): Promise<Patient> {
    try {
      logger.info(`[${requestId}] Cambiando estado de paciente`, {
        patient_id: patientId,
        clinic_id: clinicId,
        new_status: isActive
      });

      const { data, error } = await supabaseService
        .from('patients')
        .update({ 
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', patientId)
        .eq('clinic_id', clinicId)
        .select()
        .single();

      if (error) {
        logger.error(`[${requestId}] Error al cambiar estado de paciente`, {
          error: error.message,
          patient_id: patientId
        });
        throw new Error(`Error al cambiar estado de paciente: ${error.message}`);
      }

      if (!data) {
        throw new Error('Paciente no encontrado');
      }

      logger.info(`[${requestId}] Estado de paciente cambiado exitosamente`, {
        patient_id: data.id,
        new_status: data.is_active
      });

      return data as Patient;

    } catch (error) {
      logger.error(`[${requestId}] Error en togglePatientStatus`, {
        error: error instanceof Error ? error.message : 'Error desconocido',
        patient_id: patientId
      });
      throw error;
    }
  }

  /**
   * Obtener estadísticas de pacientes de una clínica
   */
  async getPatientStats(clinicId: string, requestId: string): Promise<any> {
    try {
      logger.info(`[${requestId}] Obteniendo estadísticas de pacientes`, {
        clinic_id: clinicId
      });

      // Estadísticas básicas
      const { data: totalPatients, error: totalError } = await supabaseService
        .from('patients')
        .select('id', { count: 'exact' })
        .eq('clinic_id', clinicId);

      const { data: activePatients, error: activeError } = await supabaseService
        .from('patients')
        .select('id', { count: 'exact' })
        .eq('clinic_id', clinicId)
        .eq('is_active', true);

      // Distribución por género
      const { data: genderStats, error: genderError } = await supabaseService
        .from('patients')
        .select('gender')
        .eq('clinic_id', clinicId)
        .eq('is_active', true);

      // Pacientes registrados en los últimos 30 días
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: recentPatients, error: recentError } = await supabaseService
        .from('patients')
        .select('id', { count: 'exact' })
        .eq('clinic_id', clinicId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (totalError || activeError || genderError || recentError) {
        const error = totalError || activeError || genderError || recentError;
        logger.error(`[${requestId}] Error al obtener estadísticas`, {
          error: error?.message
        });
        throw new Error(`Error al obtener estadísticas: ${error?.message}`);
      }

      // Procesar distribución por género
      const genderDistribution = genderStats?.reduce((acc: any, patient: any) => {
        acc[patient.gender] = (acc[patient.gender] || 0) + 1;
        return acc;
      }, {}) || {};

      const stats = {
        total_patients: totalPatients?.length || 0,
        active_patients: activePatients?.length || 0,
        inactive_patients: (totalPatients?.length || 0) - (activePatients?.length || 0),
        recent_patients: recentPatients?.length || 0,
        gender_distribution: {
          male: genderDistribution['M'] || 0,
          female: genderDistribution['F'] || 0,
          other: genderDistribution['O'] || 0
        }
      };

      logger.info(`[${requestId}] Estadísticas obtenidas exitosamente`, {
        stats
      });

      return stats;

    } catch (error) {
      logger.error(`[${requestId}] Error en getPatientStats`, {
        error: error instanceof Error ? error.message : 'Error desconocido',
        clinic_id: clinicId
      });
      throw error;
    }
  }
}

export const patientService = new PatientService();