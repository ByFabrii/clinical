// =================================================================
// CONTROLADOR DE NOTIFICACIONES
// Sistema de Expedientes Clínicos Dentales
// =================================================================

import { Request, Response } from 'express';
import { notificationService } from '../services/notificationService';
import { emailService } from '../services/emailService';
import { smsService } from '../services/smsService';
import logger from '../config/logger';
import { supabaseAnon } from '../config/supabase';
import {
  NotificationType,
  ReminderType,
  NotificationStatus,
  DEFAULT_NOTIFICATION_PREFERENCES
} from '../types/notifications';

export class NotificationController {
  // =================================================================
  // GESTIÓN DE RECORDATORIOS
  // =================================================================

  /**
   * Programar recordatorio manual para una cita
   */
  async scheduleReminder(req: Request, res: Response): Promise<void> {
    try {
      const { appointmentId } = req.params;
      const { reminderDate, notificationTypes } = req.body;
      const user = (req as any).user;

      if (!appointmentId) {
        res.status(400).json({
          success: false,
          message: 'ID de cita requerido'
        });
        return;
      }

      // Validar que la cita existe y pertenece a la clínica del usuario
      const { data: appointment, error } = await supabaseAnon
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .eq('clinic_id', user.clinic_id)
        .single();

      if (error || !appointment) {
        res.status(404).json({
          success: false,
          message: 'Cita no encontrada'
        });
        return;
      }

      const appointmentDate = new Date(appointment.appointment_date + 'T' + appointment.start_time);
      
      const result = await notificationService.scheduleAppointmentReminder(
        appointmentId,
        appointmentDate,
        user.clinic_id
      );

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Recordatorio programado exitosamente',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('Error al programar recordatorio', { error, appointmentId: req.params.appointmentId });
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Cancelar recordatorios de una cita
   */
  async cancelReminders(req: Request, res: Response): Promise<void> {
    try {
      const { appointmentId } = req.params;
      const user = (req as any).user;

      if (!appointmentId) {
        res.status(400).json({
          success: false,
          message: 'ID de cita requerido'
        });
        return;
      }

      await notificationService.cancelAppointmentReminders(appointmentId, user.clinic_id);

      res.status(200).json({
        success: true,
        message: 'Recordatorios cancelados exitosamente'
      });
    } catch (error) {
      logger.error('Error al cancelar recordatorios', { error, appointmentId: req.params.appointmentId });
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener recordatorios programados
   */
  async getScheduledReminders(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { status = 'SCHEDULED', limit = 50, offset = 0 } = req.query;

      const { data: reminders, error, count } = await supabaseAnon
        .from('reminder_schedules')
        .select(`
          *,
          appointment:appointments(
            id,
            appointment_date,
            start_time,
            patient:patients(first_name, last_name, phone, email)
          )
        `, { count: 'exact' })
        .eq('clinic_id', user.clinic_id)
        .eq('status', status)
        .order('reminder_date', { ascending: true })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (error) throw error;

      res.status(200).json({
        success: true,
        data: reminders,
        pagination: {
          total: count || 0,
          limit: Number(limit),
          offset: Number(offset)
        }
      });
    } catch (error) {
      logger.error('Error al obtener recordatorios programados', { error });
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // =================================================================
  // ENVÍO DE NOTIFICACIONES
  // =================================================================

  /**
   * Enviar notificación inmediata
   */
  async sendNotification(req: Request, res: Response): Promise<void> {
    try {
      const {
        type,
        recipientEmail,
        recipientPhone,
        subject,
        body,
        metadata = {}
      } = req.body;
      const user = (req as any).user;

      const result = await notificationService.sendNotification(
        type,
        recipientEmail,
        recipientPhone,
        subject,
        body,
        user.clinic_id,
        metadata
      );

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('Error al enviar notificación', { error });
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener historial de notificaciones
   */
  async getNotificationHistory(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const {
        type,
        status,
        startDate,
        endDate,
        limit = 50,
        offset = 0
      } = req.query;

      let query = supabaseAnon
        .from('notification_requests')
        .select('*', { count: 'exact' })
        .eq('clinic_id', user.clinic_id)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (type) {
        query = query.eq('type', type);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: notifications, error, count } = await query;

      if (error) throw error;

      res.status(200).json({
        success: true,
        data: notifications,
        pagination: {
          total: count || 0,
          limit: Number(limit),
          offset: Number(offset)
        }
      });
    } catch (error) {
      logger.error('Error al obtener historial de notificaciones', { error });
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // =================================================================
  // PREFERENCIAS DE NOTIFICACIÓN
  // =================================================================

  /**
   * Obtener preferencias de notificación de un paciente
   */
  async getPatientPreferences(req: Request, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const user = (req as any).user;

      const { data: preferences, error } = await supabaseAnon
        .from('notification_preferences')
        .select('*')
        .eq('patient_id', patientId)
        .eq('clinic_id', user.clinic_id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }

      res.status(200).json({
        success: true,
        data: preferences || {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          patient_id: patientId,
          clinic_id: user.clinic_id
        }
      });
    } catch (error) {
      logger.error('Error al obtener preferencias de notificación', { error, patientId: req.params.patientId });
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Actualizar preferencias de notificación de un paciente
   */
  async updatePatientPreferences(req: Request, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const user = (req as any).user;
      const preferences = req.body;

      // Verificar que el paciente pertenece a la clínica
      const { data: patient, error: patientError } = await supabaseAnon
        .from('patients')
        .select('id')
        .eq('id', patientId)
        .eq('clinic_id', user.clinic_id)
        .single();

      if (patientError || !patient) {
        res.status(404).json({
          success: false,
          message: 'Paciente no encontrado'
        });
        return;
      }

      // Upsert preferencias
      const { data, error } = await supabaseAnon
        .from('notification_preferences')
        .upsert({
          patient_id: patientId,
          clinic_id: user.clinic_id,
          ...preferences,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: 'Preferencias actualizadas exitosamente',
        data
      });
    } catch (error) {
      logger.error('Error al actualizar preferencias de notificación', { error, patientId: req.params.patientId });
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // =================================================================
  // ESTADO DE SERVICIOS
  // =================================================================

  /**
   * Verificar estado de los servicios de notificación
   */
  async getServiceStatus(req: Request, res: Response): Promise<void> {
    try {
      const [emailHealth, smsHealth] = await Promise.all([
        emailService.checkServiceHealth(),
        smsService.checkServiceHealth()
      ]);

      res.status(200).json({
        success: true,
        data: {
          email: emailHealth,
          sms: smsHealth,
          overall: emailHealth.isHealthy && smsHealth.isHealthy
        }
      });
    } catch (error) {
      logger.error('Error al verificar estado de servicios', { error });
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Procesar recordatorios pendientes (endpoint para cron jobs)
   */
  async processScheduledReminders(req: Request, res: Response): Promise<void> {
    try {
      // Verificar que la petición viene de un cron job autorizado
      const cronSecret = req.headers['x-cron-secret'];
      if (cronSecret !== process.env.CRON_SECRET) {
        res.status(401).json({
          success: false,
          message: 'No autorizado'
        });
        return;
      }

      await notificationService.processScheduledReminders();

      res.status(200).json({
        success: true,
        message: 'Recordatorios procesados exitosamente'
      });
    } catch (error) {
      logger.error('Error al procesar recordatorios programados', { error });
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // =================================================================
  // ESTADÍSTICAS
  // =================================================================

  /**
   * Obtener estadísticas de notificaciones
   */
  async getNotificationStats(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { startDate, endDate } = req.query;

      const dateFilter = startDate && endDate ? {
        gte: startDate,
        lte: endDate
      } : {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // Últimos 30 días
      };

      // Estadísticas por tipo
      const { data: typeStats, error: typeError } = await supabaseAnon
        .from('notification_requests')
        .select('type, status')
        .eq('clinic_id', user.clinic_id)
        .gte('created_at', dateFilter.gte)
        .lte('created_at', dateFilter.lte || new Date().toISOString());

      if (typeError) throw typeError;

      // Estadísticas por estado
      const { data: statusStats, error: statusError } = await supabaseAnon
        .from('notification_requests')
        .select('status')
        .eq('clinic_id', user.clinic_id)
        .gte('created_at', dateFilter.gte)
        .lte('created_at', dateFilter.lte || new Date().toISOString());

      if (statusError) throw statusError;

      // Procesar estadísticas
      const stats = {
        byType: {} as Record<string, { total: number; sent: number; failed: number }>,
        byStatus: {} as Record<string, number>,
        total: typeStats?.length || 0,
        successRate: 0
      };

      // Agrupar por tipo
      typeStats?.forEach(item => {
        if (!stats.byType[item.type]) {
          stats.byType[item.type] = { total: 0, sent: 0, failed: 0 };
        }
        const typeStats = stats.byType[item.type];
        if (typeStats) {
          typeStats.total++;
          if (item.status === NotificationStatus.SENT) {
            typeStats.sent++;
          } else if (item.status === NotificationStatus.FAILED) {
            typeStats.failed++;
          }
        }
      });

      // Agrupar por estado
      statusStats?.forEach(item => {
        stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
      });

      // Calcular tasa de éxito
      const sent = stats.byStatus[NotificationStatus.SENT] || 0;
      stats.successRate = stats.total > 0 ? (sent / stats.total) * 100 : 0;

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error al obtener estadísticas de notificaciones', { error });
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

export const notificationController = new NotificationController();