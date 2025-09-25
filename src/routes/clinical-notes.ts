/**
 * =================================================================
 * RUTAS DE NOTAS CLÍNICAS - SISTEMA EXPEDIENTES DENTALES
 * =================================================================
 * 
 * Este archivo define todas las rutas HTTP para el módulo de notas clínicas,
 * garantizando el cumplimiento de las normativas mexicanas:
 * - NOM-013-SSA2-2015 (Elementos obligatorios)
 * - NOM-024-SSA3-2012 (Registro electrónico)
 * 
 * ENDPOINTS DISPONIBLES:
 * - POST   /api/clinics/:clinicId/clinical-notes
 * - GET    /api/clinics/:clinicId/clinical-notes
 * - GET    /api/clinics/:clinicId/clinical-notes/:noteId
 * - PUT    /api/clinics/:clinicId/clinical-notes/:noteId
 * - DELETE /api/clinics/:clinicId/clinical-notes/:noteId (deshabilitado)
 * - GET    /api/clinics/:clinicId/clinical-notes/stats
 * 
 * MIDDLEWARE APLICADO:
 * - Rate limiting (general y estricto)
 * - Autenticación JWT
 * - Autorización por roles
 * - Validación de esquemas
 * - Logging y auditoría
 * 
 * =================================================================
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { clinicalNotesController } from '../controllers/clinicalNotesController';
import { authenticate } from '../middleware/auth';
import { validateSchema } from '../middleware/validation.middleware';
import { 
  CreateClinicalNoteSchema, 
  UpdateClinicalNoteSchema, 
  ClinicalNoteFiltersSchema 
} from '../schemas/clinical-notes.schemas';

// =================================================================
// CONFIGURACIÓN DE RATE LIMITING
// =================================================================

/**
 * Rate limiting general para operaciones de lectura
 * Permite mayor frecuencia para consultas
 */
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 150, // máximo 150 requests por IP (menor que pacientes por ser más específico)
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas solicitudes de notas clínicas. Intente nuevamente más tarde.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiting estricto para operaciones de escritura
 * Protege contra abuso en creación/modificación de notas
 */
const strictRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 30, // máximo 30 requests por IP por hora para operaciones críticas
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas operaciones de escritura en notas clínicas. Intente nuevamente en 1 hora.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiting muy estricto para estadísticas
 * Evita consultas excesivas de reportes
 */
const statsRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // máximo 10 requests por IP por hora para estadísticas
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas consultas de estadísticas. Intente nuevamente en 1 hora.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// =================================================================
// CONFIGURACIÓN DEL ROUTER
// =================================================================

const router = Router({ mergeParams: true }); // mergeParams para acceder a clinicId

// =================================================================
// DOCUMENTACIÓN SWAGGER - ESQUEMAS
// =================================================================

/**
 * @swagger
 * components:
 *   schemas:
 *     ClinicalNote:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único de la nota clínica
 *         appointment_id:
 *           type: string
 *           format: uuid
 *           description: ID de la cita médica asociada
 *         medical_record_id:
 *           type: string
 *           format: uuid
 *           description: ID del expediente médico
 *         patient_id:
 *           type: string
 *           format: uuid
 *           description: ID del paciente
 *         clinic_id:
 *           type: string
 *           format: uuid
 *           description: ID de la clínica
 *         chief_complaint:
 *           type: string
 *           description: Motivo principal de consulta (NOM-013)
 *         history_of_present_illness:
 *           type: string
 *           description: Historia de la enfermedad actual
 *         clinical_examination:
 *           type: object
 *           description: Examen clínico detallado
 *           properties:
 *             general_appearance:
 *               type: string
 *             vital_signs:
 *               type: object
 *             oral_examination:
 *               type: object
 *             periodontal_examination:
 *               type: object
 *         diagnosis:
 *           type: object
 *           description: Diagnóstico con código CIE-10 (NOM-013)
 *           properties:
 *             primary_diagnosis:
 *               type: string
 *             primary_icd10_code:
 *               type: string
 *             secondary_diagnoses:
 *               type: array
 *               items:
 *                 type: object
 *         treatment_plan:
 *           type: object
 *           description: Plan de tratamiento detallado
 *           properties:
 *             description:
 *               type: string
 *             procedures:
 *               type: array
 *               items:
 *                 type: object
 *             estimated_duration:
 *               type: string
 *             estimated_cost:
 *               type: number
 *         prescriptions:
 *           type: array
 *           description: Recetas médicas
 *           items:
 *             type: object
 *         recommendations:
 *           type: string
 *           description: Recomendaciones para el paciente
 *         follow_up_date:
 *           type: string
 *           format: date
 *           description: Fecha de seguimiento
 *         created_by:
 *           type: string
 *           format: uuid
 *           description: ID del dentista que creó la nota
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación (NOM-024)
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de última actualización
 *         digital_signature:
 *           type: string
 *           description: Firma digital del profesional (NOM-024)
 *         is_final:
 *           type: boolean
 *           description: Indica si la nota está finalizada
 *     
 *     CreateClinicalNoteRequest:
 *       type: object
 *       required:
 *         - appointment_id
 *         - medical_record_id
 *         - chief_complaint
 *         - clinical_examination
 *         - diagnosis
 *         - treatment_plan
 *       properties:
 *         appointment_id:
 *           type: string
 *           format: uuid
 *           description: ID de la cita médica
 *         medical_record_id:
 *           type: string
 *           format: uuid
 *           description: ID del expediente médico
 *         chief_complaint:
 *           type: string
 *           minLength: 10
 *           maxLength: 1000
 *           description: Motivo de consulta (obligatorio NOM-013)
 *         history_of_present_illness:
 *           type: string
 *           maxLength: 2000
 *           description: Historia de enfermedad actual
 *         clinical_examination:
 *           type: object
 *           description: Examen clínico completo
 *         diagnosis:
 *           type: object
 *           required:
 *             - primary_diagnosis
 *             - primary_icd10_code
 *           properties:
 *             primary_diagnosis:
 *               type: string
 *               minLength: 5
 *               maxLength: 500
 *             primary_icd10_code:
 *               type: string
 *               pattern: '^[A-Z][0-9]{2}(\\.[0-9]{1,2})?$'
 *         treatment_plan:
 *           type: object
 *           required:
 *             - description
 *           properties:
 *             description:
 *               type: string
 *               minLength: 10
 *               maxLength: 2000
 *         prescriptions:
 *           type: array
 *           items:
 *             type: object
 *         recommendations:
 *           type: string
 *           maxLength: 1000
 *         follow_up_date:
 *           type: string
 *           format: date
 */

// =================================================================
// DEFINICIÓN DE RUTAS
// =================================================================

/**
 * @swagger
 * /api/clinics/{clinicId}/clinical-notes:
 *   post:
 *     summary: Crear una nueva nota clínica
 *     description: |
 *       Crea una nueva nota clínica asociada a una cita médica.
 *       Cumple con los requisitos de NOM-013-SSA2-2015 y NOM-024-SSA3-2012.
 *       Solo los dentistas pueden crear notas clínicas.
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clinicId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la clínica
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateClinicalNoteRequest'
 *     responses:
 *       201:
 *         description: Nota clínica creada exitosamente
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
 *                   example: "Nota clínica creada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/ClinicalNote'
 *       400:
 *         description: Datos de entrada inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes (solo dentistas)
 *       409:
 *         description: Ya existe una nota para esta cita
 *       429:
 *         description: Demasiadas solicitudes
 *       500:
 *         description: Error interno del servidor
 */
router.post(
  '/',
  strictRateLimit, // Rate limiting estricto para creación
  authenticate, // Verificar autenticación
  validateSchema(CreateClinicalNoteSchema, 'body'),
  clinicalNotesController.createClinicalNote // Ejecutar controlador
);

/**
 * @swagger
 * /api/clinics/{clinicId}/clinical-notes:
 *   get:
 *     summary: Obtener notas clínicas con filtros
 *     description: |
 *       Obtiene una lista paginada de notas clínicas con filtros opcionales.
 *       Los dentistas solo ven sus propias notas, los administradores ven todas.
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clinicId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la clínica
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
 *         name: appointment_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID de cita
 *       - in: query
 *         name: icd10_code
 *         schema:
 *           type: string
 *         description: Filtrar por código CIE-10
 *       - in: query
 *         name: diagnosis_contains
 *         schema:
 *           type: string
 *         description: Buscar en diagnóstico
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha desde (YYYY-MM-DD)
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha hasta (YYYY-MM-DD)
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
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, appointment_date]
 *           default: created_at
 *         description: Campo para ordenar
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Orden de clasificación
 *     responses:
 *       200:
 *         description: Lista de notas clínicas obtenida exitosamente
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
 *                   example: "Notas clínicas obtenidas exitosamente"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ClinicalNote'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     current_page:
 *                       type: integer
 *                     total_pages:
 *                       type: integer
 *                     total_records:
 *                       type: integer
 *                     has_next:
 *                       type: boolean
 *                     has_previous:
 *                       type: boolean
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       429:
 *         description: Demasiadas solicitudes
 *       500:
 *         description: Error interno del servidor
 */
router.get(
  '/',
  generalRateLimit, // Rate limiting general para consultas
  authenticate, // Verificar autenticación
  validateSchema(ClinicalNoteFiltersSchema, 'query'),
  clinicalNotesController.getClinicalNotes // Ejecutar controlador
);

/**
 * @swagger
 * /api/clinics/{clinicId}/clinical-notes/stats:
 *   get:
 *     summary: Obtener estadísticas de notas clínicas
 *     description: |
 *       Obtiene estadísticas y métricas de las notas clínicas de la clínica.
 *       Solo disponible para administradores de clínica.
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clinicId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la clínica
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *         description: Período para las estadísticas
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       429:
 *         description: Demasiadas solicitudes
 *       501:
 *         description: Funcionalidad en desarrollo
 *       500:
 *         description: Error interno del servidor
 */
router.get(
  '/stats',
  statsRateLimit, // Rate limiting muy estricto para estadísticas
  authenticate, // Verificar autenticación
  // TODO: Agregar middleware de autorización para admin
  clinicalNotesController.getClinicalNotesStats // Ejecutar controlador
);

/**
 * @swagger
 * /api/clinics/{clinicId}/clinical-notes/{noteId}:
 *   get:
 *     summary: Obtener una nota clínica específica
 *     description: |
 *       Obtiene los detalles completos de una nota clínica específica.
 *       Los dentistas solo pueden ver sus propias notas.
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clinicId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la clínica
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la nota clínica
 *     responses:
 *       200:
 *         description: Nota clínica obtenida exitosamente
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
 *                   example: "Nota clínica obtenida exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/ClinicalNote'
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       404:
 *         description: Nota clínica no encontrada
 *       429:
 *         description: Demasiadas solicitudes
 *       500:
 *         description: Error interno del servidor
 */
router.get(
  '/:noteId',
  generalRateLimit, // Rate limiting general
  authenticate, // Verificar autenticación
  clinicalNotesController.getClinicalNoteById // Ejecutar controlador
);

/**
 * @swagger
 * /api/clinics/{clinicId}/clinical-notes/{noteId}:
 *   put:
 *     summary: Actualizar una nota clínica
 *     description: |
 *       Actualiza una nota clínica existente.
 *       Solo el dentista que creó la nota puede modificarla.
 *       Las notas finalizadas no pueden ser modificadas.
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clinicId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la clínica
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la nota clínica
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chief_complaint:
 *                 type: string
 *               history_of_present_illness:
 *                 type: string
 *               clinical_examination:
 *                 type: object
 *               diagnosis:
 *                 type: object
 *               treatment_plan:
 *                 type: object
 *               prescriptions:
 *                 type: array
 *               recommendations:
 *                 type: string
 *               follow_up_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Nota clínica actualizada exitosamente
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
 *                   example: "Nota clínica actualizada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/ClinicalNote'
 *       400:
 *         description: Datos de entrada inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       404:
 *         description: Nota clínica no encontrada
 *       409:
 *         description: Nota no puede ser modificada
 *       429:
 *         description: Demasiadas solicitudes
 *       500:
 *         description: Error interno del servidor
 */
router.put(
  '/:noteId',
  strictRateLimit, // Rate limiting estricto para modificaciones
  authenticate, // Verificar autenticación
  validateSchema(UpdateClinicalNoteSchema, 'body'),
  clinicalNotesController.updateClinicalNote // Ejecutar controlador
);

/**
 * @swagger
 * /api/clinics/{clinicId}/clinical-notes/{noteId}:
 *   delete:
 *     summary: Eliminar una nota clínica (DESHABILITADO)
 *     description: |
 *       Este endpoint está deshabilitado por cumplimiento normativo.
 *       Las notas clínicas no pueden ser eliminadas según NOM-013 y NOM-024.
 *       Use el endpoint de archivado en su lugar.
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clinicId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la clínica
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la nota clínica
 *     responses:
 *       405:
 *         description: Método no permitido por cumplimiento normativo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "No se permite eliminar notas clínicas por cumplimiento normativo"
 *                 error_code:
 *                   type: string
 *                   example: "METHOD_NOT_ALLOWED"
 */
router.delete(
  '/:noteId',
  strictRateLimit, // Rate limiting estricto
  authenticate, // Verificar autenticación
  clinicalNotesController.deleteClinicalNote // Ejecutar controlador (retorna 405)
);

// =================================================================
// EXPORTACIÓN DEL ROUTER
// =================================================================

export default router;