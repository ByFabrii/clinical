import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { clinicController } from '../controllers/clinicController';
import { authenticate, requireClinicAdmin, requireSystemAdmin } from '../middleware/auth';
import { validateSchema } from '../middleware/validation.middleware';
import { CreateClinicSchema, UpdateClinicSchema, ClinicFiltersSchema } from '../schemas/clinics.schemas';

// Rate limiting específico para clínicas
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
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
  max: 10, // máximo 10 requests por IP por hora para operaciones críticas
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

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Clinic:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único de la clínica
 *         clinic_name:
 *           type: string
 *           description: Nombre de la clínica
 *         clinic_code:
 *           type: string
 *           description: Código único de la clínica
 *         email:
 *           type: string
 *           format: email
 *           description: Email de contacto
 *         phone:
 *           type: string
 *           description: Teléfono de contacto
 *         website:
 *           type: string
 *           format: uri
 *           description: Sitio web
 *         street:
 *           type: string
 *           description: Dirección
 *         neighborhood:
 *           type: string
 *           description: Colonia
 *         city:
 *           type: string
 *           description: Ciudad
 *         state:
 *           type: string
 *           description: Estado
 *         postal_code:
 *           type: string
 *           description: Código postal
 *         country:
 *           type: string
 *           description: País
 *         rfc:
 *           type: string
 *           description: RFC fiscal
 *         business_name:
 *           type: string
 *           description: Razón social
 *         tax_regime:
 *           type: string
 *           description: Régimen fiscal
 *         timezone:
 *           type: string
 *           description: Zona horaria
 *         currency:
 *           type: string
 *           description: Moneda
 *         language:
 *           type: string
 *           description: Idioma
 *         subscription_plan:
 *           type: string
 *           enum: [basic, professional, enterprise]
 *           description: Plan de suscripción
 *         max_users:
 *           type: integer
 *           description: Máximo número de usuarios
 *         max_patients:
 *           type: integer
 *           description: Máximo número de pacientes
 *         is_active:
 *           type: boolean
 *           description: Estado de la clínica
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de actualización
 *     
 *     CreateClinicRequest:
 *       type: object
 *       required:
 *         - clinic_name
 *         - clinic_code
 *       properties:
 *         clinic_name:
 *           type: string
 *           minLength: 2
 *           maxLength: 200
 *           description: Nombre de la clínica
 *         clinic_code:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           pattern: '^[A-Z0-9_-]+$'
 *           description: Código único de la clínica
 *         email:
 *           type: string
 *           format: email
 *           description: Email de contacto
 *         phone:
 *           type: string
 *           pattern: '^[+]?[0-9\s\-\(\)]{10,20}$'
 *           description: Teléfono de contacto
 *         website:
 *           type: string
 *           format: uri
 *           description: Sitio web
 *         street:
 *           type: string
 *           maxLength: 255
 *           description: Dirección
 *         neighborhood:
 *           type: string
 *           maxLength: 100
 *           description: Colonia
 *         city:
 *           type: string
 *           maxLength: 100
 *           description: Ciudad
 *         state:
 *           type: string
 *           maxLength: 100
 *           description: Estado
 *         postal_code:
 *           type: string
 *           pattern: '^[0-9]{5}$'
 *           description: Código postal (5 dígitos)
 *         country:
 *           type: string
 *           maxLength: 100
 *           default: México
 *           description: País
 *         rfc:
 *           type: string
 *           pattern: '^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$'
 *           description: RFC fiscal mexicano
 *         business_name:
 *           type: string
 *           maxLength: 200
 *           description: Razón social
 *         tax_regime:
 *           type: string
 *           maxLength: 100
 *           description: Régimen fiscal
 *         timezone:
 *           type: string
 *           default: America/Mexico_City
 *           description: Zona horaria
 *         currency:
 *           type: string
 *           length: 3
 *           default: MXN
 *           description: Moneda
 *         language:
 *           type: string
 *           length: 2
 *           default: es
 *           description: Idioma
 *         subscription_plan:
 *           type: string
 *           enum: [basic, professional, enterprise]
 *           default: basic
 *           description: Plan de suscripción
 *         max_users:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 5
 *           description: Máximo número de usuarios
 *         max_patients:
 *           type: integer
 *           minimum: 1
 *           maximum: 100000
 *           default: 1000
 *           description: Máximo número de pacientes
 *     
 *     UpdateClinicRequest:
 *       type: object
 *       properties:
 *         clinic_name:
 *           type: string
 *           minLength: 2
 *           maxLength: 200
 *           description: Nombre de la clínica
 *         email:
 *           type: string
 *           format: email
 *           description: Email de contacto
 *         phone:
 *           type: string
 *           pattern: '^[+]?[0-9\s\-\(\)]{10,20}$'
 *           description: Teléfono de contacto
 *         website:
 *           type: string
 *           format: uri
 *           description: Sitio web
 *         street:
 *           type: string
 *           maxLength: 255
 *           description: Dirección
 *         neighborhood:
 *           type: string
 *           maxLength: 100
 *           description: Colonia
 *         city:
 *           type: string
 *           maxLength: 100
 *           description: Ciudad
 *         state:
 *           type: string
 *           maxLength: 100
 *           description: Estado
 *         postal_code:
 *           type: string
 *           pattern: '^[0-9]{5}$'
 *           description: Código postal (5 dígitos)
 *         country:
 *           type: string
 *           maxLength: 100
 *           description: País
 *         rfc:
 *           type: string
 *           pattern: '^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$'
 *           description: RFC fiscal mexicano
 *         business_name:
 *           type: string
 *           maxLength: 200
 *           description: Razón social
 *         tax_regime:
 *           type: string
 *           maxLength: 100
 *           description: Régimen fiscal
 *         timezone:
 *           type: string
 *           description: Zona horaria
 *         currency:
 *           type: string
 *           length: 3
 *           description: Moneda
 *         language:
 *           type: string
 *           length: 2
 *           description: Idioma
 *         subscription_plan:
 *           type: string
 *           enum: [basic, professional, enterprise]
 *           description: Plan de suscripción
 *         max_users:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           description: Máximo número de usuarios
 *         max_patients:
 *           type: integer
 *           minimum: 1
 *           maximum: 100000
 *           description: Máximo número de pacientes
 *         is_active:
 *           type: boolean
 *           description: Estado de la clínica
 *     
 *     ClinicListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Clinic'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               description: Página actual
 *             limit:
 *               type: integer
 *               description: Elementos por página
 *             total:
 *               type: integer
 *               description: Total de elementos
 *             totalPages:
 *               type: integer
 *               description: Total de páginas
 *     
 *     ClinicStatsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             totalUsers:
 *               type: integer
 *               description: Total de usuarios
 *             activeUsers:
 *               type: integer
 *               description: Usuarios activos
 *             totalPatients:
 *               type: integer
 *               description: Total de pacientes
 *             activePatients:
 *               type: integer
 *               description: Pacientes activos
 *             totalAppointments:
 *               type: integer
 *               description: Total de citas
 *             appointmentsThisMonth:
 *               type: integer
 *               description: Citas este mes
 *             storageUsed:
 *               type: number
 *               description: Almacenamiento usado (MB)
 *             lastActivity:
 *               type: string
 *               format: date-time
 *               description: Última actividad
 */

/**
 * @swagger
 * /api/clinics:
 *   post:
 *     summary: Crear nueva clínica
 *     description: Crea una nueva clínica en el sistema. Solo administradores del sistema pueden crear clínicas.
 *     tags: [Clínicas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateClinicRequest'
 *           example:
 *             clinic_name: "Clínica Dental Sonrisa"
 *             clinic_code: "CDS001"
 *             email: "contacto@clinicasonrisa.com"
 *             phone: "+52 55 1234 5678"
 *             website: "https://clinicasonrisa.com"
 *             street: "Av. Reforma 123"
 *             neighborhood: "Centro"
 *             city: "Ciudad de México"
 *             state: "CDMX"
 *             postal_code: "06000"
 *             rfc: "CDS010101ABC"
 *             business_name: "Clínica Dental Sonrisa S.A. de C.V."
 *             subscription_plan: "professional"
 *             max_users: 10
 *             max_patients: 5000
 *     responses:
 *       201:
 *         description: Clínica creada exitosamente
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
 *                   example: "Clínica creada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Clinic'
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Permisos insuficientes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Clínica ya existe (código o email duplicado)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Demasiadas peticiones
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
router.post(
  '/',
  strictRateLimit, // Rate limiting estricto para creación
  authenticate, // Verificar autenticación
  requireSystemAdmin, // Solo administradores del sistema
  validateSchema(CreateClinicSchema, 'body'), // Validar datos de entrada
  clinicController.createClinic // Ejecutar controlador
);

/**
 * @swagger
 * /api/clinics:
 *   get:
 *     summary: Listar clínicas
 *     description: Obtiene una lista paginada de clínicas con filtros opcionales. Los administradores del sistema ven todas las clínicas, otros usuarios solo ven su clínica.
 *     tags: [Clínicas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nombre o código de clínica
 *         example: "Dental"
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filtrar por estado activo/inactivo
 *         example: true
 *       - in: query
 *         name: subscription_plan
 *         schema:
 *           type: string
 *           enum: [basic, professional, enterprise]
 *         description: Filtrar por plan de suscripción
 *         example: "professional"
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filtrar por ciudad
 *         example: "Ciudad de México"
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Filtrar por estado
 *         example: "CDMX"
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
 *         description: Elementos por página
 *         example: 10
 *     responses:
 *       200:
 *         description: Lista de clínicas obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClinicListResponse'
 *       400:
 *         description: Parámetros de consulta inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Demasiadas peticiones
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
  '/',
  generalRateLimit, // Rate limiting general
  authenticate, // Verificar autenticación
  validateSchema(ClinicFiltersSchema, 'query'), // Validar parámetros de consulta
  clinicController.listClinics // Ejecutar controlador
);

/**
 * @swagger
 * /api/clinics/{id}:
 *   get:
 *     summary: Obtener clínica por ID
 *     description: Obtiene los detalles de una clínica específica. Los usuarios solo pueden ver su propia clínica, excepto los administradores del sistema.
 *     tags: [Clínicas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID único de la clínica
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Clínica obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Clinic'
 *       400:
 *         description: ID de clínica requerido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Acceso denegado a esta clínica
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
 *         description: Demasiadas peticiones
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
  '/:id',
  generalRateLimit, // Rate limiting general
  authenticate, // Verificar autenticación
  // TODO: Agregar middleware de verificación de clínica
  clinicController.getClinicById // Ejecutar controlador
);

/**
 * @swagger
 * /api/clinics/{id}:
 *   put:
 *     summary: Actualizar clínica
 *     description: Actualiza los datos de una clínica. Solo administradores del sistema y administradores de la clínica pueden actualizar.
 *     tags: [Clínicas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID único de la clínica
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateClinicRequest'
 *           example:
 *             clinic_name: "Clínica Dental Sonrisa Actualizada"
 *             email: "nuevo@clinicasonrisa.com"
 *             phone: "+52 55 9876 5432"
 *             subscription_plan: "enterprise"
 *             max_users: 20
 *     responses:
 *       200:
 *         description: Clínica actualizada exitosamente
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
 *                   example: "Clínica actualizada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Clinic'
 *       400:
 *         description: Datos de entrada inválidos o ID requerido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Permisos insuficientes
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
 *         description: Demasiadas peticiones
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
router.put(
  '/:id',
  generalRateLimit, // Rate limiting general
  authenticate, // Verificar autenticación
  requireClinicAdmin, // Solo administradores de clínica o sistema
  validateSchema(UpdateClinicSchema, 'body'), // Validar datos de entrada
  // TODO: Agregar middleware de verificación de clínica
  clinicController.updateClinic // Ejecutar controlador
);

/**
 * @swagger
 * /api/clinics/{id}/status:
 *   put:
 *     summary: Cambiar estado de clínica
 *     description: Activa o desactiva una clínica. Solo administradores del sistema pueden cambiar el estado.
 *     tags: [Clínicas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID único de la clínica
 *         example: "123e4567-e89b-12d3-a456-426614174000"
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
 *                 description: Nuevo estado de la clínica
 *                 example: false
 *     responses:
 *       200:
 *         description: Estado de clínica cambiado exitosamente
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
 *                   example: "Clínica desactivada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Clinic'
 *       400:
 *         description: Datos de entrada inválidos o ID requerido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Permisos insuficientes
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
 *         description: Demasiadas peticiones
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
router.patch(
  '/:id/status',
  strictRateLimit, // Rate limiting estricto para cambios de estado
  authenticate, // Verificar autenticación
  requireSystemAdmin, // Solo administradores del sistema
  clinicController.toggleClinicStatus // Ejecutar controlador
);

/**
 * @swagger
 * /api/clinics/{id}/stats:
 *   get:
 *     summary: Obtener estadísticas de clínica
 *     description: Obtiene estadísticas detalladas de una clínica (usuarios, pacientes, citas, almacenamiento). Solo administradores pueden ver estadísticas.
 *     tags: [Clínicas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID único de la clínica
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClinicStatsResponse'
 *       400:
 *         description: ID de clínica requerido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Permisos insuficientes
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
 *         description: Demasiadas peticiones
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
  '/:id/stats',
  generalRateLimit, // Rate limiting general
  authenticate, // Verificar autenticación
  requireClinicAdmin, // Solo administradores de clínica o sistema
  // TODO: Agregar middleware de verificación de clínica
  clinicController.getClinicStats // Ejecutar controlador
);

export default router;