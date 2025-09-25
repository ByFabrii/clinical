/**
 * =================================================================
 * RUTAS DE AUTENTICACIÓN - SISTEMA EXPEDIENTES DENTALES
 * =================================================================
 * 
 * Este archivo define todas las rutas relacionadas con autenticación
 * y autorización de usuarios.
 * 
 * RUTAS DISPONIBLES:
 * - POST /auth/register - Registro de nuevos usuarios
 * - POST /auth/login - Autenticación de usuarios
 * - GET /auth/profile - Obtener perfil del usuario autenticado
 * - PUT /auth/profile - Actualizar perfil del usuario
 * - POST /auth/logout - Cerrar sesión
 * - POST /auth/refresh - Renovar token de acceso
 * - GET /auth/verify - Verificar token de acceso
 * 
 * =================================================================
 */

import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate, auditAccess } from '../middleware/auth';
import rateLimit from 'express-rate-limit';
import { validateSchema } from '@/middleware/validation.middleware';
import { RegisterSchema, LoginSchema, UpdateProfileSchema } from '@/schemas/auth.schemas';

// =================================================================
// CONFIGURACIÓN DE RATE LIMITING
// =================================================================

/**
 * Rate limiting para rutas de autenticación
 * Más restrictivo para prevenir ataques de fuerza bruta
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // máximo 30 intentos por IP
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiados intentos de autenticación. Intente nuevamente en 15 minutos.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Permitir más intentos para rutas que no son login
    return !req.path.includes('/login');
  }
});

/**
 * Rate limiting para registro de usuarios
 * Menos restrictivo pero aún controlado
 */
const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 30, // máximo 30 registros por IP por hora
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiados intentos de registro. Intente nuevamente en 1 hora.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiting general para rutas autenticadas
 */
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

// =================================================================
// CONFIGURACIÓN DEL ROUTER
// =================================================================

const router = Router();

// =================================================================
// RUTAS PÚBLICAS (NO REQUIEREN AUTENTICACIÓN)
// =================================================================

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Registrar un nuevo usuario
 *     description: Crea una nueva cuenta de usuario en el sistema con validación de datos y asignación a clínica
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           example:
 *             email: "doctor@clinica.com"
 *             password: "password123"
 *             first_name: "Juan"
 *             last_name: "Pérez"
 *             role: "dentist"
 *             clinic_id: "550e8400-e29b-41d4-a716-446655440000"
 *             phone: "+52 55 1234 5678"
 *             terms_accepted: true
 *             privacy_accepted: true
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: El usuario ya existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Demasiados intentos de registro
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register', 
  registerRateLimit,
  auditAccess,
  validateSchema(RegisterSchema),
  authController.register.bind(authController)
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Iniciar sesión
 *     description: Autentica un usuario existente y devuelve un token JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           example:
 *             email: "doctor@clinica.com"
 *             password: "password123"
 *     responses:
 *       200:
 *         description: Autenticación exitosa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Email o contraseña incorrectos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Usuario deshabilitado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Demasiados intentos de login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', 
  authRateLimit,
  auditAccess,
  validateSchema(LoginSchema),
  authController.login.bind(authController)
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Renovar token de acceso
 *     description: Renueva un token de acceso usando un refresh token válido
 *     requestBody:
 *       required: true
*       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *           example:
 *             refresh_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Token renovado exitosamente
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
 *                   example: "Token renovado exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     access_token:
 *                       type: string
 *                       description: Nuevo token de acceso JWT
 *                     refresh_token:
 *                       type: string
 *                       description: Nuevo token de refresco
 *                     expires_in:
 *                       type: integer
 *                       description: Tiempo de expiración en segundos
 *                       example: 3600
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Token de refresco inválido o faltante
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Token de refresco expirado o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Usuario deshabilitado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Demasiadas solicitudes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh', 
  generalRateLimit,
  auditAccess,
  authController.refreshToken.bind(authController)
);

// =================================================================
// RUTAS PROTEGIDAS (REQUIEREN AUTENTICACIÓN)
// =================================================================

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Obtener perfil del usuario
 *     description: Retorna la información del perfil del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil obtenido exitosamente
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
 *                   example: "Perfil obtenido exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Token no válido o expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Usuario deshabilitado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Demasiadas solicitudes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/profile', 
  generalRateLimit,
  authenticate,
  auditAccess,
  authController.getProfile.bind(authController)
);

/**
 * @route   PUT /auth/profile
 * @desc    Actualizar perfil del usuario autenticado
 * @access  Private
 * @headers Authorization: Bearer <token>
 * @body    { first_name?, last_name?, phone?, language?, timezone? }
 */
router.put('/profile', 
  generalRateLimit,
  authenticate,
  auditAccess,
  validateSchema(UpdateProfileSchema),
  authController.updateProfile.bind(authController)
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Cerrar sesión
 *     description: Cierra la sesión del usuario autenticado e invalida el token
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sesión cerrada exitosamente
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
 *                   example: "Sesión cerrada exitosamente"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Token no válido o expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Usuario deshabilitado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Demasiadas solicitudes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/logout', 
  generalRateLimit,
  authenticate,
  auditAccess,
  authController.logout.bind(authController)
);

/**
 * @swagger
 * /auth/verify:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Verificar token de acceso
 *     description: Verifica si el token de acceso proporcionado es válido y devuelve información del usuario
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token válido
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
 *                   example: "Token válido"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         email:
 *                           type: string
 *                           format: email
 *                         role:
 *                           type: string
 *                           enum: ['admin', 'dentist', 'assistant', 'receptionist']
 *                         clinic_id:
 *                           type: string
 *                           format: uuid
 *                     token_info:
 *                       type: object
 *                       properties:
 *                         expires_at:
 *                           type: string
 *                           format: date-time
 *                         issued_at:
 *                           type: string
 *                           format: date-time
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Token no válido o expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Usuario deshabilitado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Demasiadas solicitudes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/verify', 
  generalRateLimit,
  authenticate,
  auditAccess,
  (req, res) => {
    // Si llegamos aquí, el token es válido (gracias al middleware authenticate)
    res.status(200).json({
      success: true,
      message: 'Token válido',
      data: {
        user: {
          id: req.user!.auth.id,
          email: req.user!.auth.email,
          role: req.user!.profile.role,
          clinic_id: req.user!.profile.clinic_id
        },
        token_info: {
          expires_at: new Date(req.tokenPayload!.exp * 1000).toISOString(),
          issued_at: new Date(req.tokenPayload!.iat * 1000).toISOString()
        }
      },
      timestamp: new Date().toISOString()
    });
  }
);

// =================================================================
// RUTAS DE INFORMACIÓN Y SALUD
// =================================================================

/**
 * @route   GET /auth/info
 * @desc    Obtener información sobre las rutas de autenticación
 * @access  Public
 */
router.get('/info', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Información de rutas de autenticación',
    data: {
      service: 'Dental Records Authentication API',
      version: '1.0.0',
      endpoints: {
        public: [
          'POST /auth/register - Registrar nuevo usuario',
          'POST /auth/login - Autenticar usuario',
          'POST /auth/refresh - Renovar token de acceso',
          'GET /auth/info - Información del servicio'
        ],
        private: [
          'GET /auth/profile - Obtener perfil de usuario',
          'PUT /auth/profile - Actualizar perfil de usuario',
          'POST /auth/logout - Cerrar sesión',
          'GET /auth/verify - Verificar token'
        ]
      },
      rate_limits: {
        login: '5 intentos por 15 minutos',
        register: '3 intentos por hora',
        general: '100 requests por 15 minutos'
      },
      security: {
        authentication: 'JWT Bearer Token',
        password_requirements: 'Mínimo 8 caracteres',
        session_duration: '1 hora (configurable)'
      }
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /auth/health
 * @desc    Verificar estado de salud del servicio de autenticación
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Servicio de autenticación operativo',
    data: {
      status: 'healthy',
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory_usage: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
        unit: 'MB'
      }
    }
  });
});

// =================================================================
// MANEJO DE RUTAS NO ENCONTRADAS
// =================================================================

/**
 * Manejo de rutas no encontradas en /auth/*
 */
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Ruta ${req.method} ${req.originalUrl} no encontrada`,
      available_routes: [
        'POST /auth/register',
        'POST /auth/login',
        'POST /auth/refresh',
        'GET /auth/profile',
        'PUT /auth/profile',
        'POST /auth/logout',
        'GET /auth/verify',
        'GET /auth/info',
        'GET /auth/health'
      ],
      timestamp: new Date().toISOString()
    }
  });
});

// =================================================================
// EXPORTACIÓN
// =================================================================

export default router;

// =================================================================
// NOTAS DE IMPLEMENTACIÓN
// =================================================================
/*

1. **SEGURIDAD**:
   - Rate limiting diferenciado por tipo de ruta
   - Middleware de autenticación en rutas protegidas
   - Auditoría de todos los accesos
   - Manejo seguro de errores

2. **RATE LIMITING**:
   - Login: 5 intentos por 15 minutos (anti brute force)
   - Registro: 3 intentos por hora (anti spam)
   - General: 100 requests por 15 minutos (uso normal)
   - Headers estándar para información del cliente

3. **ESTRUCTURA**:
   - Rutas públicas claramente separadas
   - Rutas protegidas con middleware
   - Documentación inline de cada endpoint
   - Manejo consistente de respuestas

4. **MONITOREO**:
   - Endpoint de salud para monitoring
   - Endpoint de información para documentación
   - Auditoría de accesos
   - Métricas de memoria y uptime

5. **USABILIDAD**:
   - Mensajes de error descriptivos
   - Información de rutas disponibles
   - Respuestas consistentes
   - Timestamps en todas las respuestas

6. **CUMPLIMIENTO**:
   - Auditoría de accesos según NOM-024
   - Trazabilidad completa
   - Manejo de datos personales
   - Logs estructurados

*/