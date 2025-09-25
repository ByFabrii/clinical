// =================================================================
// SERVICIO DE NOTIFICACIONES Y RECORDATORIOS
// Sistema de Expedientes Clínicos Dentales
// =================================================================

import { supabaseAnon } from '../config/supabase';
import logger from '../config/logger';
import {
  NotificationType,
  NotificationStatus,
  ReminderType,
  NotificationRequest,
  ReminderSchedule,
  NotificationConfig,
  NotificationPreferences,
  TemplateContext,
  NotificationResponse,
  ReminderResponse,
  DEFAULT_TEMPLATES,
  DEFAULT_NOTIFICATION_PREFERENCES
} from '../types/notifications';
import { EmailService } from './emailService';
import { SMSService } from './smsService';

export class NotificationService {
  private emailService: EmailService;
  private smsService: SMSService;

  constructor() {
    this.emailService = new EmailService();
    this.smsService = new SMSService();
  }

  // =================================================================
  // GESTIÓN DE RECORDATORIOS
  // =================================================================

  /**
   * Programar recordatorio para una cita
   */
  async scheduleAppointmentReminder(
    appointmentId: string,
    appointmentDate: Date,
    clinicId: string
  ): Promise<ReminderResponse> {
    try {
      // 1. Obtener datos de la cita
      const { data: appointment, error: appointmentError } = await supabaseAnon
        .from('appointments')
        .select(`
          *,
          patient:patients(id, first_name, last_name, email, phone),
          dentist:users!dentist_id(id, first_name, last_name, email)
        `)
        .eq('id', appointmentId)
        .eq('clinic_id', clinicId)
        .single();

      if (appointmentError || !appointment) {
        throw new Error('Cita no encontrada');
      }

      // 2. Obtener preferencias de notificación del paciente
      const preferences = await this.getNotificationPreferences(
        appointment.patient.id,
        clinicId,
        'patient'
      );

      // 3. Calcular fechas de recordatorio
      const reminderDate = new Date(appointmentDate);
      reminderDate.setHours(reminderDate.getHours() - preferences.reminderTiming.appointmentReminder);

      const confirmationDate = new Date(appointmentDate);
      confirmationDate.setHours(confirmationDate.getHours() - preferences.reminderTiming.appointmentConfirmation);

      // 4. Crear recordatorios
      const reminders = [];

      if (preferences.reminderTypes.appointmentReminder) {
        const reminderId = await this.createReminderSchedule({
          appointmentId,
          clinicId,
          patientId: appointment.patient.id,
          dentistId: appointment.dentist_id,
          appointmentDate,
          reminderDate,
          type: ReminderType.APPOINTMENT_REMINDER,
          notificationTypes: this.getEnabledNotificationTypes(preferences)
        });
        reminders.push({ id: reminderId, type: 'reminder', scheduledFor: reminderDate });
      }

      if (preferences.reminderTypes.appointmentConfirmation) {
        const confirmationId = await this.createReminderSchedule({
          appointmentId,
          clinicId,
          patientId: appointment.patient.id,
          dentistId: appointment.dentist_id,
          appointmentDate,
          reminderDate: confirmationDate,
          type: ReminderType.APPOINTMENT_CONFIRMATION,
          notificationTypes: this.getEnabledNotificationTypes(preferences)
        });
        reminders.push({ id: confirmationId, type: 'confirmation', scheduledFor: confirmationDate });
      }

      logger.info('Recordatorios programados exitosamente', {
        appointmentId,
        clinicId,
        reminders: reminders.length
      });

      return {
        success: true,
        message: `${reminders.length} recordatorios programados`,
        data: {
          reminderId: reminders[0]?.id || '',
          scheduledFor: reminderDate,
          notificationTypes: this.getEnabledNotificationTypes(preferences)
        }
      };
    } catch (error) {
      logger.error('Error al programar recordatorios', { error, appointmentId });
      return {
        success: false,
        message: 'Error al programar recordatorios',
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Cancelar recordatorios de una cita
   */
  async cancelAppointmentReminders(appointmentId: string, clinicId: string): Promise<void> {
    try {
      // Cancelar recordatorios programados
      await supabaseAnon
        .from('reminder_schedules')
        .update({ status: 'CANCELLED' })
        .eq('appointment_id', appointmentId)
        .eq('clinic_id', clinicId)
        .eq('status', 'SCHEDULED');

      // Cancelar notificaciones pendientes
      await supabaseAnon
        .from('notification_requests')
        .update({ status: NotificationStatus.CANCELLED })
        .eq('metadata->appointmentId', appointmentId)
        .eq('clinic_id', clinicId)
        .eq('status', NotificationStatus.PENDING);

      logger.info('Recordatorios cancelados', { appointmentId, clinicId });
    } catch (error) {
      logger.error('Error al cancelar recordatorios', { error, appointmentId });
    }
  }

  // =================================================================
  // ENVÍO DE NOTIFICACIONES
  // =================================================================

  /**
   * Enviar notificación inmediata
   */
  async sendNotification(
    type: NotificationType,
    recipientEmail: string,
    recipientPhone: string,
    subject: string,
    body: string,
    clinicId: string,
    metadata: any = {}
  ): Promise<NotificationResponse> {
    try {
      let success = false;
      let errorMessage = '';

      switch (type) {
        case NotificationType.EMAIL:
          if (recipientEmail) {
            success = await this.emailService.sendEmail(
              recipientEmail,
              subject,
              body,
              true
            );
          }
          break;

        case NotificationType.SMS:
          if (recipientPhone) {
            success = await this.smsService.sendSMS(recipientPhone, body);
          }
          break;

        case NotificationType.PUSH:
          // TODO: Implementar notificaciones push
          logger.info('Notificación push pendiente de implementación');
          break;

        default:
          throw new Error(`Tipo de notificación no soportado: ${type}`);
      }

      // Registrar el intento de notificación
      await this.logNotificationAttempt({
        type,
        recipientEmail,
        recipientPhone,
        subject,
        body,
        success,
        errorMessage,
        clinicId,
        metadata
      });

      return {
        success,
        message: success ? 'Notificación enviada exitosamente' : 'Error al enviar notificación',
        data: success ? {
          notificationId: metadata.notificationId || '',
          status: NotificationStatus.SENT,
          sentAt: new Date()
        } : undefined,
        error: success ? undefined : errorMessage
      };
    } catch (error) {
      logger.error('Error al enviar notificación', { error, type, clinicId });
      return {
        success: false,
        message: 'Error al enviar notificación',
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Procesar recordatorios pendientes (para ejecutar en cron job)
   */
  async processScheduledReminders(): Promise<void> {
    try {
      const now = new Date();
      
      // Obtener recordatorios que deben enviarse
      const { data: reminders, error } = await supabaseAnon
        .from('reminder_schedules')
        .select(`
          *,
          appointment:appointments(
            id,
            appointment_date,
            start_time,
            treatment_type,
            notes,
            patient:patients(first_name, last_name, email, phone),
            dentist:users!dentist_id(first_name, last_name, email)
          )
        `)
        .eq('status', 'SCHEDULED')
        .lte('reminder_date', now.toISOString());

      if (error) throw error;

      logger.info(`Procesando ${reminders?.length || 0} recordatorios pendientes`);

      for (const reminder of reminders || []) {
        await this.processReminder(reminder);
      }
    } catch (error) {
      logger.error('Error al procesar recordatorios programados', { error });
    }
  }

  // =================================================================
  // GESTIÓN DE TEMPLATES
  // =================================================================

  /**
   * Renderizar template con variables
   */
  private renderTemplate(template: string, context: TemplateContext): string {
    let rendered = template;

    // Reemplazar variables del paciente
    rendered = rendered.replace(/{{patient\.firstName}}/g, context.patient.firstName);
    rendered = rendered.replace(/{{patient\.lastName}}/g, context.patient.lastName);
    rendered = rendered.replace(/{{patient\.email}}/g, context.patient.email);
    rendered = rendered.replace(/{{patient\.phone}}/g, context.patient.phone);

    // Reemplazar variables del dentista
    rendered = rendered.replace(/{{dentist\.firstName}}/g, context.dentist.firstName);
    rendered = rendered.replace(/{{dentist\.lastName}}/g, context.dentist.lastName);
    rendered = rendered.replace(/{{dentist\.title}}/g, context.dentist.title || 'Dr.');

    // Reemplazar variables de la clínica
    rendered = rendered.replace(/{{clinic\.name}}/g, context.clinic.name);
    rendered = rendered.replace(/{{clinic\.phone}}/g, context.clinic.phone);
    rendered = rendered.replace(/{{clinic\.email}}/g, context.clinic.email);
    rendered = rendered.replace(/{{clinic\.address}}/g, context.clinic.address);

    // Reemplazar variables de la cita
    rendered = rendered.replace(/{{appointment\.date}}/g, context.appointment.date);
    rendered = rendered.replace(/{{appointment\.time}}/g, context.appointment.time);
    rendered = rendered.replace(/{{appointment\.treatmentType}}/g, context.appointment.treatmentType);
    rendered = rendered.replace(/{{appointment\.notes}}/g, context.appointment.notes || '');

    return rendered;
  }

  // =================================================================
  // MÉTODOS PRIVADOS
  // =================================================================

  private async createReminderSchedule(data: Omit<ReminderSchedule, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const { data: reminder, error } = await supabaseAnon
      .from('reminder_schedules')
      .insert({
        ...data,
        status: 'SCHEDULED'
      })
      .select('id')
      .single();

    if (error) throw error;
    return reminder.id;
  }

  private async getNotificationPreferences(
    userId: string,
    clinicId: string,
    userType: 'patient' | 'user'
  ): Promise<NotificationPreferences> {
    const column = userType === 'patient' ? 'patient_id' : 'user_id';
    
    const { data, error } = await supabaseAnon
      .from('notification_preferences')
      .select('*')
      .eq(column, userId)
      .eq('clinic_id', clinicId)
      .single();

    if (error || !data) {
      // Retornar preferencias por defecto
      return {
        id: '',
        [column]: userId,
        clinicId,
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        createdAt: new Date(),
        updatedAt: new Date()
      } as NotificationPreferences;
    }

    return data;
  }

  private getEnabledNotificationTypes(preferences: NotificationPreferences): NotificationType[] {
    const types: NotificationType[] = [];
    
    if (preferences.emailEnabled) types.push(NotificationType.EMAIL);
    if (preferences.smsEnabled) types.push(NotificationType.SMS);
    if (preferences.pushEnabled) types.push(NotificationType.PUSH);
    
    return types;
  }

  private async processReminder(reminder: any): Promise<void> {
    try {
      const appointment = reminder.appointment;
      if (!appointment) return;

      // Obtener datos de la clínica
      const { data: clinic } = await supabaseAnon
        .from('clinics')
        .select('clinic_name, phone, email, street, city')
        .eq('id', reminder.clinic_id)
        .single();

      // Crear contexto para el template
      const context: TemplateContext = {
        patient: {
          firstName: appointment.patient.first_name,
          lastName: appointment.patient.last_name,
          email: appointment.patient.email,
          phone: appointment.patient.phone
        },
        dentist: {
          firstName: appointment.dentist.first_name,
          lastName: appointment.dentist.last_name,
          title: 'Dr.'
        },
        clinic: {
          name: clinic?.clinic_name || 'Clínica Dental',
          phone: clinic?.phone || '',
          email: clinic?.email || '',
          address: `${clinic?.street || ''}, ${clinic?.city || ''}`
        },
        appointment: {
          id: appointment.id,
          date: new Date(appointment.appointment_date).toLocaleDateString('es-ES'),
          time: appointment.start_time,
          duration: 60, // Por defecto
          treatmentType: appointment.treatment_type || 'Consulta',
          notes: appointment.notes
        },
        reminder: {
          type: reminder.type,
          scheduledFor: new Date(reminder.reminder_date)
        }
      };

      // Obtener template
      const template = DEFAULT_TEMPLATES[reminder.type as keyof typeof DEFAULT_TEMPLATES];
      if (!template) {
        logger.warn('Template no encontrado', { reminderType: reminder.type });
        return;
      }

      // Renderizar contenido
      const subject = this.renderTemplate(template.subject, context);
      const body = this.renderTemplate(template.body, context);

      // Enviar notificaciones según los tipos habilitados
      for (const notificationType of reminder.notification_types) {
        await this.sendNotification(
          notificationType,
          appointment.patient.email,
          appointment.patient.phone,
          subject,
          body,
          reminder.clinic_id,
          {
            appointmentId: appointment.id,
            reminderId: reminder.id,
            reminderType: reminder.type
          }
        );
      }

      // Marcar recordatorio como enviado
      await supabaseAnon
        .from('reminder_schedules')
        .update({ status: 'SENT' })
        .eq('id', reminder.id);

      logger.info('Recordatorio procesado exitosamente', {
        reminderId: reminder.id,
        appointmentId: appointment.id
      });
    } catch (error) {
      logger.error('Error al procesar recordatorio', { error, reminderId: reminder.id });
    }
  }

  private async logNotificationAttempt(data: {
    type: NotificationType;
    recipientEmail: string;
    recipientPhone: string;
    subject: string;
    body: string;
    success: boolean;
    errorMessage: string;
    clinicId: string;
    metadata: any;
  }): Promise<void> {
    try {
      await supabaseAnon
      .from('notification_requests')
      .insert({
          clinic_id: data.clinicId,
          type: data.type,
          reminder_type: data.metadata.reminderType || ReminderType.APPOINTMENT_REMINDER,
          recipient_email: data.recipientEmail,
          recipient_phone: data.recipientPhone,
          subject: data.subject,
          body: data.body,
          status: data.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
          attempts: 1,
          max_attempts: 3,
          sent_at: data.success ? new Date().toISOString() : null,
          error_message: data.errorMessage || null,
          metadata: data.metadata
        });
    } catch (error) {
      logger.error('Error al registrar intento de notificación', { error });
    }
  }
}

export const notificationService = new NotificationService();