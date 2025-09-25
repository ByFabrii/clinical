/**
 * =================================================================
 * CONTROLADOR DE NOTAS CLÍNICAS - SISTEMA EXPEDIENTES DENTALES
 * =================================================================
 * 
 * Este controlador maneja todas las operaciones HTTP para notas clínicas,
 * garantizando el cumplimiento de las normativas mexicanas:
 * - NOM-013-SSA2-2015 (Elementos obligatorios)
 * - NOM-024-SSA3-2012 (Registro electrónico)
 * 
 * ENDPOINTS PRINCIPALES:
 * - POST   /api/clinics/:clinicId/clinical-notes
 * - GET    /api/clinics/:clinicId/clinical-notes
 * - GET    /api/clinics/:clinicId/clinical-notes/:noteId
 * - PUT    /api/clinics/:clinicId/clinical-notes/:noteId
 * - DELETE /api/clinics/:clinicId/clinical-notes/:noteId
 * - GET    /api/clinics/:clinicId/clinical-notes/stats
 * 
 * VALIDACIONES:
 * - Autenticación y autorización
 * - Validación de esquemas de datos
 * - Permisos por rol (solo dentistas)
 * - Cumplimiento normativo NOM-013
 * 
 * =================================================================
 */

import { Request, Response } from 'express';
import { clinicalNotesService } from '../services/clinicalNotesService';
import { CompleteUser } from '../types/auth';
import { 
  CreateClinicalNoteRequest,
  UpdateClinicalNoteRequest,
  ClinicalNoteFilters,
  ClinicalNoteErrorCode
} from '../types/clinical-notes';
import logger from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

// =================================================================
// INTERFACES PARA REQUESTS EXTENDIDOS
// =================================================================

/**
 * Request extendido con información del usuario autenticado
 */
interface AuthenticatedRequest extends Request {
  user?: CompleteUser;
}

// =================================================================
// CLASE PRINCIPAL DEL CONTROLADOR
// =================================================================

export class ClinicalNotesController {
  
  /**
   * Crear una nueva nota clínica
   * POST /api/clinics/:clinicId/clinical-notes
   * 
   * VALIDACIONES:
   * - Usuario autenticado y con rol de dentista
   * - Clínica válida y activa
   * - Datos de entrada válidos según esquema
   * - Cita existe y usuario tiene permisos
   */
  async createClinicalNote(req: AuthenticatedRequest, res: Response): Promise<void> {
    const requestId = uuidv4();
    
    try {
      logger.info(`[${requestId}] Iniciando creación de nota clínica`, { 
        userId: req.user?.profile.id,
        clinicId: req.params.clinicId,
        appointmentId: req.body.appointment_id
      });

      // PASO 1: Validar parámetros de ruta
      const clinicId = req.params.clinicId;
      if (!clinicId) {
        res.status(400).json({
          success: false,
          message: 'ID de clínica requerido',
          error_code: 'MISSING_CLINIC_ID'
        });
        return;
      }
      
      // PASO 2: Validar usuario autenticado
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
          error_code: 'UNAUTHENTICATED'
        });
        return;
      }
      
      const userId = req.user.profile.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
          error_code: 'UNAUTHENTICATED'
        });
        return;
      }

      // PASO 3: Validar rol de usuario (solo dentistas pueden crear notas)
      const userRole = req.user?.profile.role;
      if (!userRole || !['dentist', 'clinic_admin'].includes(userRole)) {
        logger.warn(`[${requestId}] Usuario sin permisos para crear notas clínicas`, {
          userId,
          role: userRole
        });
        res.status(403).json({
          success: false,
          message: 'Solo los dentistas pueden crear notas clínicas',
          error_code: 'INSUFFICIENT_PERMISSIONS'
        });
        return;
      }

      // PASO 4: Validar que la clínica coincide con la del usuario
      if (req.user.clinic.id !== clinicId) {
        logger.warn(`[${requestId}] Usuario intentando acceder a clínica diferente`, {
          userId,
          userClinicId: req.user.clinic.id,
          requestedClinicId: clinicId
        });
        res.status(403).json({
          success: false,
          message: 'No tiene permisos para esta clínica',
          error_code: 'CLINIC_ACCESS_DENIED'
        });
        return;
      }

      // PASO 5: Validar datos de entrada (validación básica)
      const noteData = this.validateCreateNoteData(req.body, requestId);
      
      // PASO 6: Crear nota clínica usando el servicio
      const newNote = await clinicalNotesService.createClinicalNote(
        noteData, 
        clinicId, 
        userId, 
        requestId
      );
      
      logger.info(`[${requestId}] Nota clínica creada exitosamente`, { 
        noteId: newNote.id,
        appointmentId: newNote.appointment_id,
        patientId: newNote.patient_id,
        clinicId: newNote.clinic_id
      });
      
      res.status(201).json({
        success: true,
        message: 'Nota clínica creada exitosamente',
        data: newNote
      });

    } catch (error: any) {
      logger.error(`[${requestId}] Error al crear nota clínica`, { 
        error: error.message,
        stack: error.stack,
        clinicId: req.params.clinicId,
        userId: req.user?.profile.id
      });
      
      // Manejar errores específicos del dominio
      if (error.message.includes('Ya existe una nota clínica')) {
        res.status(409).json({
          success: false,
          message: error.message,
          error_code: 'APPOINTMENT_ALREADY_HAS_NOTE'
        });
        return;
      }
      
      if (error.message.includes('No tiene permisos')) {
        res.status(403).json({
          success: false,
          message: error.message,
          error_code: 'INSUFFICIENT_PERMISSIONS'
        });
        return;
      }
      
      if (error.message.includes('Cita no encontrada')) {
        res.status(404).json({
          success: false,
          message: error.message,
          error_code: 'APPOINTMENT_NOT_FOUND'
        });
        return;
      }
      
      if (error.message.includes('obligatorio')) {
        res.status(400).json({
          success: false,
          message: error.message,
          error_code: 'MISSING_REQUIRED_FIELD'
        });
        return;
      }
      
      // Error genérico
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor al crear nota clínica',
        error_code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }

  /**
   * Obtener notas clínicas con filtros y paginación
   * GET /api/clinics/:clinicId/clinical-notes
   */
  async getClinicalNotes(req: AuthenticatedRequest, res: Response): Promise<void> {
    const requestId = uuidv4();
    
    try {
      logger.info(`[${requestId}] Consultando notas clínicas`, { 
        userId: req.user?.profile.id,
        clinicId: req.params.clinicId,
        query: req.query
      });

      // PASO 1: Validar parámetros
      const clinicId = req.params.clinicId;
      
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
          error_code: 'UNAUTHENTICATED'
        });
        return;
      }
      
      const userId = req.user.profile.id;
      
      if (!clinicId || !userId) {
        res.status(400).json({
          success: false,
          message: 'Parámetros requeridos faltantes',
          error_code: 'MISSING_PARAMETERS'
        });
        return;
      }

      // PASO 2: Validar acceso a clínica
      if (req.user.clinic.id !== clinicId) {
        res.status(403).json({
          success: false,
          message: 'No tiene permisos para esta clínica',
          error_code: 'CLINIC_ACCESS_DENIED'
        });
        return;
      }

      // PASO 3: Construir filtros desde query parameters
      const filters: ClinicalNoteFilters = {
        patient_id: req.query.patient_id as string,
        dentist_id: req.query.dentist_id as string,
        appointment_id: req.query.appointment_id as string,
        icd10_code: req.query.icd10_code as string,
        diagnosis_contains: req.query.diagnosis_contains as string,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sort_by: req.query.sort_by as 'created_at' | 'updated_at' | 'appointment_date',
        sort_order: req.query.sort_order as 'asc' | 'desc'
      };

      // PASO 5: Aplicar filtro de seguridad por rol
      const userRole = req.user.profile.role;
      if (userRole === 'dentist') {
        // Los dentistas solo ven sus propias notas
        filters.dentist_id = userId;
      }
      // Los admin y clinic_admin pueden ver todas las notas

      // PASO 5: Obtener notas del servicio
      const result = await clinicalNotesService.getClinicalNotes(
        filters, 
        clinicId, 
        requestId
      );
      
      logger.info(`[${requestId}] Notas clínicas consultadas exitosamente`, { 
        totalRecords: result.pagination.total_records,
        currentPage: result.pagination.current_page,
        clinicId
      });
      
      res.status(200).json({
        success: true,
        message: 'Notas clínicas obtenidas exitosamente',
        data: result.data,
        pagination: result.pagination,
        filters_applied: result.filters_applied
      });

    } catch (error: any) {
      logger.error(`[${requestId}] Error al consultar notas clínicas`, { 
        error: error.message,
        stack: error.stack,
        clinicId: req.params.clinicId,
        userId: req.user?.profile.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor al consultar notas clínicas',
        error_code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }

  /**
   * Obtener una nota clínica específica por ID
   * GET /api/clinics/:clinicId/clinical-notes/:noteId
   */
  async getClinicalNoteById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const requestId = uuidv4();
    
    try {
      logger.info(`[${requestId}] Consultando nota clínica por ID`, { 
        userId: req.user?.profile.id,
        clinicId: req.params.clinicId,
        noteId: req.params.noteId
      });

      // PASO 1: Validar parámetros
      const clinicId = req.params.clinicId;
      const noteId = req.params.noteId;
      
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
          error_code: 'UNAUTHENTICATED'
        });
        return;
      }
      
      const userId = req.user.profile.id;
      
      if (!clinicId || !noteId || !userId) {
        res.status(400).json({
          success: false,
          message: 'Parámetros requeridos faltantes',
          error_code: 'MISSING_PARAMETERS'
        });
        return;
      }

      // PASO 2: Validar acceso a clínica
      if (req.user.clinic.id !== clinicId) {
        res.status(403).json({
          success: false,
          message: 'No tiene permisos para esta clínica',
          error_code: 'CLINIC_ACCESS_DENIED'
        });
        return;
      }

      // PASO 3: Obtener nota del servicio
      const note = await clinicalNotesService.getClinicalNoteById(
        noteId, 
        clinicId, 
        requestId
      );

      // PASO 4: Validar permisos de acceso por rol
      const userRole = req.user.profile.role;
      if (userRole === 'dentist' && note.created_by !== userId) {
        logger.warn(`[${requestId}] Dentista intentando acceder a nota de otro dentista`, {
          userId,
          noteCreatedBy: note.created_by,
          noteId
        });
        res.status(403).json({
          success: false,
          message: 'No tiene permisos para ver esta nota clínica',
          error_code: 'INSUFFICIENT_PERMISSIONS'
        });
        return;
      }
      
      logger.info(`[${requestId}] Nota clínica obtenida exitosamente`, { 
        noteId,
        appointmentId: note.appointment_id,
        clinicId
      });
      
      res.status(200).json({
        success: true,
        message: 'Nota clínica obtenida exitosamente',
        data: note
      });

    } catch (error: any) {
      logger.error(`[${requestId}] Error al obtener nota clínica`, { 
        error: error.message,
        stack: error.stack,
        clinicId: req.params.clinicId,
        noteId: req.params.noteId,
        userId: req.user?.profile.id
      });
      
      if (error.message.includes('no encontrada')) {
        res.status(404).json({
          success: false,
          message: error.message,
          error_code: 'NOTE_NOT_FOUND'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor al obtener nota clínica',
        error_code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }

  /**
   * Actualizar una nota clínica existente
   * PUT /api/clinics/:clinicId/clinical-notes/:noteId
   */
  async updateClinicalNote(req: AuthenticatedRequest, res: Response): Promise<void> {
    const requestId = uuidv4();
    
    try {
      logger.info(`[${requestId}] Iniciando actualización de nota clínica`, { 
        userId: req.user?.profile.id,
        clinicId: req.params.clinicId,
        noteId: req.params.noteId
      });

      // PASO 1: Validar parámetros
      const clinicId = req.params.clinicId;
      const noteId = req.params.noteId;
      
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
          error_code: 'UNAUTHENTICATED'
        });
        return;
      }
      
      const userId = req.user.profile.id;
      
      if (!clinicId || !noteId || !userId) {
        res.status(400).json({
          success: false,
          message: 'Parámetros requeridos faltantes',
          error_code: 'MISSING_PARAMETERS'
        });
        return;
      }

      // PASO 2: Validar acceso a clínica
      if (req.user.clinic.id !== clinicId) {
        res.status(403).json({
          success: false,
          message: 'No tiene permisos para esta clínica',
          error_code: 'CLINIC_ACCESS_DENIED'
        });
        return;
      }

      // PASO 3: Validar rol de usuario
      const userRole = req.user.profile.role;
      if (!userRole || !['dentist', 'clinic_admin'].includes(userRole)) {
        res.status(403).json({
          success: false,
          message: 'Solo los dentistas pueden actualizar notas clínicas',
          error_code: 'INSUFFICIENT_PERMISSIONS'
        });
        return;
      }

      // PASO 4: Validar datos de entrada
      const updateData = this.validateUpdateNoteData(req.body, requestId);
      
      // PASO 5: Actualizar nota usando el servicio
      const updatedNote = await clinicalNotesService.updateClinicalNote(
        noteId,
        updateData, 
        clinicId, 
        userId, 
        requestId
      );
      
      logger.info(`[${requestId}] Nota clínica actualizada exitosamente`, { 
        noteId,
        appointmentId: updatedNote.appointment_id,
        clinicId
      });
      
      res.status(200).json({
        success: true,
        message: 'Nota clínica actualizada exitosamente',
        data: updatedNote
      });

    } catch (error: any) {
      logger.error(`[${requestId}] Error al actualizar nota clínica`, { 
        error: error.message,
        stack: error.stack,
        clinicId: req.params.clinicId,
        noteId: req.params.noteId,
        userId: req.user?.profile.id
      });
      
      if (error.message.includes('no encontrada')) {
        res.status(404).json({
          success: false,
          message: error.message,
          error_code: 'NOTE_NOT_FOUND'
        });
        return;
      }
      
      if (error.message.includes('No tiene permisos')) {
        res.status(403).json({
          success: false,
          message: error.message,
          error_code: 'INSUFFICIENT_PERMISSIONS'
        });
        return;
      }
      
      if (error.message.includes('no se puede modificar')) {
        res.status(409).json({
          success: false,
          message: error.message,
          error_code: 'NOTE_CANNOT_BE_MODIFIED'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor al actualizar nota clínica',
        error_code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }

  /**
   * Eliminar una nota clínica (soft delete)
   * DELETE /api/clinics/:clinicId/clinical-notes/:noteId
   */
  async deleteClinicalNote(req: AuthenticatedRequest, res: Response): Promise<void> {
    const requestId = uuidv4();
    
    try {
      logger.info(`[${requestId}] Iniciando eliminación de nota clínica`, { 
        userId: req.user?.profile.id,
        clinicId: req.params.clinicId,
        noteId: req.params.noteId
      });

      // Por seguridad y cumplimiento normativo, no permitimos eliminar notas clínicas
      // Solo se permite archivar
      res.status(405).json({
        success: false,
        message: 'No se permite eliminar notas clínicas por cumplimiento normativo. Use el endpoint de archivado.',
        error_code: 'METHOD_NOT_ALLOWED'
      });

    } catch (error: any) {
      logger.error(`[${requestId}] Error en deleteClinicalNote`, { 
        error: error.message,
        stack: error.stack,
        clinicId: req.params.clinicId,
        noteId: req.params.noteId,
        userId: req.user?.profile.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error_code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }

  /**
   * Obtener estadísticas de notas clínicas
   * GET /api/clinics/:clinicId/clinical-notes/stats
   */
  async getClinicalNotesStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    const requestId = uuidv4();
    
    try {
      logger.info(`[${requestId}] Consultando estadísticas de notas clínicas`, { 
        userId: req.user?.profile.id,
        clinicId: req.params.clinicId
      });

      // TODO: Implementar método de estadísticas en el servicio
      res.status(501).json({
        success: false,
        message: 'Funcionalidad de estadísticas en desarrollo',
        error_code: 'NOT_IMPLEMENTED'
      });

    } catch (error: any) {
      logger.error(`[${requestId}] Error al obtener estadísticas`, { 
        error: error.message,
        stack: error.stack,
        clinicId: req.params.clinicId,
        userId: req.user?.profile.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor al obtener estadísticas',
        error_code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }

  // =================================================================
  // MÉTODOS PRIVADOS DE VALIDACIÓN
  // =================================================================

  /**
   * Validar datos para crear nota clínica
   */
  private validateCreateNoteData(
    body: any, 
    requestId: string
  ): CreateClinicalNoteRequest {
    // Los datos ya fueron validados por el middleware de Zod
    // Solo realizamos validaciones de negocio adicionales si es necesario
    
    logger.info(`[${requestId}] Datos de nota clínica validados por esquema Zod`);
    
    return body as CreateClinicalNoteRequest;
  }

  /**
   * Validar datos para actualizar nota clínica
   */
  private validateUpdateNoteData(
    body: any, 
    requestId: string
  ): UpdateClinicalNoteRequest {
    // Los datos ya fueron validados por el middleware de Zod
    // Solo realizamos validaciones de negocio adicionales si es necesario
    
    logger.info(`[${requestId}] Datos de actualización validados por esquema Zod`);
    
    return body as UpdateClinicalNoteRequest;
  }
}

// Exportar instancia singleton
export const clinicalNotesController = new ClinicalNotesController();
export default clinicalNotesController;