/**
 * =================================================================
 * SERVICIO DE NOTAS CLÍNICAS - SISTEMA EXPEDIENTES DENTALES
 * =================================================================
 * 
 * Este servicio maneja todas las operaciones CRUD para notas clínicas,
 * garantizando el cumplimiento de las normativas mexicanas:
 * - NOM-013-SSA2-2015 (Elementos obligatorios)
 * - NOM-024-SSA3-2012 (Registro electrónico)
 * 
 * FUNCIONALIDADES PRINCIPALES:
 * 1. Crear notas clínicas con validaciones normativas
 * 2. Actualizar notas (solo si no están firmadas)
 * 3. Consultar notas con filtros avanzados
 * 4. Generar reportes para auditorías
 * 5. Mantener trazabilidad completa
 * 
 * VALIDACIONES CRÍTICAS:
 * - Una cita solo puede tener una nota clínica
 * - Elementos obligatorios según NOM-013
 * - Códigos CIE-10 válidos
 * - Permisos de usuario (solo dentistas asignados)
 * - Integridad referencial
 * 
 * =================================================================
 */

import supabase, { supabaseService } from '../config/supabase';
import logger from '../config/logger';
import { 
  ClinicalNote,
  CreateClinicalNoteRequest,
  UpdateClinicalNoteRequest,
  ClinicalNoteFilters,
  ClinicalNotesResponse,
  ClinicalNotesStats,
  ClinicalNoteErrorCode,
  ClinicalNoteValidationError,
  ClinicalNoteStatus,
  ClinicalNoteType,
  ConsultationPriority
} from '../types/clinical-notes';
import { MedicalRecordsService } from './medicalRecordsService';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// =================================================================
// INTERFACES PARA RESPUESTAS DE BASE DE DATOS
// =================================================================

/**
 * Respuesta de la base de datos para notas clínicas
 */
interface ClinicalNoteDbResponse {
  id: string;
  clinic_id: string;
  appointment_id: string;
  medical_record_id: string;
  chief_complaint: string;
  present_illness?: string;
  clinical_examination: string;
  diagnosis: string;
  differential_diagnosis?: string;
  icd10_code: string;
  icd10_description?: string;
  treatment_plan: string;
  procedures_performed?: string;
  materials_used?: string;
  prescriptions?: string;
  recommendations?: string;
  next_appointment_notes?: string;
  blood_pressure?: string;
  heart_rate?: number;
  temperature?: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
}

/**
 * Respuesta extendida con información relacionada
 */
interface ClinicalNoteWithRelations extends ClinicalNoteDbResponse {
  // Información del paciente
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
    second_last_name?: string;
    date_of_birth: string;
  };
  
  // Información del dentista
  dentist?: {
    id: string;
    first_name: string;
    last_name: string;
    professional_license?: string;
  };
  
  // Información de la cita
  appointment?: {
    id: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    appointment_type: string;
    status: string;
  };
}

// =================================================================
// CLASE PRINCIPAL DEL SERVICIO
// =================================================================

export class ClinicalNotesService {
  
  /**
   * Crear una nueva nota clínica
   * 
   * VALIDACIONES CRÍTICAS:
   * 1. La cita debe existir y estar completada
   * 2. El usuario debe ser el dentista asignado a la cita
   * 3. La cita no debe tener ya una nota clínica
   * 4. Todos los campos obligatorios deben estar presentes
   * 5. El código CIE-10 debe ser válido
   */
  async createClinicalNote(
    noteData: CreateClinicalNoteRequest, 
    clinicId: string, 
    userId: string, 
    requestId: string
  ): Promise<ClinicalNote> {
    try {
      logger.info(`[${requestId}] Iniciando creación de nota clínica`, {
        clinic_id: clinicId,
        appointment_id: noteData.appointment_id,
        user_id: userId
      });

      // PASO 1: Validar que la cita existe y está completada
      const appointment = await this.validateAppointment(
        noteData.appointment_id, 
        clinicId, 
        userId, 
        requestId
      );

      // PASO 2: Validar que no existe ya una nota para esta cita
      await this.validateUniqueNotePerAppointment(
        noteData.appointment_id, 
        requestId
      );

      // PASO 3: Obtener o validar el expediente médico
      let medicalRecordId = noteData.medical_record_id;
      
      if (!medicalRecordId) {
        // Si no se proporciona medical_record_id, intentar obtenerlo automáticamente
        logger.info(`[${requestId}] Obteniendo expediente médico automáticamente`, {
          patient_id: appointment.patient_id
        });
        
        const medicalRecord = await MedicalRecordsService.getMedicalRecordByPatientId(appointment.patient_id);
        
        if (!medicalRecord) {
          logger.error(`[${requestId}] No se encontró expediente médico para el paciente`, {
            patient_id: appointment.patient_id
          });
          throw new Error('No se encontró expediente médico activo para este paciente. Debe crear un expediente médico antes de agregar notas clínicas.');
        }
        
        medicalRecordId = medicalRecord.id;
        logger.info(`[${requestId}] Expediente médico obtenido automáticamente`, {
          medical_record_id: medicalRecordId,
          patient_id: appointment.patient_id
        });
      } else {
        // Si se proporciona medical_record_id, validarlo
        await this.validateMedicalRecord(
          medicalRecordId, 
          appointment.patient_id, 
          clinicId, 
          requestId
        );
      }

      // PASO 4: Validar elementos obligatorios NOM-013
      this.validateRequiredFields(noteData, requestId);

      // PASO 5: Validar código CIE-10
      await this.validateICD10Code(
        noteData.diagnosis.primary_icd10_code, 
        requestId
      );

      // PASO 6: Preparar datos para inserción
      const noteId = uuidv4();
      const now = new Date().toISOString();
      
      const dbData = {
        id: noteId,
        clinic_id: clinicId,
        appointment_id: noteData.appointment_id,
        medical_record_id: medicalRecordId,
        
        // Elementos obligatorios NOM-013
        chief_complaint: noteData.chief_complaint,
        present_illness: noteData.present_illness,
        clinical_examination: noteData.clinical_examination,
        diagnosis: noteData.diagnosis.primary_diagnosis,
        differential_diagnosis: noteData.diagnosis.differential_diagnosis,
        icd10_code: noteData.diagnosis.primary_icd10_code,
        icd10_description: noteData.diagnosis.primary_icd10_description,
        treatment_plan: JSON.stringify(noteData.treatment_plan),
        
        // Elementos adicionales
        procedures_performed: noteData.procedures_performed,
        materials_used: noteData.materials_used,
        prescriptions: noteData.treatment_plan.prescriptions ? 
          JSON.stringify(noteData.treatment_plan.prescriptions) : null,
        recommendations: noteData.treatment_plan.recommendations,
        next_appointment_notes: noteData.treatment_plan.next_appointment_notes,
        
        // Signos vitales
        blood_pressure: noteData.vital_signs?.blood_pressure,
        heart_rate: noteData.vital_signs?.heart_rate,
        temperature: noteData.vital_signs?.temperature,
        
        // Metadatos
        created_at: now,
        updated_at: now,
        created_by: userId,
        updated_by: null
      };

      // PASO 7: Insertar en base de datos
      const { data, error } = await supabaseService
        .from('clinical_notes')
        .insert(dbData)
        .select(`
          *,
          appointments!inner(
            id,
            appointment_date,
            start_time,
            end_time,
            appointment_type,
            status,
            patient_id
          ),
          medical_records!inner(
            id,
            patient_id,
            patients!inner(
              id,
              first_name,
              last_name,
              second_last_name,
              date_of_birth
            )
          )
        `)
        .single();

      if (error) {
        logger.error(`[${requestId}] Error al crear nota clínica`, {
          error: error.message,
          appointment_id: noteData.appointment_id
        });
        throw new Error(`Error al crear nota clínica: ${error.message}`);
      }

      // PASO 8: Actualizar estado de la cita a 'completed'
      await this.updateAppointmentStatus(
        noteData.appointment_id, 
        'completed', 
        requestId
      );

      // PASO 9: Registrar en auditoría
      await this.logAuditEvent(
        'CREATE_CLINICAL_NOTE',
        noteId,
        null,
        dbData,
        userId,
        clinicId,
        requestId
      );

      logger.info(`[${requestId}] Nota clínica creada exitosamente`, {
        note_id: noteId,
        appointment_id: noteData.appointment_id
      });

      return this.mapDbResponseToClinicalNote(data);

    } catch (error) {
      logger.error(`[${requestId}] Error en createClinicalNote`, {
        error: error instanceof Error ? error.message : 'Error desconocido',
        appointment_id: noteData.appointment_id
      });
      throw error;
    }
  }

  /**
   * Actualizar una nota clínica existente
   * 
   * RESTRICCIONES:
   * - Solo se puede actualizar si status !== 'completed'
   * - Solo el dentista que la creó puede modificarla
   * - Se mantiene trazabilidad de cambios
   */
  async updateClinicalNote(
    noteId: string,
    updateData: UpdateClinicalNoteRequest,
    clinicId: string,
    userId: string,
    requestId: string
  ): Promise<ClinicalNote> {
    try {
      logger.info(`[${requestId}] Iniciando actualización de nota clínica`, {
        note_id: noteId,
        clinic_id: clinicId,
        user_id: userId
      });

      // PASO 1: Obtener nota actual
      const currentNote = await this.getClinicalNoteById(
        noteId, 
        clinicId, 
        requestId
      );

      // PASO 2: Validar permisos de modificación
      this.validateUpdatePermissions(currentNote, userId, requestId);

      // PASO 3: Validar código CIE-10 si se está actualizando
      if (updateData.diagnosis?.primary_icd10_code) {
        await this.validateICD10Code(
          updateData.diagnosis.primary_icd10_code, 
          requestId
        );
      }

      // PASO 4: Preparar datos de actualización
      const now = new Date().toISOString();
      const updateDbData: any = {
        updated_at: now,
        updated_by: userId
      };

      // Mapear campos actualizables
      if (updateData.chief_complaint !== undefined) {
        updateDbData.chief_complaint = updateData.chief_complaint;
      }
      if (updateData.present_illness !== undefined) {
        updateDbData.present_illness = updateData.present_illness;
      }
      if (updateData.clinical_examination !== undefined) {
        updateDbData.clinical_examination = updateData.clinical_examination;
      }
      if (updateData.diagnosis) {
        if (updateData.diagnosis.primary_diagnosis) {
          updateDbData.diagnosis = updateData.diagnosis.primary_diagnosis;
        }
        if (updateData.diagnosis.primary_icd10_code) {
          updateDbData.icd10_code = updateData.diagnosis.primary_icd10_code;
        }
        if (updateData.diagnosis.primary_icd10_description) {
          updateDbData.icd10_description = updateData.diagnosis.primary_icd10_description;
        }
        if (updateData.diagnosis.differential_diagnosis !== undefined) {
          updateDbData.differential_diagnosis = updateData.diagnosis.differential_diagnosis;
        }
      }
      if (updateData.treatment_plan) {
        updateDbData.treatment_plan = JSON.stringify(updateData.treatment_plan);
        if (updateData.treatment_plan.prescriptions) {
          updateDbData.prescriptions = JSON.stringify(updateData.treatment_plan.prescriptions);
        }
        if (updateData.treatment_plan.recommendations !== undefined) {
          updateDbData.recommendations = updateData.treatment_plan.recommendations;
        }
        if (updateData.treatment_plan.next_appointment_notes !== undefined) {
          updateDbData.next_appointment_notes = updateData.treatment_plan.next_appointment_notes;
        }
      }
      if (updateData.procedures_performed !== undefined) {
        updateDbData.procedures_performed = updateData.procedures_performed;
      }
      if (updateData.materials_used !== undefined) {
        updateDbData.materials_used = updateData.materials_used;
      }
      if (updateData.vital_signs) {
        if (updateData.vital_signs.blood_pressure !== undefined) {
          updateDbData.blood_pressure = updateData.vital_signs.blood_pressure;
        }
        if (updateData.vital_signs.heart_rate !== undefined) {
          updateDbData.heart_rate = updateData.vital_signs.heart_rate;
        }
        if (updateData.vital_signs.temperature !== undefined) {
          updateDbData.temperature = updateData.vital_signs.temperature;
        }
      }

      // PASO 5: Ejecutar actualización
      const { data, error } = await supabaseService
        .from('clinical_notes')
        .update(updateDbData)
        .eq('id', noteId)
        .eq('clinic_id', clinicId)
        .select(`
          *,
          appointments!inner(
            id,
            appointment_date,
            start_time,
            end_time,
            appointment_type,
            status,
            patient_id
          ),
          patients!inner(
            id,
            first_name,
            last_name,
            second_last_name,
            date_of_birth
          )
        `)
        .single();

      if (error) {
        logger.error(`[${requestId}] Error al actualizar nota clínica`, {
          error: error.message,
          note_id: noteId
        });
        throw new Error(`Error al actualizar nota clínica: ${error.message}`);
      }

      // PASO 6: Registrar en auditoría
      await this.logAuditEvent(
        'UPDATE_CLINICAL_NOTE',
        noteId,
        currentNote,
        updateDbData,
        userId,
        clinicId,
        requestId
      );

      logger.info(`[${requestId}] Nota clínica actualizada exitosamente`, {
        note_id: noteId
      });

      return this.mapDbResponseToClinicalNote(data);

    } catch (error) {
      logger.error(`[${requestId}] Error en updateClinicalNote`, {
        error: error instanceof Error ? error.message : 'Error desconocido',
        note_id: noteId
      });
      throw error;
    }
  }

  /**
   * Obtener una nota clínica por ID
   */
  async getClinicalNoteById(
    noteId: string,
    clinicId: string,
    requestId: string
  ): Promise<ClinicalNote> {
    try {
      const { data, error } = await supabaseService
        .from('clinical_notes')
        .select(`
          *,
          appointments!inner(
            id,
            appointment_date,
            start_time,
            end_time,
            appointment_type,
            status,
            patient_id
          ),
          medical_records!inner(
            id,
            patient_id,
            patients!inner(
              id,
              first_name,
              last_name,
              second_last_name,
              date_of_birth
            )
          )
        `)
        .eq('id', noteId)
        .eq('clinic_id', clinicId)
        .single();

      if (error || !data) {
        logger.error(`[${requestId}] Nota clínica no encontrada`, {
          note_id: noteId,
          clinic_id: clinicId,
          error: error?.message
        });
        throw new Error('Nota clínica no encontrada');
      }

      return this.mapDbResponseToClinicalNote(data);

    } catch (error) {
      logger.error(`[${requestId}] Error en getClinicalNoteById`, {
        error: error instanceof Error ? error.message : 'Error desconocido',
        note_id: noteId
      });
      throw error;
    }
  }

  /**
   * Obtener notas clínicas con filtros y paginación
   */
  async getClinicalNotes(
    filters: ClinicalNoteFilters,
    clinicId: string,
    requestId: string
  ): Promise<ClinicalNotesResponse> {
    try {
      logger.info(`[${requestId}] Consultando notas clínicas`, {
        clinic_id: clinicId,
        filters
      });

      let query = supabaseService
        .from('clinical_notes')
        .select(`
          *,
          appointments!inner(
            id,
            appointment_date,
            start_time,
            end_time,
            appointment_type,
            status,
            patient_id
          ),
          medical_records!inner(
            id,
            patient_id,
            patients!inner(
              id,
              first_name,
              last_name,
              second_last_name,
              date_of_birth
            )
          )
        `, { count: 'exact' })
        .eq('clinic_id', clinicId);

      // Aplicar filtros
      if (filters.patient_id) {
        query = query.eq('medical_records.patient_id', filters.patient_id);
      }
      if (filters.dentist_id) {
        query = query.eq('created_by', filters.dentist_id);
      }
      if (filters.appointment_id) {
        query = query.eq('appointment_id', filters.appointment_id);
      }
      if (filters.icd10_code) {
        query = query.eq('icd10_code', filters.icd10_code);
      }
      if (filters.diagnosis_contains) {
        query = query.ilike('diagnosis', `%${filters.diagnosis_contains}%`);
      }
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      // Ordenamiento
      const sortBy = filters.sort_by || 'created_at';
      const sortOrder = filters.sort_order || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Paginación
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;
      
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error(`[${requestId}] Error al consultar notas clínicas`, {
          error: error.message,
          filters
        });
        throw new Error(`Error al consultar notas clínicas: ${error.message}`);
      }

      const totalRecords = count || 0;
      const totalPages = Math.ceil(totalRecords / limit);

      const clinicalNotes = data?.map(item => this.mapDbResponseToClinicalNote(item)) || [];

      return {
        data: clinicalNotes,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_records: totalRecords,
          records_per_page: limit,
          has_next_page: page < totalPages,
          has_previous_page: page > 1
        },
        filters_applied: filters
      };

    } catch (error) {
      logger.error(`[${requestId}] Error en getClinicalNotes`, {
        error: error instanceof Error ? error.message : 'Error desconocido',
        filters
      });
      throw error;
    }
  }

  // =================================================================
  // MÉTODOS DE VALIDACIÓN PRIVADOS
  // =================================================================

  /**
   * Validar que la cita existe, está completada y el usuario tiene permisos
   */
  private async validateAppointment(
    appointmentId: string,
    clinicId: string,
    userId: string,
    requestId: string
  ): Promise<any> {
    const { data: appointment, error } = await supabaseService
      .from('appointments')
      .select(`
        id,
        patient_id,
        dentist_id,
        appointment_date,
        start_time,
        end_time,
        appointment_type,
        status,
        clinic_id
      `)
      .eq('id', appointmentId)
      .eq('clinic_id', clinicId)
      .single();

    if (error || !appointment) {
      logger.error(`[${requestId}] Cita no encontrada`, {
        appointment_id: appointmentId,
        error: error?.message
      });
      throw new Error('Cita no encontrada');
    }

    // Validar que el usuario es el dentista asignado
    if (appointment.dentist_id !== userId) {
      logger.error(`[${requestId}] Usuario no autorizado para esta cita`, {
        appointment_id: appointmentId,
        user_id: userId,
        dentist_id: appointment.dentist_id
      });
      throw new Error('No tiene permisos para crear nota clínica para esta cita');
    }

    // Validar que la cita está en estado que permite crear nota
    const validStatuses = ['in_progress', 'completed'];
    if (!validStatuses.includes(appointment.status)) {
      logger.error(`[${requestId}] Estado de cita no válido para crear nota`, {
        appointment_id: appointmentId,
        status: appointment.status
      });
      throw new Error('La cita debe estar en progreso o completada para crear una nota clínica');
    }

    return appointment;
  }

  /**
   * Validar que no existe ya una nota clínica para esta cita
   */
  private async validateUniqueNotePerAppointment(
    appointmentId: string,
    requestId: string
  ): Promise<void> {
    const { data: existingNote, error } = await supabaseService
      .from('clinical_notes')
      .select('id')
      .eq('appointment_id', appointmentId)
      .single();

    if (existingNote) {
      logger.error(`[${requestId}] Ya existe una nota clínica para esta cita`, {
        appointment_id: appointmentId,
        existing_note_id: existingNote.id
      });
      throw new Error('Ya existe una nota clínica para esta cita');
    }
  }

  /**
   * Validar que el expediente médico existe y pertenece al paciente
   */
  private async validateMedicalRecord(
    medicalRecordId: string,
    patientId: string,
    clinicId: string,
    requestId: string
  ): Promise<void> {
    const { data: medicalRecord, error } = await supabaseService
      .from('medical_records')
      .select('id, patient_id, clinic_id')
      .eq('id', medicalRecordId)
      .eq('patient_id', patientId)
      .eq('clinic_id', clinicId)
      .single();

    if (error || !medicalRecord) {
      logger.error(`[${requestId}] Expediente médico no encontrado`, {
        medical_record_id: medicalRecordId,
        patient_id: patientId,
        error: error?.message
      });
      throw new Error('Expediente médico no encontrado o no pertenece al paciente');
    }
  }

  /**
   * Validar elementos obligatorios según NOM-013
   */
  private validateRequiredFields(
    noteData: CreateClinicalNoteRequest,
    requestId: string
  ): void {
    const requiredFields = [
      { field: 'chief_complaint', value: noteData.chief_complaint },
      { field: 'clinical_examination', value: noteData.clinical_examination },
      { field: 'diagnosis.primary_diagnosis', value: noteData.diagnosis.primary_diagnosis },
      { field: 'diagnosis.primary_icd10_code', value: noteData.diagnosis.primary_icd10_code },
      { field: 'treatment_plan.description', value: noteData.treatment_plan.description }
    ];

    for (const { field, value } of requiredFields) {
      if (!value || value.trim() === '') {
        logger.error(`[${requestId}] Campo obligatorio faltante`, {
          field,
          appointment_id: noteData.appointment_id
        });
        throw new Error(`El campo ${field} es obligatorio según NOM-013`);
      }
    }
  }

  /**
   * Validar código CIE-10 (implementación básica)
   * TODO: Integrar con catálogo oficial CIE-10
   */
  private async validateICD10Code(
    icd10Code: string,
    requestId: string
  ): Promise<void> {
    // Validación básica de formato CIE-10
    const icd10Pattern = /^[A-Z][0-9]{2}(\.[0-9]{1,2})?$/;
    
    if (!icd10Pattern.test(icd10Code)) {
      logger.error(`[${requestId}] Código CIE-10 inválido`, {
        icd10_code: icd10Code
      });
      throw new Error('Código CIE-10 inválido. Formato esperado: A00 o A00.0');
    }

    // TODO: Validar contra catálogo oficial
    // Por ahora solo validamos formato
  }

  /**
   * Validar permisos para actualizar nota
   */
  private validateUpdatePermissions(
    currentNote: ClinicalNote,
    userId: string,
    requestId: string
  ): void {
    // Solo el dentista que creó la nota puede modificarla
    if (currentNote.created_by !== userId) {
      logger.error(`[${requestId}] Usuario no autorizado para modificar nota`, {
        note_id: currentNote.id,
        user_id: userId,
        created_by: currentNote.created_by
      });
      throw new Error('No tiene permisos para modificar esta nota clínica');
    }

    // No se puede modificar si está en estado 'completed' o 'archived'
    if (currentNote.status === ClinicalNoteStatus.COMPLETED || 
        currentNote.status === ClinicalNoteStatus.ARCHIVED) {
      logger.error(`[${requestId}] Nota no modificable por su estado`, {
        note_id: currentNote.id,
        status: currentNote.status
      });
      throw new Error('No se puede modificar una nota clínica completada o archivada');
    }
  }

  // =================================================================
  // MÉTODOS AUXILIARES PRIVADOS
  // =================================================================

  /**
   * Actualizar estado de la cita
   */
  private async updateAppointmentStatus(
    appointmentId: string,
    status: string,
    requestId: string
  ): Promise<void> {
    const { error } = await supabaseService
      .from('appointments')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId);

    if (error) {
      logger.error(`[${requestId}] Error al actualizar estado de cita`, {
        appointment_id: appointmentId,
        status,
        error: error.message
      });
      // No lanzamos error aquí para no afectar la creación de la nota
    }
  }

  /**
   * Registrar evento de auditoría
   */
  private async logAuditEvent(
    action: string,
    recordId: string,
    oldValues: any,
    newValues: any,
    userId: string,
    clinicId: string,
    requestId: string
  ): Promise<void> {
    try {
      await supabaseService
        .from('audit_logs')
        .insert({
          user_id: userId,
          action,
          table_name: 'clinical_notes',
          record_id: recordId,
          old_values: oldValues,
          new_values: newValues,
          clinic_id: clinicId,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error(`[${requestId}] Error al registrar auditoría`, {
        action,
        record_id: recordId,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      // No lanzamos error para no afectar la operación principal
    }
  }

  /**
   * Mapear respuesta de BD a objeto ClinicalNote
   */
  private mapDbResponseToClinicalNote(dbData: any): ClinicalNote {
    return {
      id: dbData.id,
      clinic_id: dbData.clinic_id,
      appointment_id: dbData.appointment_id,
      medical_record_id: dbData.medical_record_id,
      patient_id: dbData.medical_records?.patient_id || '',
      created_by: dbData.created_by,
      updated_by: dbData.updated_by,
      
      // Campos requeridos con valores por defecto
      note_type: dbData.note_type || 'ROUTINE_CONSULTATION',
      status: dbData.status || 'DRAFT',
      priority: dbData.priority || 'routine',
      
      chief_complaint: dbData.chief_complaint,
      present_illness: dbData.present_illness,
      clinical_examination: dbData.clinical_examination,
      
      diagnosis: {
        primary_diagnosis: dbData.diagnosis,
        primary_icd10_code: dbData.icd10_code,
        primary_icd10_description: dbData.icd10_description,
        differential_diagnosis: dbData.differential_diagnosis
      },
      
      treatment_plan: dbData.treatment_plan ? 
        JSON.parse(dbData.treatment_plan) : 
        { description: '' },
      
      procedures_performed: dbData.procedures_performed,
      materials_used: dbData.materials_used,
      
      vital_signs: {
        blood_pressure: dbData.blood_pressure,
        heart_rate: dbData.heart_rate,
        temperature: dbData.temperature
      },
      
      // Campos adicionales con valores por defecto
      additional_notes: dbData.additional_notes,
      attached_files: dbData.attached_files ? JSON.parse(dbData.attached_files) : [],
      version: dbData.version || 1,
      created_at: dbData.created_at,
      updated_at: dbData.updated_at,
      
      digital_signature: dbData.digital_signature || '',
      is_modified_after_signature: dbData.is_modified_after_signature || false
    };
  }
}

// Exportar instancia singleton
export const clinicalNotesService = new ClinicalNotesService();
export default clinicalNotesService;