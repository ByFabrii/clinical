import { Request, Response } from 'express';
import { patientService } from '../services/patientService';
import { 
  CreatePatientSchema, 
  UpdatePatientSchema, 
  PatientFiltersSchema 
} from '../schemas/patients.schemas';
import logger from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

export class PatientController {
  /**
   * Crear un nuevo paciente
   * POST /api/clinics/:clinicId/patients
   */
  async createPatient(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    
    try {
      logger.info('Iniciando creación de paciente', { 
        requestId, 
        userId: req.user?.profile.id,
        clinicId: req.params.clinicId,
        body: { 
          ...req.body, 
          curp: req.body.curp ? '[REDACTED]' : undefined,
          rfc: req.body.rfc ? '[REDACTED]' : undefined,
          email: req.body.email ? '[REDACTED]' : undefined
        }
      });

      // Validar datos de entrada
      const validatedData = CreatePatientSchema.parse(req.body);
      const clinicId = req.params.clinicId;
      
      if (!clinicId) {
        res.status(400).json({
          success: false,
          message: 'ID de clínica requerido'
        });
        return;
      }
      
      // Obtener el ID del usuario autenticado
      const createdBy = req.user?.profile.id;
      if (!createdBy) {
        res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
        return;
      }
      
      // Crear paciente usando el servicio
      const newPatient = await patientService.createPatient(validatedData, clinicId, createdBy, requestId);
      
      logger.info('Paciente creado exitosamente', { 
        requestId, 
        patientId: newPatient.id,
        patientName: `${newPatient.first_name} ${newPatient.last_name}`,
        clinicId: newPatient.clinic_id
      });
      
      res.status(201).json({
        success: true,
        message: 'Paciente creado exitosamente',
        data: newPatient
      });
    } catch (error: any) {
      logger.error('Error al crear paciente', { 
        requestId, 
        error: error.message,
        stack: error.stack,
        clinicId: req.params.clinicId
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
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener un paciente por ID
   * GET /api/clinics/:clinicId/patients/:patientId
   */
  async getPatientById(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    
    try {
      const { patientId, clinicId } = req.params;
      
      if (!patientId || !clinicId) {
        res.status(400).json({
          success: false,
          message: 'ID de paciente y clínica requeridos'
        });
        return;
      }
      
      logger.info('Obteniendo paciente por ID', { 
        requestId, 
        patientId, 
        clinicId,
        userId: req.user?.profile.id 
      });
      
      const patient = await patientService.getPatientById(patientId, clinicId, requestId);
      
      if (!patient) {
        res.status(404).json({
          success: false,
          message: 'Paciente no encontrado'
        });
        return;
      }
      
      logger.info('Paciente obtenido exitosamente', { 
        requestId, 
        patientId: patient.id,
        patientName: `${patient.first_name} ${patient.last_name}`
      });
      
      res.status(200).json({
        success: true,
        data: patient
      });
    } catch (error: any) {
      logger.error('Error al obtener paciente', { 
        requestId, 
        error: error.message,
        stack: error.stack,
        patientId: req.params.patientId,
        clinicId: req.params.clinicId
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Listar pacientes con filtros y paginación
   * GET /api/clinics/:clinicId/patients
   */
  async listPatients(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    
    try {
      const clinicId = req.params.clinicId;
      
      if (!clinicId) {
        res.status(400).json({
          success: false,
          message: 'ID de clínica requerido'
        });
        return;
      }
      
      logger.info('Listando pacientes', { 
        requestId, 
        clinicId,
        query: req.query,
        userId: req.user?.profile.id 
      });
      
      // Validar y parsear filtros
      const filters = PatientFiltersSchema.parse(req.query);
      
      const result = await patientService.listPatients(filters, clinicId, requestId);
      
      logger.info('Pacientes listados exitosamente', { 
        requestId, 
        total: result.total,
        page: result.page,
        limit: result.limit,
        clinicId
      });
      
      res.status(200).json({
        success: true,
        data: result.patients,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      });
    } catch (error: any) {
      logger.error('Error al listar pacientes', { 
        requestId, 
        error: error.message,
        stack: error.stack,
        clinicId: req.params.clinicId
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
   * Actualizar un paciente
   * PUT /api/clinics/:clinicId/patients/:patientId
   */
  async updatePatient(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    
    try {
      const { patientId, clinicId } = req.params;
      
      if (!patientId || !clinicId) {
        res.status(400).json({
          success: false,
          message: 'ID de paciente y clínica requeridos'
        });
        return;
      }
      
      logger.info('Iniciando actualización de paciente', { 
        requestId, 
        patientId, 
        clinicId,
        userId: req.user?.profile.id,
        body: { 
          ...req.body, 
          curp: req.body.curp ? '[REDACTED]' : undefined,
          rfc: req.body.rfc ? '[REDACTED]' : undefined,
          email: req.body.email ? '[REDACTED]' : undefined
        }
      });
      
      // Validar datos de entrada
      const validatedData = UpdatePatientSchema.parse(req.body);
      
      const updatedPatient = await patientService.updatePatient(patientId, validatedData, clinicId, requestId);
      
      logger.info('Paciente actualizado exitosamente', { 
        requestId, 
        patientId: updatedPatient.id,
        patientName: `${updatedPatient.first_name} ${updatedPatient.last_name}`,
        clinicId: updatedPatient.clinic_id
      });
      
      res.status(200).json({
        success: true,
        message: 'Paciente actualizado exitosamente',
        data: updatedPatient
      });
    } catch (error: any) {
      logger.error('Error al actualizar paciente', { 
        requestId, 
        error: error.message,
        stack: error.stack,
        patientId: req.params.patientId,
        clinicId: req.params.clinicId
      });
      
      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: error.errors
        });
        return;
      }
      
      if (error.message === 'Paciente no encontrado') {
        res.status(404).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  /**
   * Cambiar el estado activo/inactivo de un paciente
   * PATCH /api/clinics/:clinicId/patients/:patientId/status
   */
  async togglePatientStatus(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    
    try {
      const { patientId, clinicId } = req.params;
      const { is_active } = req.body;
      
      if (!patientId || !clinicId) {
        res.status(400).json({
          success: false,
          message: 'ID de paciente y clínica requeridos'
        });
        return;
      }
      
      logger.info('Cambiando estado de paciente', { 
        requestId, 
        patientId, 
        clinicId,
        newStatus: is_active,
        userId: req.user?.profile.id 
      });
      
      // Validar que is_active sea un booleano
      if (typeof is_active !== 'boolean') {
        res.status(400).json({
          success: false,
          message: 'El campo is_active debe ser un valor booleano'
        });
        return;
      }
      
      const updatedPatient = await patientService.togglePatientStatus(patientId, is_active, clinicId, requestId);
      
      logger.info('Estado de paciente cambiado exitosamente', { 
        requestId, 
        patientId: updatedPatient.id,
        patientName: `${updatedPatient.first_name} ${updatedPatient.last_name}`,
        newStatus: updatedPatient.is_active
      });
      
      res.status(200).json({
        success: true,
        message: `Paciente ${is_active ? 'activado' : 'desactivado'} exitosamente`,
        data: updatedPatient
      });
    } catch (error: any) {
      logger.error('Error al cambiar estado de paciente', { 
        requestId, 
        error: error.message,
        stack: error.stack,
        patientId: req.params.patientId,
        clinicId: req.params.clinicId
      });
      
      if (error.message === 'Paciente no encontrado') {
        res.status(404).json({
          success: false,
          message: error.message
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
   * Obtener estadísticas de pacientes de una clínica
   * GET /api/clinics/:clinicId/patients/stats
   */
  async getPatientStats(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    
    try {
      const clinicId = req.params.clinicId;
      
      if (!clinicId) {
        res.status(400).json({
          success: false,
          message: 'ID de clínica requerido'
        });
        return;
      }
      
      logger.info('Obteniendo estadísticas de pacientes', { 
        requestId, 
        clinicId,
        userId: req.user?.profile.id 
      });
      
      const stats = await patientService.getPatientStats(clinicId, requestId);
      
      logger.info('Estadísticas de pacientes obtenidas exitosamente', { 
        requestId, 
        clinicId,
        stats
      });
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      logger.error('Error al obtener estadísticas de pacientes', { 
        requestId, 
        error: error.message,
        stack: error.stack,
        clinicId: req.params.clinicId
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

export const patientController = new PatientController();