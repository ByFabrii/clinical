import { Router, Request, Response } from 'express';
import { AppointmentController } from '../controllers/appointmentController';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../types/auth';
import { CompleteUser } from '../types/auth';

// Usamos type assertion para garantizar que user existe después del middleware authenticate

const router = Router();
const appointmentController = new AppointmentController();

// =================================================================
// DOCUMENTACIÓN SWAGGER - SCHEMAS
// =================================================================

/**
 * @swagger
 * components:
 *   schemas:
 *     Appointment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único de la cita
 *         patient_id:
 *           type: string
 *           format: uuid
 *           description: ID del paciente
 *         dentist_id:
 *           type: string
 *           format: uuid
 *           description: ID del dentista
 *         clinic_id:
 *           type: string
 *           format: uuid
 *           description: ID de la clínica
 *         appointment_date:
 *           type: string
 *           format: date
 *           description: Fecha de la cita (YYYY-MM-DD)
 *         start_time:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Hora de inicio (HH:MM)
 *         end_time:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Hora de fin (HH:MM)
 *         duration_minutes:
 *           type: integer
 *           minimum: 15
 *           maximum: 240
 *           description: Duración en minutos (múltiplo de 15)
 *         appointment_type:
 *           type: string
 *           enum: [consultation, cleaning, filling, extraction, root_canal, orthodontics, surgery, emergency, follow_up]
 *           description: Tipo de cita
 *         status:
 *           type: string
 *           enum: [scheduled, confirmed, in_progress, completed, cancelled, no_show]
 *           description: Estado de la cita
 *         reason_for_visit:
 *           type: string
 *           maxLength: 500
 *           description: Motivo de la visita
 *         notes:
 *           type: string
 *           maxLength: 1000
 *           description: Notas adicionales
 *         cancellation_reason:
 *           type: string
 *           maxLength: 500
 *           description: Razón de cancelación (si aplica)
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de última actualización
 *         patient:
 *           type: object
 *           properties:
 *             first_name:
 *               type: string
 *             last_name:
 *               type: string
 *             phone:
 *               type: string
 *             email:
 *               type: string
 *         dentist:
 *           type: object
 *           properties:
 *             first_name:
 *               type: string
 *             last_name:
 *               type: string
 *             email:
 *               type: string
 *     
 *     CreateAppointmentRequest:
 *       type: object
 *       required:
 *         - patient_id
 *         - dentist_id
 *         - appointment_date
 *         - start_time
 *         - end_time
 *         - duration_minutes
 *         - appointment_type
 *         - reason_for_visit
 *       properties:
 *         patient_id:
 *           type: string
 *           format: uuid
 *           description: ID del paciente
 *         dentist_id:
 *           type: string
 *           format: uuid
 *           description: ID del dentista
 *         appointment_date:
 *           type: string
 *           format: date
 *           description: Fecha de la cita (YYYY-MM-DD)
 *         start_time:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Hora de inicio (HH:MM)
 *         end_time:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Hora de fin (HH:MM)
 *         duration_minutes:
 *           type: integer
 *           minimum: 15
 *           maximum: 240
 *           description: Duración en minutos (múltiplo de 15)
 *         appointment_type:
 *           type: string
 *           enum: [consultation, cleaning, filling, extraction, root_canal, orthodontics, surgery, emergency, follow_up]
 *           description: Tipo de cita
 *         reason_for_visit:
 *           type: string
 *           maxLength: 500
 *           description: Motivo de la visita
 *         notes:
 *           type: string
 *           maxLength: 1000
 *           description: Notas adicionales
 *       example:
 *         patient_id: "123e4567-e89b-12d3-a456-426614174000"
 *         dentist_id: "123e4567-e89b-12d3-a456-426614174001"
 *         appointment_date: "2024-01-15"
 *         start_time: "10:00"
 *         end_time: "11:00"
 *         duration_minutes: 60
 *         appointment_type: "consultation"
 *         reason_for_visit: "Revisión general y limpieza"
 *         notes: "Paciente con sensibilidad dental"
 *     
 *     UpdateAppointmentRequest:
 *       type: object
 *       properties:
 *         appointment_date:
 *           type: string
 *           format: date
 *           description: Nueva fecha de la cita
 *         start_time:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Nueva hora de inicio
 *         end_time:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Nueva hora de fin
 *         duration_minutes:
 *           type: integer
 *           minimum: 15
 *           maximum: 240
 *           description: Nueva duración en minutos
 *         appointment_type:
 *           type: string
 *           enum: [consultation, cleaning, filling, extraction, root_canal, orthodontics, surgery, emergency, follow_up]
 *           description: Nuevo tipo de cita
 *         reason_for_visit:
 *           type: string
 *           maxLength: 500
 *           description: Nuevo motivo de la visita
 *         notes:
 *           type: string
 *           maxLength: 1000
 *           description: Nuevas notas adicionales
 *       example:
 *         appointment_date: "2024-01-16"
 *         start_time: "14:00"
 *         end_time: "15:30"
 *         duration_minutes: 90
 *         notes: "Paciente requiere más tiempo para el procedimiento"
 *     
 *     UpdateAppointmentStatusRequest:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [scheduled, confirmed, in_progress, completed, cancelled, no_show]
 *           description: Nuevo estado de la cita
 *         cancellation_reason:
 *           type: string
 *           maxLength: 500
 *           description: Razón de cancelación (requerido si status es 'cancelled')
 *       example:
 *         status: "confirmed"
 *     
 *     AppointmentStats:
 *       type: object
 *       properties:
 *         totalAppointments:
 *           type: integer
 *           description: Total de citas
 *         byStatus:
 *           type: object
 *           description: Citas agrupadas por estado
 *         byType:
 *           type: object
 *           description: Citas agrupadas por tipo
 *         todayAppointments:
 *           type: integer
 *           description: Citas de hoy
 *         upcomingAppointments:
 *           type: integer
 *           description: Citas próximas
 *     
 *     ConflictCheck:
 *       type: object
 *       properties:
 *         hasConflicts:
 *           type: boolean
 *           description: Si hay conflictos de horario
 *         conflicts:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               conflictType:
 *                 type: string
 *                 enum: [dentist_busy, patient_busy]
 *               message:
 *                 type: string
 *               conflictingAppointment:
 *                 $ref: '#/components/schemas/Appointment'
 */

// =================================================================
// RUTAS DE CITAS
// =================================================================

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Crear nueva cita
 *     description: Crea una nueva cita médica con validaciones de conflictos de horario
 *     tags: [Citas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAppointmentRequest'
 *     responses:
 *       201:
 *         description: Cita creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Appointment'
 *                 message:
 *                   type: string
 *                   example: "Cita creada exitosamente"
 *       400:
 *         description: Datos de entrada inválidos o conflicto de horario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Conflicto de horario detectado"
 *                 details:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                       message:
 *                         type: string
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.post('/', 
  authenticate, 
  authorize([UserRole.SYSTEM_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DENTIST, UserRole.ASSISTANT, UserRole.RECEPTIONIST]),
  (req: Request, res: Response) => appointmentController.createAppointment(req as any, res)
);

/**
 * @swagger
 * /api/appointments:
 *   get:
 *     summary: Obtener lista de citas
 *     description: Obtiene una lista paginada de citas con filtros opcionales
 *     tags: [Citas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Elementos por página
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio del filtro (YYYY-MM-DD)
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de fin del filtro (YYYY-MM-DD)
 *       - in: query
 *         name: patient_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID de paciente
 *       - in: query
 *         name: dentist_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID de dentista
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, confirmed, in_progress, completed, cancelled, no_show]
 *         description: Filtrar por estado
 *       - in: query
 *         name: appointment_type
 *         schema:
 *           type: string
 *           enum: [consultation, cleaning, filling, extraction, root_canal, orthodontics, surgery, emergency, follow_up]
 *         description: Filtrar por tipo de cita
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Búsqueda en motivo de visita y notas
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [created_at, appointment_date, patient_name, dentist_name]
 *           default: appointment_date
 *         description: Campo para ordenar
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Orden de clasificación
 *     responses:
 *       200:
 *         description: Lista de citas obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Appointment'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       400:
 *         description: Parámetros de consulta inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/', 
  authenticate, 
  authorize([UserRole.SYSTEM_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DENTIST, UserRole.ASSISTANT, UserRole.RECEPTIONIST, UserRole.VIEWER]),
  (req: Request, res: Response) => appointmentController.getAppointments(req as any, res)
);

/**
 * @swagger
 * /api/appointments/{id}:
 *   get:
 *     summary: Obtener cita por ID
 *     description: Obtiene los detalles completos de una cita específica
 *     tags: [Citas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID único de la cita
 *     responses:
 *       200:
 *         description: Cita encontrada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Appointment'
 *       404:
 *         description: Cita no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Cita no encontrada"
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/:id', 
  authenticate, 
  authorize([UserRole.SYSTEM_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DENTIST, UserRole.ASSISTANT, UserRole.RECEPTIONIST, UserRole.VIEWER]),
  (req: Request, res: Response) => appointmentController.getAppointmentById(req as any, res)
);

/**
 * @swagger
 * /api/appointments/{id}:
 *   put:
 *     summary: Actualizar cita
 *     description: Actualiza los datos de una cita existente con validaciones de conflictos
 *     tags: [Citas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID único de la cita
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateAppointmentRequest'
 *     responses:
 *       200:
 *         description: Cita actualizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Appointment'
 *                 message:
 *                   type: string
 *                   example: "Cita actualizada exitosamente"
 *       400:
 *         description: Datos de entrada inválidos o conflicto de horario
 *       404:
 *         description: Cita no encontrada
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.put('/:id', 
  authenticate, 
  authorize([UserRole.SYSTEM_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DENTIST, UserRole.ASSISTANT]),
  (req: Request, res: Response) => appointmentController.updateAppointment(req as any, res)
);

/**
 * @swagger
 * /api/appointments/{id}/status:
 *   patch:
 *     summary: Cambiar estado de cita
 *     description: Actualiza únicamente el estado de una cita (confirmar, cancelar, completar, etc.)
 *     tags: [Citas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID único de la cita
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateAppointmentStatusRequest'
 *     responses:
 *       200:
 *         description: Estado de cita actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Appointment'
 *                 message:
 *                   type: string
 *                   example: "Estado de cita actualizado exitosamente"
 *       400:
 *         description: Datos de entrada inválidos
 *       404:
 *         description: Cita no encontrada
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.patch('/:id/status', 
  authenticate, 
  authorize([UserRole.SYSTEM_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DENTIST, UserRole.ASSISTANT, UserRole.RECEPTIONIST]),
  (req: Request, res: Response) => appointmentController.changeAppointmentStatus(req as any, res)
);

/**
 * @swagger
 * /api/appointments/{id}:
 *   delete:
 *     summary: Eliminar cita
 *     description: Elimina una cita (soft delete - marca como cancelada)
 *     tags: [Citas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID único de la cita
 *     responses:
 *       200:
 *         description: Cita eliminada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Cita eliminada exitosamente"
 *       404:
 *         description: Cita no encontrada
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.delete('/:id', 
  authenticate, 
  authorize([UserRole.SYSTEM_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DENTIST]),
  (req: Request, res: Response) => appointmentController.deleteAppointment(req as any, res)
);

/**
 * @swagger
 * /api/appointments/stats:
 *   get:
 *     summary: Obtener estadísticas de citas
 *     description: Obtiene estadísticas generales de las citas de la clínica
 *     tags: [Citas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/AppointmentStats'
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/stats', 
  authenticate, 
  authorize([UserRole.SYSTEM_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DENTIST]),
  (req: Request, res: Response) => appointmentController.getAppointmentStats(req as any, res)
);

/**
 * @swagger
 * /api/appointments/check-conflicts:
 *   get:
 *     summary: Verificar conflictos de horario
 *     description: Verifica si existe conflicto de horario para una nueva cita
 *     tags: [Citas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de la cita (YYYY-MM-DD)
 *       - in: query
 *         name: start_time
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *         description: Hora de inicio (HH:MM)
 *       - in: query
 *         name: end_time
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *         description: Hora de fin (HH:MM)
 *       - in: query
 *         name: dentist_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del dentista
 *       - in: query
 *         name: patient_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del paciente
 *     responses:
 *       200:
 *         description: Verificación de conflictos completada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ConflictCheck'
 *       400:
 *         description: Parámetros de consulta inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/check-conflicts', 
  authenticate, 
  authorize([UserRole.SYSTEM_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DENTIST, UserRole.ASSISTANT, UserRole.RECEPTIONIST]),
  (req: Request, res: Response) => appointmentController.checkConflicts(req as any, res)
);

export default router;