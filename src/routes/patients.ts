import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { patientController } from '../controllers/patientController';
import { authenticate, requireClinicAdmin } from '../middleware/auth';
import { validateSchema } from '../middleware/validation.middleware';
import { 
  CreatePatientSchema, 
  UpdatePatientSchema, 
  PatientFiltersSchema 
} from '../schemas/patients.schemas';

// Rate limiting específico para pacientes
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // máximo 200 requests por IP (más alto que clínicas por mayor frecuencia de uso)
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas solicitudes. Intente nuevamente más tarde.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

const strictRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50, // máximo 50 requests por IP por hora para operaciones críticas
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas solicitudes para esta operación. Intente nuevamente en 1 hora.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

const router = Router({ mergeParams: true }); // mergeParams para acceder a clinicId

/**
 * @swagger
 * components:
 *   schemas:
 *     Patient:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único del paciente
 *         first_name:
 *           type: string
 *           description: Primer nombre del paciente
 *         last_name:
 *           type: string
 *           description: Apellido paterno del paciente
 *         second_last_name:
 *           type: string
 *           description: Apellido materno del paciente
 *         date_of_birth:
 *           type: string
 *           format: date
 *           description: Fecha de nacimiento
 *         gender:
 *           type: string
 *           enum: [male, female, other]
 *           description: Género del paciente
 *         curp:
 *           type: string
 *           description: CURP del paciente
 *         rfc:
 *           type: string
 *           description: RFC del paciente
 *         email:
 *           type: string
 *           format: email
 *           description: Correo electrónico
 *         phone:
 *           type: string
 *           description: Teléfono fijo
 *         mobile_phone:
 *           type: string
 *           description: Teléfono móvil
 *         emergency_contact_name:
 *           type: string
 *           description: Nombre del contacto de emergencia
 *         emergency_contact_phone:
 *           type: string
 *           description: Teléfono del contacto de emergencia
 *         street:
 *           type: string
 *           description: Dirección - Calle
 *         neighborhood:
 *           type: string
 *           description: Dirección - Colonia
 *         city:
 *           type: string
 *           description: Dirección - Ciudad
 *         state:
 *           type: string
 *           description: Dirección - Estado
 *         postal_code:
 *           type: string
 *           description: Código postal
 *         country:
 *           type: string
 *           description: País
 *         insurance_company:
 *           type: string
 *           description: Compañía de seguros
 *         insurance_number:
 *           type: string
 *           description: Número de seguro
 *         insurance_type:
 *           type: string
 *           enum: [IMSS, ISSSTE, PEMEX, SEDENA, SEMAR, PRIVADO, OTRO]
 *           description: Tipo de seguro
 *         blood_type:
 *           type: string
 *           enum: [A+, A-, B+, B-, AB+, AB-, O+, O-]
 *           description: Tipo de sangre
 *         marital_status:
 *           type: string
 *           enum: [SOLTERO, CASADO, DIVORCIADO, VIUDO, UNION_LIBRE]
 *           description: Estado civil
 *         occupation:
 *           type: string
 *           description: Ocupación
 *         registration_date:
 *           type: string
 *           format: date
 *           description: Fecha de registro
 *         is_active:
 *           type: boolean
 *           description: Estado activo del paciente
 *         clinic_id:
 *           type: string
 *           format: uuid
 *           description: ID de la clínica
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de última actualización
 *     
 *     CreatePatientRequest:
 *       type: object
 *       required:
 *         - first_name
 *         - last_name
 *         - date_of_birth
 *         - gender
 *         - country
 *       properties:
 *         first_name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         last_name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         second_last_name:
 *           type: string
 *           maxLength: 100
 *         date_of_birth:
 *           type: string
 *           format: date
 *         gender:
 *           type: string
 *           enum: [male, female, other]
 *         curp:
 *           type: string
 *           pattern: '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z][0-9]$'
 *         rfc:
 *           type: string
 *           pattern: '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'
 *         email:
 *           type: string
 *           format: email
 *         phone:
 *           type: string
 *         mobile_phone:
 *           type: string
 *         emergency_contact_name:
 *           type: string
 *         emergency_contact_phone:
 *           type: string
 *         street:
 *           type: string
 *         neighborhood:
 *           type: string
 *         city:
 *           type: string
 *         state:
 *           type: string
 *         postal_code:
 *           type: string
 *         country:
 *           type: string
 *           minLength: 1
 *         insurance_company:
 *           type: string
 *         insurance_number:
 *           type: string
 *         insurance_type:
 *           type: string
 *           enum: [IMSS, ISSSTE, PEMEX, SEDENA, SEMAR, PRIVADO, OTRO]
 *         blood_type:
 *           type: string
 *           enum: [A+, A-, B+, B-, AB+, AB-, O+, O-]
 *         marital_status:
 *           type: string
 *           enum: [SOLTERO, CASADO, DIVORCIADO, VIUDO, UNION_LIBRE]
 *         occupation:
 *           type: string
 *         registration_date:
 *           type: string
 *           format: date
 *     
 *     UpdatePatientRequest:
 *       type: object
 *       properties:
 *         first_name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         last_name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         second_last_name:
 *           type: string
 *           maxLength: 100
 *         date_of_birth:
 *           type: string
 *           format: date
 *         gender:
 *           type: string
 *           enum: [male, female, other]
 *         curp:
 *           type: string
 *           pattern: '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z][0-9]$'
 *         rfc:
 *           type: string
 *           pattern: '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'
 *         email:
 *           type: string
 *           format: email
 *         phone:
 *           type: string
 *         mobile_phone:
 *           type: string
 *         emergency_contact_name:
 *           type: string
 *         emergency_contact_phone:
 *           type: string
 *         street:
 *           type: string
 *         neighborhood:
 *           type: string
 *         city:
 *           type: string
 *         state:
 *           type: string
 *         postal_code:
 *           type: string
 *         country:
 *           type: string
 *         insurance_company:
 *           type: string
 *         insurance_number:
 *           type: string
 *         insurance_type:
 *           type: string
 *           enum: [IMSS, ISSSTE, PEMEX, SEDENA, SEMAR, PRIVADO, OTRO]
 *         blood_type:
 *           type: string
 *           enum: [A+, A-, B+, B-, AB+, AB-, O+, O-]
 *         marital_status:
 *           type: string
 *           enum: [SOLTERO, CASADO, DIVORCIADO, VIUDO, UNION_LIBRE]
 *         occupation:
 *           type: string
 *         registration_date:
 *           type: string
 *           format: date
 *     
 *     PatientListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Patient'
 *         pagination:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *             totalPages:
 *               type: integer
 *     
 *     PatientStatsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             total_patients:
 *               type: integer
 *             active_patients:
 *               type: integer
 *             inactive_patients:
 *               type: integer
 *             recent_patients:
 *               type: integer
 *             gender_distribution:
 *               type: object
 *               properties:
 *                 male:
 *                   type: integer
 *                 female:
 *                   type: integer
 *                 other:
 *                   type: integer
 */

/**
 * @swagger
 * /api/clinics/{clinicId}/patients:
 *   post:
 *     summary: Crear un nuevo paciente
 *     description: Crea un nuevo paciente en la clínica especificada. Requiere permisos de administrador de clínica.
 *     tags: [Patients]
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
 *             $ref: '#/components/schemas/CreatePatientRequest'
 *     responses:
 *       201:
 *         description: Paciente creado exitosamente
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
 *                   example: "Paciente creado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Patient'
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       429:
 *         description: Demasiadas solicitudes
 *       500:
 *         description: Error interno del servidor
 */
router.post(
  '/',
  strictRateLimit, // Rate limiting estricto para creación
  authenticate, // Verificar autenticación
  requireClinicAdmin, // Solo administradores de clínica o sistema
  validateSchema(CreatePatientSchema, 'body'), // Validar datos de entrada
  patientController.createPatient // Ejecutar controlador
);

/**
 * @swagger
 * /api/clinics/{clinicId}/patients:
 *   get:
 *     summary: Listar pacientes de una clínica
 *     description: Obtiene una lista paginada de pacientes de la clínica con filtros opcionales
 *     tags: [Patients]
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
 *           default: 10
 *         description: Número de elementos por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Búsqueda por nombre, apellido, email o CURP
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filtrar por estado activo
 *       - in: query
 *         name: gender
 *         schema:
 *           type: string
 *           enum: [male, female, other]
 *         description: Filtrar por género
 *       - in: query
 *         name: blood_type
 *         schema:
 *           type: string
 *           enum: [A+, A-, B+, B-, AB+, AB-, O+, O-]
 *         description: Filtrar por tipo de sangre
 *       - in: query
 *         name: marital_status
 *         schema:
 *           type: string
 *           enum: [SOLTERO, CASADO, DIVORCIADO, VIUDO, UNION_LIBRE]
 *         description: Filtrar por estado civil
 *       - in: query
 *         name: insurance_type
 *         schema:
 *           type: string
 *           enum: [IMSS, ISSSTE, PEMEX, SEDENA, SEMAR, PRIVADO, OTRO]
 *         description: Filtrar por tipo de seguro
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filtrar por ciudad
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Filtrar por estado
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Filtrar por país
 *       - in: query
 *         name: min_age
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Edad mínima
 *       - in: query
 *         name: max_age
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Edad máxima
 *       - in: query
 *         name: registration_date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de registro desde
 *       - in: query
 *         name: registration_date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de registro hasta
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [first_name, last_name, date_of_birth, registration_date, created_at]
 *           default: created_at
 *         description: Campo por el cual ordenar
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Orden de clasificación
 *     responses:
 *       200:
 *         description: Lista de pacientes obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PatientListResponse'
 *       400:
 *         description: Parámetros de consulta inválidos
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
  generalRateLimit, // Rate limiting general
  authenticate, // Verificar autenticación
  requireClinicAdmin, // Solo administradores de clínica o sistema
  validateSchema(PatientFiltersSchema, 'query'), // Validar parámetros de consulta
  patientController.listPatients // Ejecutar controlador
);

/**
 * @swagger
 * /api/clinics/{clinicId}/patients/stats:
 *   get:
 *     summary: Obtener estadísticas de pacientes
 *     description: Obtiene estadísticas generales de los pacientes de la clínica
 *     tags: [Patients]
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
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PatientStatsResponse'
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
  '/stats',
  generalRateLimit, // Rate limiting general
  authenticate, // Verificar autenticación
  requireClinicAdmin, // Solo administradores de clínica o sistema
  patientController.getPatientStats // Ejecutar controlador
);

/**
 * @swagger
 * /api/clinics/{clinicId}/patients/{patientId}:
 *   get:
 *     summary: Obtener un paciente por ID
 *     description: Obtiene los detalles de un paciente específico
 *     tags: [Patients]
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
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del paciente
 *     responses:
 *       200:
 *         description: Paciente obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Patient'
 *       404:
 *         description: Paciente no encontrado
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
  '/:patientId',
  generalRateLimit, // Rate limiting general
  authenticate, // Verificar autenticación
  requireClinicAdmin, // Solo administradores de clínica o sistema
  patientController.getPatientById // Ejecutar controlador
);

/**
 * @swagger
 * /api/clinics/{clinicId}/patients/{patientId}:
 *   put:
 *     summary: Actualizar un paciente
 *     description: Actualiza los datos de un paciente existente
 *     tags: [Patients]
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
 *             $ref: '#/components/schemas/UpdatePatientRequest'
 *     responses:
 *       200:
 *         description: Paciente actualizado exitosamente
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
 *                   example: "Paciente actualizado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Patient'
 *       400:
 *         description: Datos de entrada inválidos
 *       404:
 *         description: Paciente no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       429:
 *         description: Demasiadas solicitudes
 *       500:
 *         description: Error interno del servidor
 */
router.put(
  '/:patientId',
  generalRateLimit, // Rate limiting general
  authenticate, // Verificar autenticación
  requireClinicAdmin, // Solo administradores de clínica o sistema
  validateSchema(UpdatePatientSchema, 'body'), // Validar datos de entrada
  patientController.updatePatient // Ejecutar controlador
);

/**
 * @swagger
 * /api/clinics/{clinicId}/patients/{patientId}/status:
 *   patch:
 *     summary: Cambiar estado de un paciente
 *     description: Activa o desactiva un paciente
 *     tags: [Patients]
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
 *             required:
 *               - is_active
 *             properties:
 *               is_active:
 *                 type: boolean
 *                 description: Nuevo estado del paciente
 *     responses:
 *       200:
 *         description: Estado del paciente cambiado exitosamente
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
 *                   example: "Paciente activado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Patient'
 *       400:
 *         description: Datos de entrada inválidos
 *       404:
 *         description: Paciente no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       429:
 *         description: Demasiadas solicitudes
 *       500:
 *         description: Error interno del servidor
 */
router.patch(
  '/:patientId/status',
  strictRateLimit, // Rate limiting estricto para cambios de estado
  authenticate, // Verificar autenticación
  requireClinicAdmin, // Solo administradores de clínica o sistema
  patientController.togglePatientStatus // Ejecutar controlador
);

export default router;