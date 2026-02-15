/**
 * =================================================================
 * APLICACIÓN PRINCIPAL - SISTEMA EXPEDIENTES DENTALES
 * =================================================================
 * 
 * Este archivo configura la aplicación Express con todos los
 * middlewares necesarios para el sistema de expedientes dentales.
 * 
 * CARACTERÍSTICAS:
 * 1. Configuración de seguridad (CORS, Helmet, Rate Limiting)
 * 2. Middlewares de logging y auditoría
 * 3. Manejo de errores centralizado
 * 4. Rutas de autenticación y API
 * 5. Cumplimiento normativo (NOM-024, NOM-013)
 * 
 * =================================================================
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// Configuración
import { config, isDevelopment, isProduction } from './config/env';
import { initializeSupabase, testSupabaseConnection } from './config/supabase';
import { setupSwagger } from './config/swagger';

// Rutas
import authRoutes from './routes/auth';
import clinicRoutes from './routes/clinics';
import patientRoutes from './routes/patients';
import appointmentRoutes from './routes/appointments';
import notificationRoutes from './routes/notifications';
import clinicalNotesRoutes from './routes/clinical-notes';

// logger
import logger from './config/logger';

// Tipos
interface CustomError extends Error {
  status?: number;
  code?: string;
}

// =================================================================
// CONFIGURACIÓN DE LA APLICACIÓN
// =================================================================

/**
 * Crea y configura la aplicación Express
 * 
 * @returns Aplicación Express configurada
 */
export function createApp(): Application {
  const app: Application = express();

  // =================================================================
  // MIDDLEWARES DE SEGURIDAD
  // =================================================================

  /**
   * Helmet - Configuración de headers de seguridad
   * Protege contra vulnerabilidades comunes
   * 
   * NOTA: CSP se deshabilita para /api-docs para permitir Swagger UI
   */
  app.use((req, res, next) => {
    // Deshabilitar CSP solo para Swagger UI
    if (req.path.startsWith('/api-docs')) {
      return helmet({
        contentSecurityPolicy: false,
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      })(req, res, next);
    }
    
    // CSP normal para todas las demás rutas
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", config.supabase.url],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    })(req, res, next);
  });

  /**
   * CORS - Configuración de Cross-Origin Resource Sharing
   * Permite acceso controlado desde el frontend
   */
  app.use(cors({
    origin: function (origin, callback) {
      // Permitir requests sin origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      // Verificar si el origin está en la lista permitida
      if (config.security.corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      // En desarrollo, permitir localhost con cualquier puerto
      if (isDevelopment && origin.includes('localhost')) {
        return callback(null, true);
      }

      // Rechazar otros origins
      const msg = `CORS: Origin ${origin} no está permitido`;
      return callback(new Error(msg), false);
    },
    credentials: true, // Permitir cookies y headers de autenticación
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Clinic-ID', // Header personalizado para multi-tenant
      'X-Request-ID' // Header para trazabilidad
    ]
  }));

  /**
   * Rate Limiting - Protección contra ataques de fuerza bruta
   * Configuración específica para aplicaciones médicas
   */
  const limiter = rateLimit({
    windowMs: config.security.rateLimitWindowMs,
    max: config.security.rateLimitMaxRequests,
    message: {
      error: 'Demasiadas solicitudes',
      message: 'Has excedido el límite de solicitudes. Intenta nuevamente más tarde.',
      retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000)
    },
    standardHeaders: true, // Incluir headers de rate limit
    legacyHeaders: false,
    // Configuración especial para rutas de autenticación
    skip: (req) => {
      // En desarrollo, no aplicar rate limiting
      if (isDevelopment) return true;

      // Permitir health checks
      if (req.path === '/health') return true;

      return false;
    }
  });

  app.use(limiter);

  // =================================================================
  // MIDDLEWARES DE PROCESAMIENTO
  // =================================================================

  /**
   * Compresión de respuestas
   * Mejora el rendimiento reduciendo el tamaño de las respuestas
   */
  app.use(compression({
    // Solo comprimir respuestas mayores a 1KB
    threshold: 1024,
    // Nivel de compresión (1-9, 6 es un buen balance)
    level: 6,
    // Filtrar qué comprimir
    filter: (req: Request, res: Response) => {
      // No comprimir si el cliente no lo soporta
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Usar el filtro por defecto de compression
      return compression.filter(req, res);
    }
  }));

  /**
   * Parsing de JSON y URL-encoded
   * Configuración con límites apropiados para aplicaciones médicas
   */
  app.use(express.json({
    limit: '10mb', // Permitir archivos de imágenes médicas
    verify: (req, res, buf) => {
      // Verificar que el JSON sea válido
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        throw new Error('JSON inválido');
      }
    }
  }));

  app.use(express.urlencoded({
    extended: true,
    limit: '10mb'
  }));

  // =================================================================
  // MIDDLEWARES DE LOGGING
  // =================================================================

  /**
   * Morgan - Logging de requests HTTP
   * Configuración avanzada con Winston para diferentes niveles de log
   */
  
  // Formato personalizado para requests HTTP
  const morganFormat = isDevelopment 
    ? ':method :url :status :response-time ms - :res[content-length]'
    : ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms';

  // Morgan para requests exitosos (2xx y 3xx)
  app.use(morgan(morganFormat, {
    skip: (req, res) => res.statusCode >= 400,
    stream: {
      write: (message: string) => {
        logger.info(`📥 HTTP ${message.trim()}`);
      }
    }
  }));

  // Morgan para requests con errores del cliente (4xx)
  app.use(morgan(morganFormat, {
    skip: (req, res) => res.statusCode < 400 || res.statusCode >= 500,
    stream: {
      write: (message: string) => {
        logger.warn(`⚠️ HTTP CLIENT ERROR ${message.trim()}`);
      }
    }
  }));

  // Morgan para errores del servidor (5xx)
  app.use(morgan(morganFormat, {
    skip: (req, res) => res.statusCode < 500,
    stream: {
      write: (message: string) => {
        logger.error(`🚨 HTTP SERVER ERROR ${message.trim()}`);
      }
    }
  }));

  /**
   * Middleware personalizado para auditoría médica
   * Cumple con requisitos de NOM-024-SSA3-2012
   */
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Agregar ID único a cada request para trazabilidad
    req.headers['x-request-id'] = req.headers['x-request-id'] ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Timestamp para auditoría
    (req as any).startTime = Date.now();

    // Log de auditoría para operaciones sensibles
    if (config.compliance.enableAuditLogs) {
      const sensitiveRoutes = ['/auth', '/patients', '/appointments', '/medical-records'];
      const isSensitive = sensitiveRoutes.some(route => req.path.startsWith(route));

      if (isSensitive) {
        logger.info(`🔍 AUDIT: ${req.method} ${req.path}`, {
          requestId: req.headers['x-request-id'],
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
      }
    }

    next();
  });

  // =================================================================
  // RUTAS DE SALUD Y DIAGNÓSTICO
  // =================================================================

  /**
   * @swagger
   * /health:
   *   get:
   *     tags:
   *       - Health
   *     summary: Verificación del estado del sistema
   *     description: Endpoint para verificar el estado de salud del sistema y sus dependencias
   *     responses:
   *       200:
   *         description: Sistema funcionando correctamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: "healthy"
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 environment:
   *                   type: string
   *                   example: "development"
   *                 version:
   *                   type: string
   *                   example: "1.0.0"
   *                 uptime:
   *                   type: number
   *                   description: "Tiempo de actividad en segundos"
   *                 responseTime:
   *                   type: string
   *                   example: "15ms"
   *                 services:
   *                   type: object
   *                   properties:
   *                     supabase:
   *                       type: string
   *                       example: "connected"
   *                     database:
   *                       type: string
   *                       example: "available"
   *       503:
   *         description: Sistema no disponible
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: "unhealthy"
   *                 error:
   *                   type: string
   *                   example: "Health check failed"
   */
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();

      // Verificar conexión con Supabase
      const supabaseOk = await testSupabaseConnection();

      const responseTime = Date.now() - startTime;

      const healthStatus = {
        status: supabaseOk ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: config.server.environment,
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        responseTime: `${responseTime}ms`,
        services: {
          supabase: supabaseOk ? 'connected' : 'disconnected',
          database: supabaseOk ? 'available' : 'unavailable'
        },
        compliance: {
          auditEnabled: config.compliance.enableAuditLogs,
          encryptionEnabled: config.compliance.enableEncryption,
          dataRetentionYears: config.compliance.dataRetentionYears
        }
      };

      const statusCode = supabaseOk ? 200 : 503;
      res.status(statusCode).json(healthStatus);

    } catch (error) {
      logger.error('❌ Error en health check:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });

  /**
   * @swagger
   * /info:
   *   get:
   *     tags:
   *       - Health
   *     summary: Información del sistema
   *     description: Retorna información básica sobre el sistema y sus características
   *     responses:
   *       200:
   *         description: Información del sistema obtenida exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 name:
   *                   type: string
   *                   example: "Sistema de Expedientes Dentales"
   *                 description:
   *                   type: string
   *                   example: "API Backend para gestión de expedientes clínicos dentales"
   *                 version:
   *                   type: string
   *                   example: "1.0.0"
   *                 environment:
   *                   type: string
   *                   example: "development"
   *                 features:
   *                   type: array
   *                   items:
   *                     type: string
   *                   example: ["Autenticación con Supabase", "Multi-tenant con RLS"]
   *                 endpoints:
   *                   type: object
   *                   properties:
   *                     health:
   *                       type: string
   *                       example: "/health"
   *                     auth:
   *                       type: string
   *                       example: "/auth/*"
   *                     api:
   *                       type: string
   *                       example: "/api/*"
   */
  app.get('/info', (req: Request, res: Response) => {
    res.json({
      name: 'Sistema de Expedientes Dentales',
      description: 'API Backend para gestión de expedientes clínicos dentales',
      version: process.env.npm_package_version || '1.0.0',
      environment: config.server.environment,
      features: [
        'Autenticación con Supabase',
        'Multi-tenant con RLS',
        'Cumplimiento NOM-024-SSA3-2012',
        'Gestión de expedientes dentales',
        'Sistema FDI de numeración dental',
        'Almacenamiento de imágenes DICOM'
      ],
      endpoints: {
        health: '/health',
        auth: '/auth/*',
        api: '/api/*'
      }
    });
  });

  // =================================================================
  // DOCUMENTACIÓN API - SWAGGER
  // =================================================================

  /**
   * Configuración de Swagger UI para documentación de la API
   * Disponible en: http://localhost:3000/api-docs
   */
  setupSwagger(app);

  // =================================================================
  // RUTAS PRINCIPALES
  // =================================================================

  /**
   * Rutas de autenticación
   * Incluye registro, login, perfil, etc.
   */
  app.use('/auth', authRoutes);

  /**
   * Rutas de clínicas
   * Gestión completa de clínicas con soporte multi tenant.
   */
  app.use('/api/clinics', clinicRoutes);

  /**
   * Rutas de pacientes
   * Gestión completa de pacientes dentro de clínicas.
   */
  app.use('/api/clinics/:clinicId/patients', patientRoutes);

  /**
   * Rutas de notas clínicas
   * Gestión completa de notas clínicas con cumplimiento NOM-013 y NOM-024.
   */
  app.use('/api/clinics/:clinicId/clinical-notes', clinicalNotesRoutes);

  /**
   * Rutas de citas
   * Gestión completa de citas médicas con recordatorios.
   */
  app.use('/api/appointments', appointmentRoutes);

  /**
   * Rutas de notificaciones
   * Sistema de recordatorios y notificaciones para citas.
   */
  app.use('/api/notifications', notificationRoutes);

  // Ruta de prueba temporal
  app.get('/', (req: Request, res: Response) => {
    res.json({
      message: '🦷 Sistema de Expedientes Dentales - API Backend',
      status: 'running',
      timestamp: new Date().toISOString(),
      documentation: '/info',
      health: '/health'
    });
  });

  // =================================================================
  // MANEJO DE ERRORES
  // =================================================================

  /**
   * Middleware para rutas no encontradas
   */
  app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
      error: 'Ruta no encontrada',
      message: `La ruta ${req.method} ${req.originalUrl} no existe`,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
  });

  /**
   * Middleware global de manejo de errores
   * Cumple con estándares de logging médico
   */
  app.use((error: CustomError, req: Request, res: Response, next: NextFunction) => {
    // Log del error para auditoría
    logger.error('❌ Error en aplicación:', {
      error: error.message,
      stack: isDevelopment ? error.stack : undefined,
      requestId: req.headers['x-request-id'],
      method: req.method,
      path: req.path,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    // Determinar código de estado
    const statusCode = error.status || 500;

    // Respuesta de error
    const errorResponse = {
      error: true,
      message: error.message || 'Error interno del servidor',
      code: error.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'],
      // Solo incluir stack trace en desarrollo
      ...(isDevelopment && { stack: error.stack })
    };

    res.status(statusCode).json(errorResponse);
  });

  return app;
}

// =================================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// =================================================================

/**
 * Inicializa todos los servicios necesarios
 */
export async function initializeApp(): Promise<Application> {
  try {
    logger.info('🚀 Inicializando Sistema de Expedientes Dentales...');

    // Inicializar Supabase
    initializeSupabase();

    // Verificar conexión con Supabase
    const supabaseConnected = await testSupabaseConnection();
    if (!supabaseConnected) {
      throw new Error('No se pudo conectar con Supabase');
    }

    // Crear aplicación Express
    const app = createApp();

    // Log de inicio de aplicación
    logger.info('🚀 Aplicación iniciada correctamente');
    logger.info(`📊 Modo: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔧 Nivel de log: ${process.env.LOG_LEVEL || 'info'}`);
    return app;

  } catch (error) {
    logger.error('❌ Error al inicializar aplicación:', error);
    throw error;
  }
}

// =================================================================
// EXPORTACIONES
// =================================================================

export default createApp;

// =================================================================
// NOTAS DE IMPLEMENTACIÓN
// =================================================================
/*

1. **SEGURIDAD**:
   - Headers de seguridad con Helmet
   - CORS configurado específicamente
   - Rate limiting para prevenir ataques
   - Validación de JSON para prevenir ataques

2. **CUMPLIMIENTO NORMATIVO**:
   - Logging de auditoría según NOM-024
   - Trazabilidad de requests
   - Headers personalizados para multi-tenant
   - Configuración de retención de datos

3. **PERFORMANCE**:
   - Compresión de respuestas
   - Límites apropiados para archivos médicos
   - Configuración optimizada de middlewares

4. **MONITOREO**:
   - Health checks completos
   - Logging estructurado
   - Métricas de rendimiento
   - Información del sistema

5. **MANTENIBILIDAD**:
   - Configuración centralizada
   - Manejo de errores consistente
   - Código bien documentado
   - Separación clara de responsabilidades

*/