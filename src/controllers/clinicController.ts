import { Request, Response } from 'express';
import { clinicService } from '../services/clinicService';
import { CreateClinicSchema, UpdateClinicSchema, ClinicFiltersSchema } from '../schemas/clinics.schemas';
import logger from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

export class ClinicController {
  /**
   * Crear una nueva clínica
   * POST /api/clinics
   */
  async createClinic(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    
    try {
      logger.info('Iniciando creación de clínica', { 
        requestId, 
        userId: req.user?.profile.id,
        body: { ...req.body, rfc: req.body.rfc ? '[REDACTED]' : undefined }
      });

      // Validar datos de entrada
      const validatedData = CreateClinicSchema.parse(req.body);
      
      // Crear clínica usando el servicio
      const newClinic = await clinicService.createClinic(validatedData, requestId);
      
      logger.info('Clínica creada exitosamente', { 
        requestId, 
        clinicId: newClinic.id,
        clinicName: newClinic.clinic_name 
      });
      
      res.status(201).json({
        success: true,
        message: 'Clínica creada exitosamente',
        data: newClinic
      });
    } catch (error: any) {
      logger.error('Error al crear clínica', { 
        requestId, 
        error: error.message,
        stack: error.stack 
      });
      
      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: error.errors
        });
        return;
      }
      
      if (error.message.includes('duplicate key')) {
        res.status(409).json({
          success: false,
          message: 'Ya existe una clínica con ese código o email'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener clínica por ID
   * GET /api/clinics/:id
   */
  async getClinicById(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'ID de clínica requerido'
      });
      return;
    }
    
    try {
      logger.info('Obteniendo clínica por ID', { requestId, clinicId: id });
      
      const clinic = await clinicService.getClinicById(id, requestId);
      
      if (!clinic) {
        res.status(404).json({
          success: false,
          message: 'Clínica no encontrada'
        });
        return;
      }
      
      res.json({
        success: true,
        data: clinic
      });
    } catch (error: any) {
      logger.error('Error al obtener clínica', { 
        requestId, 
        clinicId: id,
        error: error.message 
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Listar clínicas con filtros y paginación
   * GET /api/clinics
   */
  async listClinics(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    
    try {
      logger.info('Listando clínicas', { requestId, query: req.query });
      
      // Validar filtros
      const filters = ClinicFiltersSchema.parse(req.query);
      
      const result = await clinicService.listClinics(filters, requestId);
      
      res.json({
        success: true,
        data: result.clinics,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit)
        }
      });
    } catch (error: any) {
      logger.error('Error al listar clínicas', { 
        requestId, 
        error: error.message 
      });
      
      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          message: 'Parámetros de consulta inválidos',
          errors: error.errors
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Actualizar clínica
   * PUT /api/clinics/:id
   */
  async updateClinic(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'ID de clínica requerido'
      });
      return;
    }
    
    try {
      logger.info('Actualizando clínica', { 
        requestId, 
        clinicId: id,
        body: { ...req.body, rfc: req.body.rfc ? '[REDACTED]' : undefined }
      });
      
      // Validar datos de entrada
      const validatedData = UpdateClinicSchema.parse(req.body);
      
      const updatedClinic = await clinicService.updateClinic(id, validatedData, requestId);
      
      if (!updatedClinic) {
        res.status(404).json({
          success: false,
          message: 'Clínica no encontrada'
        });
        return;
      }
      
      logger.info('Clínica actualizada exitosamente', { 
        requestId, 
        clinicId: id 
      });
      
      res.json({
        success: true,
        message: 'Clínica actualizada exitosamente',
        data: updatedClinic
      });
    } catch (error: any) {
      logger.error('Error al actualizar clínica', { 
        requestId, 
        clinicId: id,
        error: error.message 
      });
      
      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: error.errors
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Cambiar estado de clínica (activar/desactivar)
   * PATCH /api/clinics/:id/status
   */
  async toggleClinicStatus(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    const { id } = req.params;
    const { is_active } = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'ID de clínica requerido'
      });
      return;
    }
    
    try {
      logger.info('Cambiando estado de clínica', { 
        requestId, 
        clinicId: id,
        newStatus: is_active 
      });
      
      if (typeof is_active !== 'boolean') {
        res.status(400).json({
          success: false,
          message: 'El campo is_active debe ser un booleano'
        });
        return;
      }
      
      const updatedClinic = await clinicService.toggleClinicStatus(id, is_active, requestId);
      
      if (!updatedClinic) {
        res.status(404).json({
          success: false,
          message: 'Clínica no encontrada'
        });
        return;
      }
      
      logger.info('Estado de clínica cambiado exitosamente', { 
        requestId, 
        clinicId: id,
        newStatus: is_active 
      });
      
      res.json({
        success: true,
        message: `Clínica ${is_active ? 'activada' : 'desactivada'} exitosamente`,
        data: updatedClinic
      });
    } catch (error: any) {
      logger.error('Error al cambiar estado de clínica', { 
        requestId, 
        clinicId: id,
        error: error.message 
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener estadísticas de clínica
   * GET /api/clinics/:id/stats
   */
  async getClinicStats(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'ID de clínica requerido'
      });
      return;
    }
    
    try {
      logger.info('Obteniendo estadísticas de clínica', { requestId, clinicId: id });
      
      const stats = await clinicService.getClinicStats(id, requestId);
      
      if (!stats) {
        res.status(404).json({
          success: false,
          message: 'Clínica no encontrada'
        });
        return;
      }
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      logger.error('Error al obtener estadísticas', { 
        requestId, 
        clinicId: id,
        error: error.message 
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

// Exportar instancia del controlador
export const clinicController = new ClinicController();