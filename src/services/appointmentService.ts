/**
 * =================================================================
 * SERVICIO DE CITAS - LÓGICA DE NEGOCIO
 * =================================================================
 * 
 * Este servicio maneja toda la lógica de negocio para el módulo de citas.
 * Incluye validaciones de conflictos, gestión de estados y bases para
 * recordatorios/notificaciones (MVP approach).
 * 
 * =================================================================
 */

import { supabaseService as supabase } from '../config/supabase';
import logger from '../config/logger';
import {
  Appointment,
  CreateAppointmentData,
  UpdateAppointmentData,
  AppointmentFilters,
  UpdateAppointmentStatusData,
  AppointmentStatus,
  AppointmentType
} from '../schemas/appointment.schemas';
import { appointmentValidations, ValidationResult } from '../utils/appointmentValidations';

// =================================================================
// INTERFACES DE RESPUESTA
// =================================================================

export interface AppointmentListResponse {
  appointments: Appointment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AppointmentConflict {
  conflictType: 'time_overlap' | 'dentist_busy' | 'patient_busy';
  conflictingAppointment: Partial<Appointment>;
  message: string;
}

export interface AppointmentStats {
  totalAppointments: number;
  byStatus: Record<AppointmentStatus, number>;
  byType: Record<AppointmentType, number>;
  todayAppointments: number;
  upcomingAppointments: number;
}

// =================================================================
// CLASE PRINCIPAL DEL SERVICIO
// =================================================================

export class AppointmentService {
  
  // =================================================================
  // MÉTODOS CRUD PRINCIPALES
  // =================================================================

  /**
   * Crear nueva cita con validaciones de conflictos
   */
  async createAppointment(
    appointmentData: CreateAppointmentData,
    clinicId: string,
    createdBy: string
  ): Promise<Appointment> {
    try {
      // 1. Ejecutar validaciones avanzadas
      const validationResult = await appointmentValidations.validateCompleteAppointment(
        {
          appointment_date: appointmentData.appointment_date,
          start_time: appointmentData.start_time,
          end_time: appointmentData.end_time,
          duration_minutes: appointmentData.duration_minutes,
          appointment_type: appointmentData.appointment_type,
          dentist_id: appointmentData.dentist_id,
          patient_id: appointmentData.patient_id
        },
        clinicId
      );

      if (!validationResult.isValid) {
        throw new Error(`Validación fallida: ${validationResult.errors.join(', ')}`);
      }

      // Log warnings if any
      if (validationResult.warnings.length > 0) {
        logger.warn('Advertencias en validación de cita', {
          warnings: validationResult.warnings,
          appointmentData
        });
      }

      // 2. Validar conflictos de horario específicos
      const conflicts = await this.checkTimeConflicts(
        appointmentData.appointment_date,
        appointmentData.start_time,
        appointmentData.end_time,
        appointmentData.dentist_id,
        appointmentData.patient_id,
        clinicId
      );

      if (conflicts.length > 0) {
        throw new Error(`Conflicto de horario: ${conflicts[0]?.message || 'Conflicto detectado'}`);
      }

      // 2. Crear la cita
      const { data, error } = await supabase
        .from('appointments')
        .insert({
          ...appointmentData,
          clinic_id: clinicId,
          created_by: createdBy,
          status: AppointmentStatus.SCHEDULED,
          reminder_sent: false
        })
        .select(`
          *,
          patient:patients(first_name, last_name, phone, email),
          dentist:users!dentist_id(first_name, last_name, email)
        `)
        .single();

      if (error) throw error;

      // 3. Log de auditoría
      await this.logAppointmentAction('CREATE', data.id, createdBy, {
        appointment_date: appointmentData.appointment_date,
        patient_id: appointmentData.patient_id,
        dentist_id: appointmentData.dentist_id
      });

      // 4. Preparar recordatorio (sin enviar en MVP)
      await this.scheduleReminder(data.id, data.appointment_date, data.start_time);

      logger.info('Cita creada exitosamente', {
        appointmentId: data.id,
        clinicId,
        createdBy
      });

      return data;
    } catch (error) {
      logger.error('Error al crear cita', { error, appointmentData, clinicId });
      throw error;
    }
  }

  /**
   * Obtener lista de citas con filtros
   */
  async getAppointments(
    filters: AppointmentFilters,
    clinicId: string
  ): Promise<AppointmentListResponse> {
    try {
      let query = supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(first_name, last_name, phone, email),
          dentist:users!dentist_id(first_name, last_name, email)
        `, { count: 'exact' })
        .eq('clinic_id', clinicId);

      // Aplicar filtros
      if (filters.date_from) {
        query = query.gte('appointment_date', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('appointment_date', filters.date_to);
      }
      if (filters.patient_id) {
        query = query.eq('patient_id', filters.patient_id);
      }
      if (filters.dentist_id) {
        query = query.eq('dentist_id', filters.dentist_id);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.appointment_type) {
        query = query.eq('appointment_type', filters.appointment_type);
      }
      if (filters.search) {
        query = query.or(`
          reason_for_visit.ilike.%${filters.search}%,
          notes.ilike.%${filters.search}%
        `);
      }

      // Ordenamiento
      query = query.order(filters.sort_by, { ascending: filters.sort_order === 'asc' });

      // Paginación
      const from = (filters.page - 1) * filters.limit;
      const to = from + filters.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      const totalPages = Math.ceil((count || 0) / filters.limit);

      return {
        appointments: data || [],
        total: count || 0,
        page: filters.page,
        limit: filters.limit,
        totalPages
      };
    } catch (error) {
      logger.error('Error al obtener citas', { error, filters, clinicId });
      throw error;
    }
  }

  /**
   * Obtener cita por ID
   */
  async getAppointmentById(
    appointmentId: string,
    clinicId: string
  ): Promise<Appointment | null> {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(first_name, last_name, phone, email, date_of_birth),
          dentist:users!dentist_id(first_name, last_name, email),
          clinical_notes(*)
        `)
        .eq('id', appointmentId)
        .eq('clinic_id', clinicId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return data;
    } catch (error) {
      logger.error('Error al obtener cita', { error, appointmentId, clinicId });
      throw error;
    }
  }

  /**
   * Actualizar cita
   */
  async updateAppointment(
    appointmentId: string,
    updateData: UpdateAppointmentData,
    clinicId: string,
    updatedBy: string
  ): Promise<Appointment> {
    try {
      // 1. Verificar que la cita existe
      const existingAppointment = await this.getAppointmentById(appointmentId, clinicId);
      if (!existingAppointment) {
        throw new Error('Cita no encontrada');
      }

      // 2. Si se cambian horarios o datos relevantes, validar
      if (updateData.appointment_date || updateData.start_time || updateData.end_time || updateData.duration_minutes || updateData.appointment_type) {
        // Usar datos actuales como fallback
        const finalDate = updateData.appointment_date || existingAppointment.appointment_date;
        const finalStartTime = updateData.start_time || existingAppointment.start_time;
        const finalEndTime = updateData.end_time || existingAppointment.end_time;
        const finalDuration = updateData.duration_minutes || existingAppointment.duration_minutes;
        const finalType = updateData.appointment_type || existingAppointment.appointment_type;
        const finalDentistId = updateData.dentist_id || existingAppointment.dentist_id;

        // Ejecutar validaciones avanzadas
        const validationResult = await appointmentValidations.validateCompleteAppointment(
          {
            appointment_date: finalDate,
            start_time: finalStartTime,
            end_time: finalEndTime,
            duration_minutes: finalDuration,
            appointment_type: finalType,
            dentist_id: finalDentistId,
            patient_id: existingAppointment.patient_id
          },
          clinicId,
          appointmentId
        );

        if (!validationResult.isValid) {
          throw new Error(`Validación fallida: ${validationResult.errors.join(', ')}`);
        }

        // Log warnings if any
        if (validationResult.warnings.length > 0) {
          logger.warn('Advertencias en actualización de cita', {
            warnings: validationResult.warnings,
            appointmentId,
            updateData
          });
        }

        // Validar conflictos de horario específicos
        const conflicts = await this.checkTimeConflicts(
          finalDate,
          finalStartTime,
          finalEndTime,
          finalDentistId,
          existingAppointment.patient_id,
          clinicId,
          appointmentId // Excluir la cita actual
        );

        if (conflicts.length > 0) {
          throw new Error(`Conflicto de horario: ${conflicts[0]?.message || 'Conflicto detectado'}`);
        }
      }

      // 3. Actualizar la cita
      const { data, error } = await supabase
        .from('appointments')
        .update({
          ...updateData,
          updated_by: updatedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId)
        .eq('clinic_id', clinicId)
        .select(`
          *,
          patient:patients(first_name, last_name, phone, email),
          dentist:users!dentist_id(first_name, last_name, email)
        `)
        .single();

      if (error) throw error;

      // 4. Log de auditoría
      await this.logAppointmentAction('UPDATE', appointmentId, updatedBy, updateData);

      logger.info('Cita actualizada exitosamente', {
        appointmentId,
        clinicId,
        updatedBy
      });

      return data;
    } catch (error) {
      logger.error('Error al actualizar cita', { error, appointmentId, updateData });
      throw error;
    }
  }

  /**
   * Cambiar estado de cita
   */
  async updateAppointmentStatus(
    appointmentId: string,
    statusData: UpdateAppointmentStatusData,
    clinicId: string,
    updatedBy: string
  ): Promise<Appointment> {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .update({
          status: statusData.status,
          cancellation_reason: statusData.cancellation_reason,
          updated_by: updatedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId)
        .eq('clinic_id', clinicId)
        .select(`
          *,
          patient:patients(first_name, last_name, phone, email),
          dentist:users!dentist_id(first_name, last_name, email)
        `)
        .single();

      if (error) throw error;

      // Log de auditoría
      await this.logAppointmentAction('STATUS_CHANGE', appointmentId, updatedBy, {
        new_status: statusData.status,
        cancellation_reason: statusData.cancellation_reason
      });

      // Si se cancela o no se presenta, cancelar recordatorio
      if (statusData.status === AppointmentStatus.CANCELLED || statusData.status === AppointmentStatus.NO_SHOW) {
        await this.cancelReminder(appointmentId);
      }

      logger.info('Estado de cita actualizado', {
        appointmentId,
        newStatus: statusData.status,
        clinicId
      });

      return data;
    } catch (error) {
      logger.error('Error al cambiar estado de cita', { error, appointmentId, statusData });
      throw error;
    }
  }

  /**
   * Eliminar cita (soft delete)
   */
  async deleteAppointment(
    appointmentId: string,
    clinicId: string,
    deletedBy: string
  ): Promise<void> {
    try {
      // En lugar de eliminar, marcamos como cancelada
      await this.updateAppointmentStatus(
        appointmentId,
        {
          status: AppointmentStatus.CANCELLED,
          cancellation_reason: 'Cita eliminada por administrador'
        },
        clinicId,
        deletedBy
      );

      // Cancelar recordatorios
      await this.cancelReminder(appointmentId);

      logger.info('Cita eliminada (soft delete)', {
        appointmentId,
        clinicId,
        deletedBy
      });
    } catch (error) {
      logger.error('Error al eliminar cita', { error, appointmentId });
      throw error;
    }
  }

  // =================================================================
  // VALIDACIONES DE CONFLICTOS
  // =================================================================

  /**
   * Verificar conflictos de horario
   */
  async checkTimeConflicts(
    appointmentDate: string,
    startTime: string,
    endTime: string,
    dentistId: string,
    patientId: string,
    clinicId: string,
    excludeAppointmentId?: string
  ): Promise<AppointmentConflict[]> {
    try {
      const conflicts: AppointmentConflict[] = [];

      // Construir query base
      let query = supabase
        .from('appointments')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('appointment_date', appointmentDate)
        .in('status', [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS]);

      // Excluir cita actual si es actualización
      if (excludeAppointmentId) {
        query = query.neq('id', excludeAppointmentId);
      }

      const { data: existingAppointments, error } = await query;

      if (error) throw error;

      for (const appointment of existingAppointments || []) {
        // Verificar solapamiento de horarios
        if (this.hasTimeOverlap(startTime, endTime, appointment.start_time, appointment.end_time)) {
          // Conflicto con dentista
          if (appointment.dentist_id === dentistId) {
            conflicts.push({
              conflictType: 'dentist_busy',
              conflictingAppointment: appointment,
              message: `El dentista ya tiene una cita de ${appointment.start_time} a ${appointment.end_time}`
            });
          }

          // Conflicto con paciente
          if (appointment.patient_id === patientId) {
            conflicts.push({
              conflictType: 'patient_busy',
              conflictingAppointment: appointment,
              message: `El paciente ya tiene una cita de ${appointment.start_time} a ${appointment.end_time}`
            });
          }
        }
      }

      return conflicts;
    } catch (error) {
      logger.error('Error al verificar conflictos', { error });
      throw error;
    }
  }

  /**
   * Verificar solapamiento de horarios
   */
  private hasTimeOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const [start1Hours, start1Minutes] = start1.split(':').map(Number);
    const [end1Hours, end1Minutes] = end1.split(':').map(Number);
    const [start2Hours, start2Minutes] = start2.split(':').map(Number);
    const [end2Hours, end2Minutes] = end2.split(':').map(Number);

    const start1Total = (start1Hours || 0) * 60 + (start1Minutes || 0);
    const end1Total = (end1Hours || 0) * 60 + (end1Minutes || 0);
    const start2Total = (start2Hours || 0) * 60 + (start2Minutes || 0);
    const end2Total = (end2Hours || 0) * 60 + (end2Minutes || 0);

    return start1Total < end2Total && end1Total > start2Total;
  }

  // =================================================================
  // ESTADÍSTICAS Y REPORTES
  // =================================================================

  /**
   * Obtener estadísticas de citas
   */
  async getAppointmentStats(clinicId: string): Promise<AppointmentStats> {
    try {
      const today = new Date().toISOString().split('T')[0]!;
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

      // Estadísticas generales
      const { data: allAppointments, error } = await supabase
        .from('appointments')
        .select('status, appointment_type, appointment_date')
        .eq('clinic_id', clinicId);

      if (error) throw error;

      const stats: AppointmentStats = {
        totalAppointments: allAppointments?.length || 0,
        byStatus: {} as Record<AppointmentStatus, number>,
        byType: {} as Record<AppointmentType, number>,
        todayAppointments: 0,
        upcomingAppointments: 0
      };

      // Inicializar contadores
      Object.values(AppointmentStatus).forEach(status => {
        stats.byStatus[status] = 0;
      });
      Object.values(AppointmentType).forEach(type => {
        stats.byType[type] = 0;
      });

      // Procesar datos
      allAppointments?.forEach(appointment => {
        stats.byStatus[appointment.status as AppointmentStatus]++;
        stats.byType[appointment.appointment_type as AppointmentType]++;

        if (appointment.appointment_date === today) {
          stats.todayAppointments++;
        }
        if (appointment.appointment_date >= tomorrow) {
          stats.upcomingAppointments++;
        }
      });

      return stats;
    } catch (error) {
      logger.error('Error al obtener estadísticas', { error, clinicId });
      throw error;
    }
  }

  // =================================================================
  // SISTEMA DE RECORDATORIOS
  // =================================================================

  /**
   * Programar recordatorio
   */
  private async scheduleReminder(
    appointmentId: string,
    appointmentDate: string,
    startTime: string
  ): Promise<void> {
    try {
      const { notificationService } = await import('./notificationService');
      
      // Crear fecha completa de la cita
      const appointmentDateTime = new Date(`${appointmentDate}T${startTime}`);
      
      // Obtener clinic_id de la cita
      const { data: appointment } = await supabase
        .from('appointments')
        .select('clinic_id')
        .eq('id', appointmentId)
        .single();
      
      if (appointment) {
        await notificationService.scheduleAppointmentReminder(
          appointmentId,
          appointmentDateTime,
          appointment.clinic_id
        );
        
        logger.info('Recordatorio programado exitosamente', {
          appointmentId,
          appointmentDate,
          startTime
        });
      }
    } catch (error) {
      logger.error('Error al programar recordatorio', { error, appointmentId });
      // No lanzar error para no afectar creación de cita
    }
  }

  /**
   * Cancelar recordatorio
   */
  private async cancelReminder(appointmentId: string): Promise<void> {
    try {
      const { notificationService } = await import('./notificationService');
      
      // Obtener clinic_id de la cita
      const { data: appointment } = await supabase
        .from('appointments')
        .select('clinic_id')
        .eq('id', appointmentId)
        .single();
      
      if (appointment) {
        await notificationService.cancelAppointmentReminders(
          appointmentId,
          appointment.clinic_id
        );
        
        logger.info('Recordatorio cancelado exitosamente', { appointmentId });
      }
    } catch (error) {
      logger.error('Error al cancelar recordatorio', { error, appointmentId });
    }
  }

  /**
   * Marcar recordatorio como enviado
   */
  async markReminderSent(appointmentId: string): Promise<void> {
    try {
      await supabase
        .from('appointments')
        .update({
          reminder_sent: true,
          reminder_sent_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      logger.info('Recordatorio marcado como enviado', { appointmentId });
    } catch (error) {
      logger.error('Error al marcar recordatorio', { error, appointmentId });
    }
  }

  // =================================================================
  // AUDITORÍA Y LOGS
  // =================================================================

  /**
   * Registrar acción de auditoría
   */
  private async logAppointmentAction(
    action: string,
    appointmentId: string,
    userId: string,
    details: any
  ): Promise<void> {
    try {
      await supabase
        .from('audit_logs')
        .insert({
          table_name: 'appointments',
          record_id: appointmentId,
          action,
          old_values: null,
          new_values: details,
          user_id: userId,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error al registrar auditoría', { error, action, appointmentId });
      // No lanzar error para no afectar operación principal
    }
  }
}

// =================================================================
// INSTANCIA SINGLETON
// =================================================================

export const appointmentService = new AppointmentService();