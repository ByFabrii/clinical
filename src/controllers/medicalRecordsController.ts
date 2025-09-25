/**
 * =================================================================
 * CONTROLADOR DE EXPEDIENTES MÉDICOS - SISTEMA EXPEDIENTES DENTALES
 * =================================================================
 * 
 * Este controlador maneja todas las operaciones HTTP para expedientes médicos,
 * garantizando el cumplimiento de las normativas mexicanas:
 * - NOM-013-SSA2-2015 (Elementos obligatorios del expediente)
 * - NOM-024-SSA3-2012 (Registro electrónico)
 * - NOM-004-SSA3-2012 (Expediente clínico)
 * 
 * ENDPOINTS PRINCIPALES:
 * - POST   /api/clinics/:clinicId/medical-records
 * - GET    /api/clinics/:clinicId/medical-records
 * - GET    /api/clinics/:clinicId/medical-records/:recordId
 * - PUT    /api/clinics/:clinicId/medical-records/:recordId
 * - DELETE /api/clinics/:clinicId/medical-records/:recordId
 * - GET    /api/clinics/:clinicId/medical-records/stats
 * - GET    /api/clinics/:clinicId/medical-records/patient/:patientId
 * - POST   /api/clinics/:clinicId/medical-records/:recordId/validate
 * 
 * VALIDACIONES:
 * - Autenticación y autorización
 * - Validación de esquemas de datos
 * - Permisos por rol (personal médico autorizado)
 * - Cumplimiento normativo NOM-013
 * - Integridad de datos médicos
 * 
 * =================================================================
 */

import { Request, Response } from 'express';
import { MedicalRecordsService } from '../services/medicalRecordsService';
import { CompleteUser } from '../types/auth';
import { 
  CreateMedicalRecordData,
  UpdateMedicalRecordData,
  MedicalRecordFilters,
  MedicalRecordNotFoundError,
  MedicalRecordAlreadyExistsError,
  InvalidMedicalRecordDataError
} from '../types/medical-records';
import {
  createMedicalRecordSchema,
  updateMedicalRecordSchema,
  medicalRecordFiltersSchema,
  paginationSchema,
  medicalRecordIdSchema,
  patientIdSchema
} from '../schemas/medical-records';
import logger from '../config/logger';
import { z } from 'zod';

// =================================================================
// INTERFACES PARA REQUESTS EXTENDIDOS
// =================================================================

/**
 * Request extendido con información del usuario autenticado
 */
interface AuthenticatedRequest extends Request {
  user?: CompleteUser;
}

/**
 * Parámetros de ruta para expedientes médicos
 */
interface MedicalRecordParams {
  clinicId: string;
  recordId?: string;
  patientId?: string;
}

// =================================================================
// UTILIDADES PRIVADAS
// =================================================================

/**
 * Maneja errores específicos de expedientes médicos
 */
function handleMedicalRecordError(error: any, res: Response): Response {
  if (error instanceof MedicalRecordNotFoundError) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'MEDICAL_RECORD_NOT_FOUND',
        message: error.message
      }
    });
  }

  if (error instanceof MedicalRecordAlreadyExistsError) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'MEDICAL_RECORD_ALREADY_EXISTS',
        message: error.message
      }
    });
  }

  if (error instanceof InvalidMedicalRecordDataError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_MEDICAL_RECORD_DATA',
        message: error.message
      }
    });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos de entrada inválidos',
        details: error.issues
      }
    });
  }

  logger.error('Error no manejado en controlador de expedientes médicos:', error);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Error interno del servidor'
    }
  });
}

/**
 * Valida permisos de usuario para operaciones de expedientes médicos
 */
function validateUserPermissions(user: CompleteUser, operation: string): boolean {
  // Solo personal médico puede manejar expedientes médicos
  const allowedRoles = ['dentist', 'clinic_admin', 'assistant'];
  
  if (!allowedRoles.includes(user.profile.role)) {
    return false;
  }

  // Operaciones específicas por rol
  switch (operation) {
    case 'CREATE':
    case 'UPDATE':
    case 'DELETE':
      return ['dentist', 'clinic_admin'].includes(user.profile.role);
    case 'READ':
      return true; // Todos los roles permitidos pueden leer
    default:
      return false;
  }
}

// =================================================================
// CONTROLADOR PRINCIPAL
// =================================================================

export class MedicalRecordsController {
  /**
   * Crear un nuevo expediente médico
   * POST /api/clinics/:clinicId/medical-records
   */
  static async createMedicalRecord(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { clinicId } = req.params;
      const user = req.user!;

      logger.info('Iniciando creación de expediente médico', {
        clinicId,
        userId: user.profile.id,
        userRole: user.profile.role
      });

      // Validar permisos
      if (!validateUserPermissions(user, 'CREATE')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'No tiene permisos para crear expedientes médicos'
          }
        });
      }

      // Validar datos de entrada
      const validatedData = createMedicalRecordSchema.parse(req.body);

      // Crear expediente médico
      const medicalRecord = await MedicalRecordsService.createMedicalRecord(
        validatedData,
        user.profile.id
      );

      logger.info('Expediente médico creado exitosamente', {
        recordId: medicalRecord.id,
        recordNumber: medicalRecord.record_number,
        patientId: medicalRecord.patient_id
      });

      return res.status(201).json({
        success: true,
        data: medicalRecord,
        message: 'Expediente médico creado exitosamente'
      });

    } catch (error) {
      logger.error('Error en createMedicalRecord:', error);
      return handleMedicalRecordError(error, res);
    }
  }

  /**
   * Obtener expedientes médicos con filtros y paginación
   * GET /api/clinics/:clinicId/medical-records
   */
  static async getMedicalRecords(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { clinicId } = req.params;
      const user = req.user!;

      // Validar permisos
      if (!validateUserPermissions(user, 'READ')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'No tiene permisos para consultar expedientes médicos'
          }
        });
      }

      // Validar parámetros de consulta
      const paginationParams = paginationSchema.parse(req.query);
      const filters = medicalRecordFiltersSchema.parse(req.query);

      // Obtener expedientes médicos
      const result = await MedicalRecordsService.getMedicalRecords(
        filters,
        paginationParams.page,
        paginationParams.limit,
        paginationParams.sort_by,
        paginationParams.sort_order
      );

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      });

    } catch (error) {
      logger.error('Error en getMedicalRecords:', error);
      return handleMedicalRecordError(error, res);
    }
  }

  /**
   * Obtener expediente médico por ID
   * GET /api/clinics/:clinicId/medical-records/:recordId
   */
  static async getMedicalRecordById(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { clinicId, recordId } = req.params;
      const user = req.user!;

      // Validar permisos
      if (!validateUserPermissions(user, 'READ')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'No tiene permisos para consultar expedientes médicos'
          }
        });
      }

      // Validar parámetros
      const { id } = medicalRecordIdSchema.parse({ id: recordId });

      // Obtener expediente médico
      const medicalRecord = await MedicalRecordsService.getMedicalRecordById(id);

      return res.status(200).json({
        success: true,
        data: medicalRecord
      });

    } catch (error) {
      logger.error('Error en getMedicalRecordById:', error);
      return handleMedicalRecordError(error, res);
    }
  }

  /**
   * Obtener expediente médico por ID de paciente
   * GET /api/clinics/:clinicId/medical-records/patient/:patientId
   */
  static async getMedicalRecordByPatientId(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { clinicId, patientId } = req.params;
      const user = req.user!;

      // Validar permisos
      if (!validateUserPermissions(user, 'READ')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'No tiene permisos para consultar expedientes médicos'
          }
        });
      }

      // Validar parámetros
      const { patient_id } = patientIdSchema.parse({ patient_id: patientId });

      // Obtener expediente médico
      const medicalRecord = await MedicalRecordsService.getMedicalRecordByPatientId(patient_id);

      if (!medicalRecord) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'MEDICAL_RECORD_NOT_FOUND',
            message: 'No se encontró expediente médico activo para este paciente'
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: medicalRecord
      });

    } catch (error) {
      logger.error('Error en getMedicalRecordByPatientId:', error);
      return handleMedicalRecordError(error, res);
    }
  }

  /**
   * Actualizar expediente médico
   * PUT /api/clinics/:clinicId/medical-records/:recordId
   */
  static async updateMedicalRecord(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { clinicId, recordId } = req.params;
      const user = req.user!;

      logger.info('Iniciando actualización de expediente médico', {
        clinicId,
        recordId,
        userId: user.profile.id,
        userRole: user.profile.role
      });

      // Validar permisos
      if (!validateUserPermissions(user, 'UPDATE')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'No tiene permisos para actualizar expedientes médicos'
          }
        });
      }

      // Validar parámetros y datos
      const { id } = medicalRecordIdSchema.parse({ id: recordId });
      const validatedData = updateMedicalRecordSchema.parse(req.body);

      // Actualizar expediente médico
      const medicalRecord = await MedicalRecordsService.updateMedicalRecord(
        id,
        validatedData,
        user.profile.id
      );

      logger.info('Expediente médico actualizado exitosamente', {
        recordId: medicalRecord.id,
        recordNumber: medicalRecord.record_number
      });

      return res.status(200).json({
        success: true,
        data: medicalRecord,
        message: 'Expediente médico actualizado exitosamente'
      });

    } catch (error) {
      logger.error('Error en updateMedicalRecord:', error);
      return handleMedicalRecordError(error, res);
    }
  }

  /**
   * Eliminar expediente médico (soft delete)
   * DELETE /api/clinics/:clinicId/medical-records/:recordId
   */
  static async deleteMedicalRecord(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { clinicId, recordId } = req.params;
      const user = req.user!;

      logger.info('Iniciando eliminación de expediente médico', {
        clinicId,
        recordId,
        userId: user.profile.id,
        userRole: user.profile.role
      });

      // Validar permisos
      if (!validateUserPermissions(user, 'DELETE')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'No tiene permisos para eliminar expedientes médicos'
          }
        });
      }

      // Validar parámetros
      const { id } = medicalRecordIdSchema.parse({ id: recordId });

      // Eliminar expediente médico (soft delete)
      await MedicalRecordsService.deleteMedicalRecord(id, user.profile.id);

      logger.info('Expediente médico eliminado exitosamente', { recordId: id });

      return res.status(200).json({
        success: true,
        message: 'Expediente médico archivado exitosamente'
      });

    } catch (error) {
      logger.error('Error en deleteMedicalRecord:', error);
      return handleMedicalRecordError(error, res);
    }
  }

  /**
   * Obtener estadísticas de expedientes médicos
   * GET /api/clinics/:clinicId/medical-records/stats
   */
  static async getMedicalRecordsStats(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { clinicId } = req.params;
      const user = req.user!;

      // Validar permisos
      if (!validateUserPermissions(user, 'READ')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'No tiene permisos para consultar estadísticas'
          }
        });
      }

      // Obtener estadísticas
      const stats = await MedicalRecordsService.getMedicalRecordsStats();

      return res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error en getMedicalRecordsStats:', error);
      return handleMedicalRecordError(error, res);
    }
  }

  /**
   * Validar integridad del expediente médico
   * POST /api/clinics/:clinicId/medical-records/:recordId/validate
   */
  static async validateMedicalRecord(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { clinicId, recordId } = req.params;
      const user = req.user!;

      logger.info('Iniciando validación de expediente médico', {
        clinicId,
        recordId,
        userId: user.profile.id
      });

      // Validar permisos
      if (!validateUserPermissions(user, 'READ')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'No tiene permisos para validar expedientes médicos'
          }
        });
      }

      // Validar parámetros
      const { id } = medicalRecordIdSchema.parse({ id: recordId });

      // Validar integridad del expediente
      const validation = await MedicalRecordsService.validateMedicalRecordIntegrity(id);

      return res.status(200).json({
        success: true,
        data: validation,
        message: validation.isValid 
          ? 'Expediente médico válido' 
          : 'Se encontraron problemas en el expediente médico'
      });

    } catch (error) {
      logger.error('Error en validateMedicalRecord:', error);
      return handleMedicalRecordError(error, res);
    }
  }
}

export default MedicalRecordsController;