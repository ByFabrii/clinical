/**
 * Controlador de Citas - Sistema Dental
 * 
 * Maneja todas las operaciones HTTP relacionadas con citas:
 * - CRUD completo de citas
 * - Validaciones de entrada
 * - Manejo de errores
 * - Respuestas HTTP estandarizadas
 * - Integración con appointmentService
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import logger from '../config/logger';
import { AppointmentService } from '../services/appointmentService';
import {
  CreateAppointmentSchema,
  UpdateAppointmentSchema,
  UpdateAppointmentStatusSchema,
  AppointmentFiltersSchema
} from '../schemas/appointment.schemas';
import { CompleteUser } from '../types/auth';

// =================================================================
// INTERFACES Y TIPOS
// =================================================================

interface AuthenticatedRequest extends Request {
  user: CompleteUser;
}

interface AppointmentResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// =================================================================
// CONTROLADOR PRINCIPAL
// =================================================================

export class AppointmentController {
  private appointmentService: AppointmentService;

  constructor() {
    this.appointmentService = new AppointmentService();
  }

  // =================================================================
  // MÉTODOS CRUD
  // =================================================================

  /**
   * Crear nueva cita
   */
  async createAppointment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // 1. Validar autenticación
      if (!req.user?.clinic?.id) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado o sin clínica asignada'
        });
        return;
      }

      // 2. Validar datos de entrada
      const validatedData = CreateAppointmentSchema.parse(req.body);

      // 3. Crear cita
      const appointment = await this.appointmentService.createAppointment(
        validatedData,
        req.user.clinic.id,
        req.user.profile.id
      );

      // 4. Respuesta exitosa
      res.status(201).json({
        success: true,
        data: appointment,
        message: 'Cita creada exitosamente'
      });

      logger.info('Cita creada exitosamente', {
        appointmentId: appointment.id,
        clinicId: req.user.profile.clinic_id,
        userId: req.user.profile.id
      });

    } catch (error) {
      this.handleError(error, res, 'Error al crear cita');
    }
  }

  /**
   * Obtener cita por ID
   */
  async getAppointmentById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // 1. Validar autenticación
      if (!req.user?.profile?.clinic_id) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        });
        return;
      }

      // 2. Validar ID
      const appointmentId = req.params.id;
      if (!appointmentId) {
        res.status(400).json({
          success: false,
          error: 'ID de cita requerido'
        });
        return;
      }

      // 3. Obtener cita
      const appointment = await this.appointmentService.getAppointmentById(
        appointmentId,
        req.user.profile.clinic_id
      );

      if (!appointment) {
        res.status(404).json({
          success: false,
          error: 'Cita no encontrada'
        });
        return;
      }

      // 4. Respuesta exitosa
      res.status(200).json({
        success: true,
        data: appointment
      });

    } catch (error) {
      this.handleError(error, res, 'Error al obtener cita');
    }
  }

  /**
   * Listar citas con filtros y paginación
   */
  async getAppointments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // 1. Validar autenticación
      if (!req.user?.profile?.clinic_id) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        });
        return;
      }

      // 2. Validar y parsear filtros
      const filters = AppointmentFiltersSchema.parse(req.query);

      // 3. Obtener citas
      const result = await this.appointmentService.getAppointments(
        filters,
        req.user.profile.clinic_id
      );

      // 4. Respuesta exitosa
      res.status(200).json({
        success: true,
        data: result.appointments,
        pagination: {
          page: filters.page || 1,
          limit: filters.limit || 10,
          total: result.total,
          totalPages: Math.ceil(result.total / (filters.limit || 10))
        }
      });

    } catch (error) {
      this.handleError(error, res, 'Error al obtener citas');
    }
  }

  /**
   * Actualizar cita
   */
  async updateAppointment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // 1. Validar autenticación
      if (!req.user?.profile?.clinic_id) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        });
        return;
      }

      // 2. Validar ID
      const appointmentId = req.params.id;
      if (!appointmentId) {
        res.status(400).json({
          success: false,
          error: 'ID de cita requerido'
        });
        return;
      }

      // 3. Validar datos de entrada
      const validatedData = UpdateAppointmentSchema.parse(req.body);

      // 4. Actualizar cita
      const appointment = await this.appointmentService.updateAppointment(
        appointmentId,
        validatedData,
        req.user.profile.clinic_id,
        req.user.profile.id
      );

      if (!appointment) {
        res.status(404).json({
          success: false,
          error: 'Cita no encontrada'
        });
        return;
      }

      // 5. Respuesta exitosa
      res.status(200).json({
        success: true,
        data: appointment,
        message: 'Cita actualizada exitosamente'
      });

      logger.info('Cita actualizada exitosamente', {
        appointmentId,
        clinicId: req.user.profile.clinic_id,
        userId: req.user.profile.id
      });

    } catch (error) {
      this.handleError(error, res, 'Error al actualizar cita');
    }
  }

  /**
   * Cambiar estado de cita
   */
  async changeAppointmentStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // 1. Validar autenticación
      if (!req.user?.profile?.clinic_id) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        });
        return;
      }

      // 2. Validar ID
      const appointmentId = req.params.id;
      if (!appointmentId) {
        res.status(400).json({
          success: false,
          error: 'ID de cita requerido'
        });
        return;
      }

      // 3. Validar datos de entrada
      const validatedData = UpdateAppointmentStatusSchema.parse(req.body);

      // 4. Cambiar estado
      const appointment = await this.appointmentService.updateAppointmentStatus(
        appointmentId,
        validatedData,
        req.user.profile.clinic_id,
        req.user.profile.id
      );

      if (!appointment) {
        res.status(404).json({
          success: false,
          error: 'Cita no encontrada'
        });
        return;
      }

      // 5. Respuesta exitosa
      res.status(200).json({
        success: true,
        data: appointment,
        message: `Estado de cita cambiado a ${validatedData.status}`
      });

      logger.info('Estado de cita cambiado', {
        appointmentId,
        newStatus: validatedData.status,
        clinicId: req.user.profile.clinic_id,
        userId: req.user.profile.id
      });

    } catch (error) {
      this.handleError(error, res, 'Error al cambiar estado de cita');
    }
  }

  /**
   * Eliminar cita (soft delete)
   */
  async deleteAppointment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // 1. Validar autenticación
      if (!req.user?.profile?.clinic_id) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        });
        return;
      }

      // 2. Validar ID
      const appointmentId = req.params.id;
      if (!appointmentId) {
        res.status(400).json({
          success: false,
          error: 'ID de cita requerido'
        });
        return;
      }

      // 3. Eliminar cita
      await this.appointmentService.deleteAppointment(
        appointmentId,
        req.user.profile.clinic_id,
        req.user.profile.id
      );

      // 4. Respuesta exitosa
      res.status(200).json({
        success: true,
        message: 'Cita eliminada exitosamente'
      });

      logger.info('Cita eliminada exitosamente', {
        appointmentId,
        clinicId: req.user.profile.clinic_id,
        userId: req.user.profile.id
      });

    } catch (error) {
      this.handleError(error, res, 'Error al eliminar cita');
    }
  }

  // =================================================================
  // MÉTODOS DE ESTADÍSTICAS Y REPORTES
  // =================================================================

  /**
   * Obtener estadísticas de citas
   */
  async getAppointmentStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // 1. Validar autenticación
      if (!req.user?.profile?.clinic_id) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        });
        return;
      }

      // 2. Obtener estadísticas
      const stats = await this.appointmentService.getAppointmentStats(req.user.profile.clinic_id);

      // 3. Respuesta exitosa
      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      this.handleError(error, res, 'Error al obtener estadísticas');
    }
  }

  /**
   * Verificar conflictos de horario
   */
  async checkConflicts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // 1. Validar autenticación
      if (!req.user?.profile?.clinic_id) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        });
        return;
      }

      // 2. Validar parámetros
      const { date, start_time, end_time, dentist_id, patient_id } = req.query;
      
      if (!date || !start_time || !end_time || !dentist_id || !patient_id) {
        res.status(400).json({
          success: false,
          error: 'Parámetros requeridos: date, start_time, end_time, dentist_id, patient_id'
        });
        return;
      }

      // 3. Verificar conflictos
      const conflicts = await this.appointmentService.checkTimeConflicts(
        date as string,
        start_time as string,
        end_time as string,
        dentist_id as string,
        patient_id as string,
        req.user.profile.clinic_id
      );

      // 4. Respuesta exitosa
      res.status(200).json({
        success: true,
        data: {
          hasConflicts: conflicts.length > 0,
          conflicts
        }
      });

    } catch (error) {
      this.handleError(error, res, 'Error al verificar conflictos');
    }
  }

  // =================================================================
  // MÉTODOS DE UTILIDAD
  // =================================================================

  /**
   * Manejo centralizado de errores
   */
  private handleError(error: any, res: Response, defaultMessage: string): void {
    logger.error(defaultMessage, {
      error: error.message,
      stack: error.stack
    });

    // Error de validación Zod
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        details: error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
      return;
    }

    // Error de negocio (conflictos, etc.)
    if (error.message.includes('Conflicto') || 
        error.message.includes('No se puede') ||
        error.message.includes('Horario no válido')) {
      res.status(409).json({
        success: false,
        error: error.message
      });
      return;
    }

    // Error de base de datos
    if (error.code) {
      res.status(500).json({
        success: false,
        error: 'Error de base de datos',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
      return;
    }

    // Error genérico
    res.status(500).json({
      success: false,
      error: defaultMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// =================================================================
// INSTANCIA Y EXPORTACIÓN
// =================================================================

const appointmentController = new AppointmentController();

// Exportar métodos como funciones para usar en rutas
export const createAppointment = appointmentController.createAppointment.bind(appointmentController);
export const getAppointmentById = appointmentController.getAppointmentById.bind(appointmentController);
export const getAppointments = appointmentController.getAppointments.bind(appointmentController);
export const updateAppointment = appointmentController.updateAppointment.bind(appointmentController);
export const changeAppointmentStatus = appointmentController.changeAppointmentStatus.bind(appointmentController);
export const deleteAppointment = appointmentController.deleteAppointment.bind(appointmentController);
export const getAppointmentStats = appointmentController.getAppointmentStats.bind(appointmentController);
export const checkConflicts = appointmentController.checkConflicts.bind(appointmentController);

export default appointmentController;