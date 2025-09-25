/**
 * =================================================================
 * RUTAS DE EXPEDIENTES MÉDICOS - SISTEMA EXPEDIENTES DENTALES
 * =================================================================
 * 
 * Este archivo define todas las rutas HTTP para el módulo de expedientes médicos,
 * garantizando el cumplimiento de las normativas mexicanas:
 * - NOM-013-SSA2-2015 (Elementos obligatorios del expediente)
 * - NOM-024-SSA3-2012 (Registro electrónico)
 * - NOM-004-SSA3-2012 (Expediente clínico)
 * 
 * ENDPOINTS DISPONIBLES:
 * - POST   /api/clinics/:clinicId/medical-records
 * - GET    /api/clinics/:clinicId/medical-records
 * - GET    /api/clinics/:clinicId/medical-records/:recordId
 * - PUT    /api/clinics/:clinicId/medical-records/:recordId
 * - DELETE /api/clinics/:clinicId/medical-records/:recordId
 * - GET    /api/clinics/:clinicId/medical-records/stats
 * - GET    /api/clinics/:clinicId/medical-records/patient/:patientId
 * - POST   /api/clinics/:clinicId/medical-records/:recordId/validate
 * 
 * MIDDLEWARE APLICADO:
 * - Rate limiting (general y estricto)
 * - Autenticación JWT
 * - Autorización por roles
 * - Validación de esquemas
 * - Logging y auditoría
 * - Validación de permisos médicos
 * 
 * =================================================================
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { MedicalRecordsController } from '../controllers/medicalRecordsController';
import { authenticate } from '../middleware/auth';
import { validateSchema } from '../middleware/validation.middleware';
import { 
  createMedicalRecordSchema,
  updateMedicalRecordSchema,
  medicalRecordFiltersSchema,
  paginationSchema,
  medicalRecordIdSchema,
  patientIdSchema
} from '../schemas/medical-records';
import logger from '../config/logger';

/**
 * @swagger
 * components:
 *   schemas:
 *     MedicalRecord:
 *       type: object
 *       required:
 *         - patientId
 *         - clinicId
 *         - recordNumber
 *         - recordType
 *         - status
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único del expediente médico
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         patientId:
 *           type: string
 *           format: uuid
 *           description: ID del paciente
 *           example: "123e4567-e89b-12d3-a456-426614174001"
 *         clinicId:
 *           type: string
 *           format: uuid
 *           description: ID de la clínica
 *           example: "123e4567-e89b-12d3-a456-426614174002"
 *         recordNumber:
 *           type: string
 *           description: Número único del expediente
 *           example: "EXP-2024-001"
 *         recordType:
 *           type: string
 *           enum: [GENERAL, ORTHODONTICS, SURGERY, PEDIATRIC, PERIODONTICS, ENDODONTICS]
 *           description: Tipo de expediente médico
 *           example: "GENERAL"
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, ARCHIVED, COMPLETED]
 *           description: Estado del expediente
 *           example: "ACTIVE"
 *         chiefComplaint:
 *           type: string
 *           description: Motivo principal de consulta
 *           example: "Dolor en muela del juicio"
 *         medicalHistory:
 *           type: object
 *           description: Historia médica del paciente
 *           properties:
 *             allergies:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["Penicilina", "Látex"]
 *             medications:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["Ibuprofeno 400mg"]
 *             conditions:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["Diabetes tipo 2", "Hipertensión"]
 *         dentalHistory:
 *           type: object
 *           description: Historia dental específica
 *           properties:
 *             previousTreatments:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["Limpieza dental", "Empaste"]
 *             oralHygiene:
 *               type: string
 *               enum: [EXCELLENT, GOOD, FAIR, POOR]
 *               example: "GOOD"
 *         clinicalFindings:
 *           type: object
 *           description: Hallazgos clínicos
 *           properties:
 *             extraoral:
 *               type: string
 *               example: "Sin alteraciones aparentes"
 *             intraoral:
 *               type: string
 *               example: "Caries en pieza 18"
 *             periodontal:
 *               type: string
 *               example: "Gingivitis leve"
 *         diagnosis:
 *           type: object
 *           description: Diagnóstico
 *           properties:
 *             primary:
 *               type: string
 *               example: "Caries dental"
 *             secondary:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["Gingivitis"]
 *         treatmentPlan:
 *           type: object
 *           description: Plan de tratamiento
 *           properties:
 *             procedures:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   tooth:
 *                     type: string
 *                   priority:
 *                     type: string
 *                     enum: [HIGH, MEDIUM, LOW]
 *               example:
 *                 - name: "Endodoncia"
 *                   tooth: "18"
 *                   priority: "HIGH"
 *             estimatedCost:
 *               type: number
 *               example: 2500.00
 *             estimatedDuration:
 *               type: string
 *               example: "2 semanas"
 *         vitalSigns:
 *           type: object
 *           description: Signos vitales
 *           properties:
 *             bloodPressure:
 *               type: string
 *               example: "120/80"
 *             heartRate:
 *               type: number
 *               example: 72
 *             temperature:
 *               type: number
 *               example: 36.5
 *         notes:
 *           type: string
 *           description: Notas adicionales
 *           example: "Paciente colaborador, seguir con tratamiento"
 *         attachments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *               url:
 *                 type: string
 *           example:
 *             - id: "att-001"
 *               name: "radiografia.jpg"
 *               type: "image/jpeg"
 *               url: "/uploads/radiografia.jpg"
 *         createdBy:
 *           type: string
 *           format: uuid
 *           description: ID del usuario que creó el expediente
 *           example: "123e4567-e89b-12d3-a456-426614174003"
 *         lastModifiedBy:
 *           type: string
 *           format: uuid
 *           description: ID del último usuario que modificó el expediente
 *           example: "123e4567-e89b-12d3-a456-426614174003"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación
 *           example: "2024-01-15T10:30:00Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Fecha de última actualización
 *           example: "2024-01-15T14:30:00Z"
 *         version:
 *           type: number
 *           description: Versión del expediente para control de cambios
 *           example: 1
 *         isArchived:
 *           type: boolean
 *           description: Indica si el expediente está archivado
 *           example: false
 *
 *     CreateMedicalRecordRequest:
 *       type: object
 *       required:
 *         - patientId
 *         - recordType
 *         - chiefComplaint
 *       properties:
 *         patientId:
 *           type: string
 *           format: uuid
 *           description: ID del paciente
 *           example: "123e4567-e89b-12d3-a456-426614174001"
 *         recordType:
 *           type: string
 *           enum: [GENERAL, ORTHODONTICS, SURGERY, PEDIATRIC, PERIODONTICS, ENDODONTICS]
 *           description: Tipo de expediente médico
 *           example: "GENERAL"
 *         chiefComplaint:
 *           type: string
 *           description: Motivo principal de consulta
 *           example: "Dolor en muela del juicio"
 *         medicalHistory:
 *           $ref: '#/components/schemas/MedicalRecord/properties/medicalHistory'
 *         dentalHistory:
 *           $ref: '#/components/schemas/MedicalRecord/properties/dentalHistory'
 *         clinicalFindings:
 *           $ref: '#/components/schemas/MedicalRecord/properties/clinicalFindings'
 *         diagnosis:
 *           $ref: '#/components/schemas/MedicalRecord/properties/diagnosis'
 *         treatmentPlan:
 *           $ref: '#/components/schemas/MedicalRecord/properties/treatmentPlan'
 *         vitalSigns:
 *           $ref: '#/components/schemas/MedicalRecord/properties/vitalSigns'
 *         notes:
 *           type: string
 *           description: Notas adicionales
 *           example: "Paciente colaborador"
 *
 *     UpdateMedicalRecordRequest:
 *       type: object
 *       properties:
 *         recordType:
 *           type: string
 *           enum: [GENERAL, ORTHODONTICS, SURGERY, PEDIATRIC, PERIODONTICS, ENDODONTICS]
 *           description: Tipo de expediente médico
 *           example: "GENERAL"
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, ARCHIVED, COMPLETED]
 *           description: Estado del expediente
 *           example: "ACTIVE"
 *         chiefComplaint:
 *           type: string
 *           description: Motivo principal de consulta
 *           example: "Dolor en muela del juicio"
 *         medicalHistory:
 *           $ref: '#/components/schemas/MedicalRecord/properties/medicalHistory'
 *         dentalHistory:
 *           $ref: '#/components/schemas/MedicalRecord/properties/dentalHistory'
 *         clinicalFindings:
 *           $ref: '#/components/schemas/MedicalRecord/properties/clinicalFindings'
 *         diagnosis:
 *           $ref: '#/components/schemas/MedicalRecord/properties/diagnosis'
 *         treatmentPlan:
 *           $ref: '#/components/schemas/MedicalRecord/properties/treatmentPlan'
 *         vitalSigns:
 *           $ref: '#/components/schemas/MedicalRecord/properties/vitalSigns'
 *         notes:
 *           type: string
 *           description: Notas adicionales
 *           example: "Paciente colaborador"
 *
 *     MedicalRecordStats:
 *       type: object
 *       properties:
 *         totalRecords:
 *           type: number
 *           description: Total de expedientes médicos
 *           example: 150
 *         recordsByType:
 *           type: object
 *           properties:
 *             GENERAL:
 *               type: number
 *               example: 80
 *             ORTHODONTICS:
 *               type: number
 *               example: 25
 *             SURGERY:
 *               type: number
 *               example: 15
 *             PEDIATRIC:
 *               type: number
 *               example: 20
 *             PERIODONTICS:
 *               type: number
 *               example: 7
 *             ENDODONTICS:
 *               type: number
 *               example: 3
 *         recordsByStatus:
 *           type: object
 *           properties:
 *             ACTIVE:
 *               type: number
 *               example: 120
 *             INACTIVE:
 *               type: number
 *               example: 15
 *             ARCHIVED:
 *               type: number
 *               example: 10
 *             COMPLETED:
 *               type: number
 *               example: 5
 *         recordsThisMonth:
 *           type: number
 *           description: Expedientes creados este mes
 *           example: 25
 *         recordsThisYear:
 *           type: number
 *           description: Expedientes creados este año
 *           example: 150
 *         averageRecordsPerMonth:
 *           type: number
 *           description: Promedio de expedientes por mes
 *           example: 12.5
 *
 *     MedicalRecordValidation:
 *       type: object
 *       properties:
 *         isValid:
 *           type: boolean
 *           description: Indica si el expediente es válido
 *           example: true
 *         validationErrors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *                 example: "diagnosis.primary"
 *               message:
 *                 type: string
 *                 example: "El diagnóstico principal es requerido"
 *               severity:
 *                 type: string
 *                 enum: [ERROR, WARNING, INFO]
 *                 example: "ERROR"
 *         complianceStatus:
 *           type: object
 *           properties:
 *             nom013:
 *               type: boolean
 *               description: Cumple con NOM-013-SSA2-2015
 *               example: true
 *             nom024:
 *               type: boolean
 *               description: Cumple con NOM-024-SSA3-2012
 *               example: true
 *             nom004:
 *               type: boolean
 *               description: Cumple con NOM-004-SSA3-2012
 *               example: true
 *         lastValidated:
 *           type: string
 *           format: date-time
 *           description: Fecha de última validación
 *           example: "2024-01-15T14:30:00Z"
 *
 *   parameters:
 *     clinicId:
 *       name: clinicId
 *       in: path
 *       required: true
 *       description: ID único de la clínica
 *       schema:
 *         type: string
 *         format: uuid
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     recordId:
 *       name: recordId
 *       in: path
 *       required: true
 *       description: ID único del expediente médico
 *       schema:
 *         type: string
 *         format: uuid
 *         example: "123e4567-e89b-12d3-a456-426614174001"
 *     patientId:
 *       name: patientId
 *       in: path
 *       required: true
 *       description: ID único del paciente
 *       schema:
 *         type: string
 *         format: uuid
 *         example: "123e4567-e89b-12d3-a456-426614174002"
 *
 *   responses:
 *     MedicalRecordResponse:
 *       description: Respuesta exitosa con datos del expediente médico
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: true
 *               data:
 *                 $ref: '#/components/schemas/MedicalRecord'
 *               message:
 *                 type: string
 *                 example: "Expediente médico obtenido exitosamente"
 *
 *     MedicalRecordsListResponse:
 *       description: Respuesta exitosa con lista de expedientes médicos
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: true
 *               data:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/MedicalRecord'
 *               pagination:
 *                 $ref: '#/components/schemas/PaginationInfo'
 *               message:
 *                 type: string
 *                 example: "Expedientes médicos obtenidos exitosamente"
 *
 *     MedicalRecordStatsResponse:
 *       description: Respuesta exitosa con estadísticas de expedientes médicos
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: true
 *               data:
 *                 $ref: '#/components/schemas/MedicalRecordStats'
 *               message:
 *                 type: string
 *                 example: "Estadísticas obtenidas exitosamente"
 *
 *     MedicalRecordValidationResponse:
 *       description: Respuesta exitosa con validación del expediente médico
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: true
 *               data:
 *                 $ref: '#/components/schemas/MedicalRecordValidation'
 *               message:
 *                 type: string
 *                 example: "Validación completada exitosamente"
 *
 * tags:
 *   - name: Medical Records
 *     description: Gestión de expedientes médicos dentales
 */

// =================================================================
// CONFIGURACIÓN DE RATE LIMITING
// =================================================================

/**
 * Rate limiting general para operaciones de lectura
 * Permite mayor frecuencia para consultas de expedientes médicos
 */
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 120, // máximo 120 requests por IP
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas solicitudes. Intente nuevamente en 15 minutos.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit excedido para expedientes médicos', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Demasiadas solicitudes. Intente nuevamente en 15 minutos.'
      }
    });
  }
});

/**
 * Rate limiting estricto para operaciones de escritura
 * Menor frecuencia para creación y modificación de expedientes
 */
const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // máximo 30 requests por IP (operaciones críticas)
  message: {
    success: false,
    error: {
      code: 'STRICT_RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas operaciones de escritura. Intente nuevamente en 15 minutos.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit estricto excedido para expedientes médicos', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'STRICT_RATE_LIMIT_EXCEEDED',
        message: 'Demasiadas operaciones de escritura. Intente nuevamente en 15 minutos.'
      }
    });
  }
});

/**
 * Rate limiting para estadísticas
 * Frecuencia moderada para consultas de estadísticas
 */
const statsRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 20, // máximo 20 requests por IP
  message: {
    success: false,
    error: {
      code: 'STATS_RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas consultas de estadísticas. Intente nuevamente en 5 minutos.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// =================================================================
// MIDDLEWARE DE VALIDACIÓN PERSONALIZADO
// =================================================================

/**
 * Middleware para validar parámetros de ruta
 */
const validateRouteParams = (req: any, res: any, next: any) => {
  try {
    const { clinicId, recordId, patientId } = req.params;

    // Validar clinicId (siempre presente)
    if (!clinicId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clinicId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CLINIC_ID',
          message: 'ID de clínica inválido'
        }
      });
    }

    // Validar recordId si está presente
    if (recordId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RECORD_ID',
          message: 'ID de expediente médico inválido'
        }
      });
    }

    // Validar patientId si está presente
    if (patientId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PATIENT_ID',
          message: 'ID de paciente inválido'
        }
      });
    }

    next();
  } catch (error) {
    logger.error('Error en validación de parámetros de ruta:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error interno del servidor'
      }
    });
  }
};

/**
 * Middleware de logging para auditoría
 */
const auditLogger = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  
  // Log de inicio de request
  logger.info('Request de expediente médico iniciado', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    clinicId: req.params?.clinicId
  });

  // Override del método end para log de finalización
  const originalEnd = res.end;
  res.end = function(chunk: any, encoding: any) {
    const duration = Date.now() - startTime;
    
    logger.info('Request de expediente médico finalizado', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
      clinicId: req.params?.clinicId
    });
    
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// =================================================================
// DEFINICIÓN DE RUTAS
// =================================================================

const router = Router();

// Aplicar middleware global
router.use(authenticate);
router.use(validateRouteParams);
router.use(auditLogger);

// =================================================================
// RUTAS DE ESTADÍSTICAS (antes de rutas con parámetros)
// =================================================================

/**
 * @swagger
 * /api/clinics/{clinicId}/medical-records/stats:
 *   get:
 *     summary: Obtener estadísticas de expedientes médicos
 *     description: |
 *       Obtiene estadísticas detalladas de los expedientes médicos de la clínica.
 *       Incluye distribución por tipo, estado, y métricas temporales.
 *       
 *       **Normativas aplicables:**
 *       - NOM-013-SSA2-2015: Elementos obligatorios del expediente
 *       - NOM-024-SSA3-2012: Registro electrónico
 *     tags: [Medical Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/clinicId'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/MedicalRecordStatsResponse'
 *       401:
 *         description: No autorizado - Token JWT inválido o expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Permisos insuficientes - Requiere rol de administrador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Clínica no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Demasiadas solicitudes - Rate limit excedido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/stats',
  statsRateLimit,
  MedicalRecordsController.getMedicalRecordsStats
);

// =================================================================
// RUTAS PRINCIPALES
// =================================================================

/**
 * @swagger
 * /api/clinics/{clinicId}/medical-records:
 *   post:
 *     summary: Crear un nuevo expediente médico
 *     description: |
 *       Crea un nuevo expediente médico para un paciente en la clínica especificada.
 *       El expediente se genera automáticamente con un número único y cumple con
 *       las normativas mexicanas de expedientes clínicos.
 *       
 *       **Normativas aplicables:**
 *       - NOM-013-SSA2-2015: Elementos obligatorios del expediente
 *       - NOM-024-SSA3-2012: Registro electrónico
 *       - NOM-004-SSA3-2012: Expediente clínico
 *       
 *       **Validaciones automáticas:**
 *       - Verificación de existencia del paciente
 *       - Validación de permisos de acceso
 *       - Generación de número de expediente único
 *       - Cumplimiento de campos obligatorios NOM
 *     tags: [Medical Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/clinicId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMedicalRecordRequest'
 *           examples:
 *             general_record:
 *               summary: Expediente general
 *               value:
 *                 patientId: "123e4567-e89b-12d3-a456-426614174001"
 *                 recordType: "GENERAL"
 *                 chiefComplaint: "Dolor en muela del juicio"
 *                 medicalHistory:
 *                   allergies: ["Penicilina"]
 *                   medications: ["Ibuprofeno 400mg"]
 *                   conditions: ["Diabetes tipo 2"]
 *                 vitalSigns:
 *                   bloodPressure: "120/80"
 *                   heartRate: 72
 *                   temperature: 36.5
 *                 notes: "Paciente colaborador, primera consulta"
 *             orthodontic_record:
 *               summary: Expediente ortodóntico
 *               value:
 *                 patientId: "123e4567-e89b-12d3-a456-426614174001"
 *                 recordType: "ORTHODONTICS"
 *                 chiefComplaint: "Corrección de maloclusión"
 *                 dentalHistory:
 *                   previousTreatments: ["Limpieza dental"]
 *                   oralHygiene: "GOOD"
 *                 treatmentPlan:
 *                   procedures:
 *                     - name: "Brackets metálicos"
 *                       tooth: "Arcada completa"
 *                       priority: "MEDIUM"
 *                   estimatedCost: 15000.00
 *                   estimatedDuration: "18 meses"
 *     responses:
 *       201:
 *         description: Expediente médico creado exitosamente
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
 *                   example: "Expediente médico creado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/MedicalRecord'
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "VALIDATION_ERROR"
 *                     message:
 *                       type: string
 *                       example: "Datos de entrada inválidos"
 *                     details:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           field:
 *                             type: string
 *                           message:
 *                             type: string
 *       401:
 *         description: No autorizado - Token JWT inválido o expirado
 *       403:
 *         description: Permisos insuficientes - Requiere rol de administrador
 *       404:
 *         description: Paciente o clínica no encontrados
 *       409:
 *         description: El paciente ya tiene un expediente médico activo
 *       429:
 *         description: Demasiadas solicitudes - Rate limit excedido
 *       500:
 *         description: Error interno del servidor
 */
router.post(
  '/',
  strictRateLimit,
  validateSchema(createMedicalRecordSchema),
  MedicalRecordsController.createMedicalRecord
);

/**
 * @swagger
 * /api/clinics/{clinicId}/medical-records:
 *   get:
 *     summary: Listar expedientes médicos de una clínica
 *     description: |
 *       Obtiene una lista paginada de expedientes médicos de la clínica con filtros opcionales.
 *       Permite búsqueda avanzada por múltiples criterios y ordenamiento personalizado.
 *       
 *       **Características:**
 *       - Paginación automática
 *       - Filtros por tipo, estado, paciente
 *       - Búsqueda de texto completo
 *       - Ordenamiento por múltiples campos
 *       - Cumplimiento normativo NOM
 *     tags: [Medical Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/clinicId'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número de página
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Número de elementos por página
 *         example: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Búsqueda en número de expediente, notas y diagnóstico
 *         example: "dolor muela"
 *       - in: query
 *         name: patientId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID del paciente
 *         example: "123e4567-e89b-12d3-a456-426614174001"
 *       - in: query
 *         name: recordType
 *         schema:
 *           type: string
 *           enum: [GENERAL, ORTHODONTICS, SURGERY, PEDIATRIC, PERIODONTICS, ENDODONTICS]
 *         description: Filtrar por tipo de expediente
 *         example: "GENERAL"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, ARCHIVED, COMPLETED]
 *         description: Filtrar por estado del expediente
 *         example: "ACTIVE"
 *       - in: query
 *         name: createdFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de creación desde
 *         example: "2024-01-01"
 *       - in: query
 *         name: createdTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de creación hasta
 *         example: "2024-12-31"
 *       - in: query
 *         name: updatedFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de actualización desde
 *         example: "2024-01-01"
 *       - in: query
 *         name: updatedTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de actualización hasta
 *         example: "2024-12-31"
 *       - in: query
 *         name: hasAttachments
 *         schema:
 *           type: boolean
 *         description: Filtrar expedientes con archivos adjuntos
 *         example: true
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [recordNumber, createdAt, updatedAt, patientName, recordType, status]
 *           default: createdAt
 *         description: Campo por el cual ordenar
 *         example: "createdAt"
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Orden de clasificación
 *         example: "desc"
 *     responses:
 *       200:
 *         $ref: '#/components/responses/MedicalRecordsListResponse'
 *       400:
 *         description: Parámetros de consulta inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "INVALID_QUERY_PARAMS"
 *                     message:
 *                       type: string
 *                       example: "Parámetros de consulta inválidos"
 *                     details:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           field:
 *                             type: string
 *                           message:
 *                             type: string
 *       401:
 *         description: No autorizado - Token JWT inválido o expirado
 *       403:
 *         description: Permisos insuficientes - Requiere rol de administrador
 *       404:
 *         description: Clínica no encontrada
 *       429:
 *         description: Demasiadas solicitudes - Rate limit excedido
 *       500:
 *         description: Error interno del servidor
 */
router.get(
  '/',
  generalRateLimit,
  validateSchema(medicalRecordFiltersSchema, 'query'),
  validateSchema(paginationSchema, 'query'),
  MedicalRecordsController.getMedicalRecords
);

/**
 * @swagger
 * /api/clinics/{clinicId}/medical-records/patient/{patientId}:
 *   get:
 *     summary: Obtener expediente médico por ID de paciente
 *     description: |
 *       Obtiene el expediente médico activo de un paciente específico.
 *       Útil para consultas rápidas durante citas médicas.
 *       
 *       **Casos de uso:**
 *       - Consulta durante cita médica
 *       - Revisión de historial clínico
 *       - Preparación de tratamientos
 *     tags: [Medical Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/clinicId'
 *       - $ref: '#/components/parameters/patientId'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/MedicalRecordResponse'
 *       401:
 *         description: No autorizado - Token JWT inválido o expirado
 *       403:
 *         description: Permisos insuficientes
 *       404:
 *         description: Paciente o expediente no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "MEDICAL_RECORD_NOT_FOUND"
 *                     message:
 *                       type: string
 *                       example: "No se encontró expediente médico para este paciente"
 *       429:
 *         description: Demasiadas solicitudes - Rate limit excedido
 *       500:
 *         description: Error interno del servidor
 */
router.get(
  '/patient/:patientId',
  generalRateLimit,
  MedicalRecordsController.getMedicalRecordByPatientId
);

/**
 * @swagger
 * /api/clinics/{clinicId}/medical-records/{recordId}:
 *   get:
 *     summary: Obtener expediente médico por ID
 *     description: |
 *       Obtiene un expediente médico específico por su ID único.
 *       Incluye toda la información detallada del expediente.
 *       
 *       **Información incluida:**
 *       - Datos del paciente
 *       - Historia médica y dental
 *       - Hallazgos clínicos
 *       - Diagnósticos
 *       - Plan de tratamiento
 *       - Archivos adjuntos
 *     tags: [Medical Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/clinicId'
 *       - $ref: '#/components/parameters/recordId'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/MedicalRecordResponse'
 *       401:
 *         description: No autorizado - Token JWT inválido o expirado
 *       403:
 *         description: Permisos insuficientes
 *       404:
 *         description: Expediente médico no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "MEDICAL_RECORD_NOT_FOUND"
 *                     message:
 *                       type: string
 *                       example: "Expediente médico no encontrado"
 *       429:
 *         description: Demasiadas solicitudes - Rate limit excedido
 *       500:
 *         description: Error interno del servidor
 */
router.get(
  '/:recordId',
  generalRateLimit,
  MedicalRecordsController.getMedicalRecordById
);

/**
 * @swagger
 * /api/clinics/{clinicId}/medical-records/{recordId}:
 *   put:
 *     summary: Actualizar expediente médico
 *     description: |
 *       Actualiza un expediente médico existente con nueva información.
 *       Mantiene un historial de versiones para auditoría y cumplimiento normativo.
 *       
 *       **Características:**
 *       - Control de versiones automático
 *       - Validación de integridad de datos
 *       - Cumplimiento normativo NOM
 *       - Auditoría de cambios
 *       - Validación de permisos médicos
 *       
 *       **Campos actualizables:**
 *       - Historia médica y dental
 *       - Hallazgos clínicos
 *       - Diagnósticos
 *       - Plan de tratamiento
 *       - Estado del expediente
 *       - Notas adicionales
 *     tags: [Medical Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/clinicId'
 *       - $ref: '#/components/parameters/recordId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateMedicalRecordRequest'
 *           examples:
 *             update_diagnosis:
 *               summary: Actualizar diagnóstico
 *               value:
 *                 diagnosis:
 *                   primary: "Caries dental profunda"
 *                   secondary: ["Gingivitis", "Sensibilidad dental"]
 *                 treatmentPlan:
 *                   procedures:
 *                     - name: "Endodoncia"
 *                       tooth: "18"
 *                       priority: "HIGH"
 *                     - name: "Corona dental"
 *                       tooth: "18"
 *                       priority: "MEDIUM"
 *                   estimatedCost: 3500.00
 *                   estimatedDuration: "3 semanas"
 *                 notes: "Paciente refiere dolor intenso, requiere tratamiento urgente"
 *             update_status:
 *               summary: Cambiar estado
 *               value:
 *                 status: "COMPLETED"
 *                 notes: "Tratamiento finalizado exitosamente"
 *     responses:
 *       200:
 *         description: Expediente médico actualizado exitosamente
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
 *                   example: "Expediente médico actualizado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/MedicalRecord'
 *       400:
 *         description: Datos de entrada inválidos
 *       401:
 *         description: No autorizado - Token JWT inválido o expirado
 *       403:
 *         description: Permisos insuficientes - Requiere rol de dentista
 *       404:
 *         description: Expediente médico no encontrado
 *       409:
 *         description: Conflicto de versiones - El expediente fue modificado por otro usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "VERSION_CONFLICT"
 *                     message:
 *                       type: string
 *                       example: "El expediente fue modificado por otro usuario"
 *       429:
 *         description: Demasiadas solicitudes - Rate limit excedido
 *       500:
 *         description: Error interno del servidor
 */
router.put(
  '/:recordId',
  strictRateLimit,
  validateSchema(updateMedicalRecordSchema),
  MedicalRecordsController.updateMedicalRecord
);

/**
 * @swagger
 * /api/clinics/{clinicId}/medical-records/{recordId}:
 *   delete:
 *     summary: Archivar expediente médico
 *     description: |
 *       Archiva un expediente médico (eliminación lógica). El expediente no se elimina
 *       físicamente sino que se marca como archivado para cumplir con las normativas
 *       de conservación de expedientes clínicos.
 *       
 *       **Normativas aplicables:**
 *       - NOM-004-SSA3-2012: Conservación de expedientes clínicos
 *       - Ley General de Salud: Conservación mínima de 5 años
 *       
 *       **Características:**
 *       - Eliminación lógica (soft delete)
 *       - Conservación para auditorías
 *       - Cumplimiento normativo
 *       - Registro de auditoría
 *       - Reversible por administradores
 *       
 *       **Nota importante:** Los expedientes archivados pueden ser restaurados
 *       por usuarios con permisos de administrador si es necesario.
 *     tags: [Medical Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/clinicId'
 *       - $ref: '#/components/parameters/recordId'
 *     responses:
 *       200:
 *         description: Expediente médico archivado exitosamente
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
 *                   example: "Expediente médico archivado exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     recordNumber:
 *                       type: string
 *                       example: "EXP-2024-001"
 *                     status:
 *                       type: string
 *                       example: "ARCHIVED"
 *                     archivedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T14:30:00Z"
 *                     archivedBy:
 *                       type: string
 *                       format: uuid
 *                       example: "123e4567-e89b-12d3-a456-426614174003"
 *       401:
 *         description: No autorizado - Token JWT inválido o expirado
 *       403:
 *         description: Permisos insuficientes - Requiere rol de dentista o administrador
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "INSUFFICIENT_PERMISSIONS"
 *                     message:
 *                       type: string
 *                       example: "No tiene permisos para archivar expedientes médicos"
 *       404:
 *         description: Expediente médico no encontrado
 *       409:
 *         description: El expediente ya está archivado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "ALREADY_ARCHIVED"
 *                     message:
 *                       type: string
 *                       example: "El expediente médico ya está archivado"
 *       429:
 *         description: Demasiadas solicitudes - Rate limit excedido
 *       500:
 *         description: Error interno del servidor
 */
router.delete(
  '/:recordId',
  strictRateLimit,
  MedicalRecordsController.deleteMedicalRecord
);

/**
 * @swagger
 * /api/clinics/{clinicId}/medical-records/{recordId}/validate:
 *   post:
 *     summary: Validar integridad del expediente médico
 *     description: |
 *       Valida la integridad y cumplimiento normativo de un expediente médico.
 *       Verifica que el expediente cumpla con todas las normativas mexicanas
 *       aplicables y que contenga la información mínima requerida.
 *       
 *       **Normativas validadas:**
 *       - NOM-013-SSA2-2015: Elementos obligatorios del expediente
 *       - NOM-024-SSA3-2012: Registro electrónico
 *       - NOM-004-SSA3-2012: Expediente clínico
 *       
 *       **Validaciones realizadas:**
 *       - Campos obligatorios completos
 *       - Formato de datos correcto
 *       - Consistencia de información
 *       - Cumplimiento normativo
 *       - Integridad de archivos adjuntos
 *       - Firmas digitales (si aplica)
 *       
 *       **Casos de uso:**
 *       - Auditorías internas
 *       - Preparación para inspecciones
 *       - Control de calidad
 *       - Cumplimiento normativo
 *     tags: [Medical Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/clinicId'
 *       - $ref: '#/components/parameters/recordId'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/MedicalRecordValidationResponse'
 *       401:
 *         description: No autorizado - Token JWT inválido o expirado
 *       403:
 *         description: Permisos insuficientes
 *       404:
 *         description: Expediente médico no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "MEDICAL_RECORD_NOT_FOUND"
 *                     message:
 *                       type: string
 *                       example: "Expediente médico no encontrado"
 *       422:
 *         description: Expediente médico no válido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 data:
 *                   $ref: '#/components/schemas/MedicalRecordValidation'
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "VALIDATION_FAILED"
 *                     message:
 *                       type: string
 *                       example: "El expediente médico no cumple con los requisitos normativos"
 *       429:
 *         description: Demasiadas solicitudes - Rate limit excedido
 *       500:
 *         description: Error interno del servidor
 */
router.post(
  '/:recordId/validate',
  generalRateLimit,
  MedicalRecordsController.validateMedicalRecord
);

// =================================================================
// MANEJO DE ERRORES DE RUTA
// =================================================================

/**
 * Middleware para manejar rutas no encontradas
 */
router.use('*', (req, res) => {
  logger.warn('Ruta de expediente médico no encontrada', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  });
  
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Ruta no encontrada'
    }
  });
});

/**
 * Middleware para manejo de errores generales
 */
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Error en rutas de expedientes médicos:', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id
  });
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Error interno del servidor'
    }
  });
});

// =================================================================
// DOCUMENTACIÓN DE ENDPOINTS
// =================================================================

/**
 * ENDPOINTS DISPONIBLES:
 * 
 * 1. POST /api/clinics/:clinicId/medical-records
 *    - Crear nuevo expediente médico
 *    - Requiere: rol DENTIST o ADMIN
 *    - Rate limit: 30 req/15min
 * 
 * 2. GET /api/clinics/:clinicId/medical-records
 *    - Listar expedientes con filtros
 *    - Requiere: rol DENTIST, ADMIN o ASSISTANT
 *    - Rate limit: 120 req/15min
 * 
 * 3. GET /api/clinics/:clinicId/medical-records/:recordId
 *    - Obtener expediente específico
 *    - Requiere: rol DENTIST, ADMIN o ASSISTANT
 *    - Rate limit: 120 req/15min
 * 
 * 4. GET /api/clinics/:clinicId/medical-records/patient/:patientId
 *    - Obtener expediente por paciente
 *    - Requiere: rol DENTIST, ADMIN o ASSISTANT
 *    - Rate limit: 120 req/15min
 * 
 * 5. PUT /api/clinics/:clinicId/medical-records/:recordId
 *    - Actualizar expediente médico
 *    - Requiere: rol DENTIST o ADMIN
 *    - Rate limit: 30 req/15min
 * 
 * 6. DELETE /api/clinics/:clinicId/medical-records/:recordId
 *    - Archivar expediente médico
 *    - Requiere: rol DENTIST o ADMIN
 *    - Rate limit: 30 req/15min
 * 
 * 7. GET /api/clinics/:clinicId/medical-records/stats
 *    - Obtener estadísticas
 *    - Requiere: rol DENTIST, ADMIN o ASSISTANT
 *    - Rate limit: 20 req/5min
 * 
 * 8. POST /api/clinics/:clinicId/medical-records/:recordId/validate
 *    - Validar integridad del expediente
 *    - Requiere: rol DENTIST, ADMIN o ASSISTANT
 *    - Rate limit: 120 req/15min
 */

export default router;