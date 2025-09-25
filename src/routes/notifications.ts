// =================================================================
// RUTAS DE NOTIFICACIONES
// Sistema de Expedientes Clínicos Dentales
// =================================================================

import { Router, Request, Response } from 'express';
import { notificationController } from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';
import { validateSchema as validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';
import { NotificationType, ReminderType } from '../types/notifications';

const router = Router();

// =================================================================
// SCHEMAS DE VALIDACIÓN
// =================================================================

const scheduleReminderSchema = z.object({
  body: z.object({
    reminderDate: z.string().datetime().optional(),
    notificationTypes: z.array(z.nativeEnum(NotificationType)).optional()
  })
});

const sendNotificationSchema = z.object({
  body: z.object({
    type: z.nativeEnum(NotificationType),
    recipientEmail: z.string().email().optional(),
    recipientPhone: z.string().optional(),
    subject: z.string().min(1, 'El asunto es requerido'),
    body: z.string().min(1, 'El cuerpo del mensaje es requerido'),
    metadata: z.record(z.string(), z.any()).optional()
  }).refine(
    (data) => data.recipientEmail || data.recipientPhone,
    {
      message: 'Se requiere al menos un email o teléfono del destinatario',
      path: ['recipientEmail']
    }
  )
});

const notificationHistorySchema = z.object({
  query: z.object({
    type: z.nativeEnum(NotificationType).optional(),
    status: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    offset: z.string().regex(/^\d+$/).transform(Number).optional()
  })
});

const updatePreferencesSchema = z.object({
  body: z.object({
    email_enabled: z.boolean().optional(),
    sms_enabled: z.boolean().optional(),
    push_enabled: z.boolean().optional(),
    reminder_24h_enabled: z.boolean().optional(),
    reminder_2h_enabled: z.boolean().optional(),
    reminder_30min_enabled: z.boolean().optional(),
    appointment_confirmations: z.boolean().optional(),
    appointment_reminders: z.boolean().optional(),
    appointment_cancellations: z.boolean().optional(),
    treatment_updates: z.boolean().optional(),
    marketing_communications: z.boolean().optional(),
    preferred_time_start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    preferred_time_end: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    timezone: z.string().optional()
  })
});

const statsQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  })
});

// =================================================================
// RUTAS DE RECORDATORIOS
// =================================================================

/**
 * @swagger
 * /api/notifications/reminders/{appointmentId}/schedule:
 *   post:
 *     summary: Programar recordatorio para una cita
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la cita
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reminderDate:
 *                 type: string
 *                 format: date-time
 *                 description: Fecha específica para el recordatorio (opcional)
 *               notificationTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [EMAIL, SMS, PUSH]
 *                 description: Tipos de notificación a enviar
 *     responses:
 *       200:
 *         description: Recordatorio programado exitosamente
 *       404:
 *         description: Cita no encontrada
 *       400:
 *         description: Error en los datos enviados
 */
router.post(
  '/reminders/:appointmentId/schedule',
  authenticate,
  validateRequest(scheduleReminderSchema),
  (req: Request, res: Response) => notificationController.scheduleReminder(req, res)
);

/**
 * @swagger
 * /api/notifications/reminders/{appointmentId}/cancel:
 *   delete:
 *     summary: Cancelar recordatorios de una cita
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la cita
 *     responses:
 *       200:
 *         description: Recordatorios cancelados exitosamente
 *       500:
 *         description: Error interno del servidor
 */
router.delete(
  '/reminders/:appointmentId/cancel',
  authenticate,
  (req: Request, res: Response) => notificationController.cancelReminders(req, res)
);

/**
 * @swagger
 * /api/notifications/reminders/scheduled:
 *   get:
 *     summary: Obtener recordatorios programados
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SCHEDULED, SENT, FAILED, CANCELLED]
 *           default: SCHEDULED
 *         description: Estado de los recordatorios
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Número máximo de resultados
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Número de resultados a omitir
 *     responses:
 *       200:
 *         description: Lista de recordatorios programados
 *       500:
 *         description: Error interno del servidor
 */
router.get(
  '/reminders/scheduled',
  authenticate,
  (req: Request, res: Response) => notificationController.getScheduledReminders(req, res)
);

// =================================================================
// RUTAS DE NOTIFICACIONES
// =================================================================

/**
 * @swagger
 * /api/notifications/send:
 *   post:
 *     summary: Enviar notificación inmediata
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - subject
 *               - body
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [EMAIL, SMS, PUSH]
 *                 description: Tipo de notificación
 *               recipientEmail:
 *                 type: string
 *                 format: email
 *                 description: Email del destinatario
 *               recipientPhone:
 *                 type: string
 *                 description: Teléfono del destinatario
 *               subject:
 *                 type: string
 *                 description: Asunto de la notificación
 *               body:
 *                 type: string
 *                 description: Cuerpo del mensaje
 *               metadata:
 *                 type: object
 *                 description: Metadatos adicionales
 *     responses:
 *       200:
 *         description: Notificación enviada exitosamente
 *       400:
 *         description: Error en los datos enviados
 */
router.post(
  '/send',
  authenticate,
  validateRequest(sendNotificationSchema),
  (req: Request, res: Response) => notificationController.sendNotification(req, res)
);

/**
 * @swagger
 * /api/notifications/history:
 *   get:
 *     summary: Obtener historial de notificaciones
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [EMAIL, SMS, PUSH]
 *         description: Filtrar por tipo de notificación
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, SENT, FAILED]
 *         description: Filtrar por estado
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fecha de inicio del filtro
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fecha de fin del filtro
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Número máximo de resultados
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Número de resultados a omitir
 *     responses:
 *       200:
 *         description: Historial de notificaciones
 *       500:
 *         description: Error interno del servidor
 */
router.get(
  '/history',
  authenticate,
  validateRequest(notificationHistorySchema),
  (req: Request, res: Response) => notificationController.getNotificationHistory(req, res)
);

// =================================================================
// RUTAS DE PREFERENCIAS
// =================================================================

/**
 * @swagger
 * /api/notifications/preferences/{patientId}:
 *   get:
 *     summary: Obtener preferencias de notificación de un paciente
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del paciente
 *     responses:
 *       200:
 *         description: Preferencias de notificación del paciente
 *       404:
 *         description: Paciente no encontrado
 */
router.get(
  '/preferences/:patientId',
  authenticate,
  (req: Request, res: Response) => notificationController.getPatientPreferences(req, res)
);

/**
 * @swagger
 * /api/notifications/preferences/{patientId}:
 *   put:
 *     summary: Actualizar preferencias de notificación de un paciente
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del paciente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email_enabled:
 *                 type: boolean
 *                 description: Habilitar notificaciones por email
 *               sms_enabled:
 *                 type: boolean
 *                 description: Habilitar notificaciones por SMS
 *               push_enabled:
 *                 type: boolean
 *                 description: Habilitar notificaciones push
 *               reminder_24h_enabled:
 *                 type: boolean
 *                 description: Recordatorio 24 horas antes
 *               reminder_2h_enabled:
 *                 type: boolean
 *                 description: Recordatorio 2 horas antes
 *               reminder_30min_enabled:
 *                 type: boolean
 *                 description: Recordatorio 30 minutos antes
 *               appointment_confirmations:
 *                 type: boolean
 *                 description: Confirmaciones de citas
 *               appointment_reminders:
 *                 type: boolean
 *                 description: Recordatorios de citas
 *               appointment_cancellations:
 *                 type: boolean
 *                 description: Notificaciones de cancelaciones
 *               treatment_updates:
 *                 type: boolean
 *                 description: Actualizaciones de tratamiento
 *               marketing_communications:
 *                 type: boolean
 *                 description: Comunicaciones de marketing
 *               preferred_time_start:
 *                 type: string
 *                 pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 description: Hora de inicio preferida (HH:MM)
 *               preferred_time_end:
 *                 type: string
 *                 pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 description: Hora de fin preferida (HH:MM)
 *               timezone:
 *                 type: string
 *                 description: Zona horaria del paciente
 *     responses:
 *       200:
 *         description: Preferencias actualizadas exitosamente
 *       404:
 *         description: Paciente no encontrado
 */
router.put(
  '/preferences/:patientId',
  authenticate,
  validateRequest(updatePreferencesSchema),
  (req: Request, res: Response) => notificationController.updatePatientPreferences(req, res)
);

// =================================================================
// RUTAS DE ESTADO Y ESTADÍSTICAS
// =================================================================

/**
 * @swagger
 * /api/notifications/status:
 *   get:
 *     summary: Verificar estado de los servicios de notificación
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado de los servicios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: object
 *                       properties:
 *                         isHealthy:
 *                           type: boolean
 *                         message:
 *                           type: string
 *                     sms:
 *                       type: object
 *                       properties:
 *                         isHealthy:
 *                           type: boolean
 *                         message:
 *                           type: string
 *                     overall:
 *                       type: boolean
 */
router.get(
  '/status',
  authenticate,
  (req: Request, res: Response) => notificationController.getServiceStatus(req, res)
);

/**
 * @swagger
 * /api/notifications/stats:
 *   get:
 *     summary: Obtener estadísticas de notificaciones
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fecha de inicio del período
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fecha de fin del período
 *     responses:
 *       200:
 *         description: Estadísticas de notificaciones
 *       500:
 *         description: Error interno del servidor
 */
router.get(
  '/stats',
  authenticate,
  validateRequest(statsQuerySchema),
  (req: Request, res: Response) => notificationController.getNotificationStats(req, res)
);

// =================================================================
// RUTAS INTERNAS (CRON JOBS)
// =================================================================

/**
 * @swagger
 * /api/notifications/process-reminders:
 *   post:
 *     summary: Procesar recordatorios programados (solo para cron jobs)
 *     tags: [Notifications]
 *     security:
 *       - cronSecret: []
 *     responses:
 *       200:
 *         description: Recordatorios procesados exitosamente
 *       401:
 *         description: No autorizado
 */
router.post(
  '/process-reminders',
  (req: Request, res: Response) => notificationController.processScheduledReminders(req, res)
);

export default router;