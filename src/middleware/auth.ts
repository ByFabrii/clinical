/**
 * =================================================================
 * MIDDLEWARE DE AUTENTICACIÓN - SISTEMA EXPEDIENTES DENTALES
 * =================================================================
 * 
 * Este middleware maneja la autenticación y autorización de usuarios
 * en todas las rutas protegidas de la API.
 * 
 * RESPONSABILIDADES:
 * 1. Verificar tokens JWT
 * 2. Validar permisos de usuario
 * 3. Inyectar información de usuario en request
 * 4. Manejar errores de autenticación
 * 5. Auditoría de accesos
 * 
 * =================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { config } from '../config/env';
import logger from '../config/logger';

// Tipos
import {
  UserRole,
  UserStatus,
  JWTPayload,
  CompleteUser,
  AuthError,
  AuthErrorCode
} from '../types/auth';

// =================================================================
// EXTENSIÓN DE REQUEST PARA TYPESCRIPT
// =================================================================

/**
 * Extensión del objeto Request de Express para incluir
 * información del usuario autenticado
 */
declare global {
  namespace Express {
    interface Request {
      user?: CompleteUser;
      token?: string;
      tokenPayload?: JWTPayload;
      clientIp?: string;
      userAgent?: string;
    }
  }
}

// =================================================================
// MIDDLEWARE PRINCIPAL DE AUTENTICACIÓN
// =================================================================

/**
 * Middleware principal que verifica la autenticación del usuario
 * 
 * PROCESO:
 * 1. Extraer token del header Authorization
 * 2. Verificar validez del token
 * 3. Obtener información completa del usuario
 * 4. Validar estado del usuario
 * 5. Inyectar información en el request
 * 6. Continuar con la siguiente función
 * 
 * @param req - Request de Express
 * @param res - Response de Express
 * @param next - Función next de Express
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('Iniciando verificación de autenticación', {
      path: req.path,
      method: req.method,
      ip: getClientIp(req),
      userAgent: req.get('User-Agent'),
      action: 'auth_verification_start',
      timestamp: new Date().toISOString()
    });
    
    // 1. Extraer token del header
    const token = extractTokenFromHeader(req);
    if (!token) {
      return sendAuthError(res, AuthErrorCode.TOKEN_MISSING, 'Token de acceso requerido');
    }
    
    // 2. Verificar token
    const tokenVerification = await authService.verifyToken(token);
    if (!tokenVerification.valid) {
      const errorCode = tokenVerification.expired 
        ? AuthErrorCode.TOKEN_EXPIRED 
        : AuthErrorCode.TOKEN_INVALID;
      return sendAuthError(res, errorCode, tokenVerification.error || 'Token inválido');
    }
    
    const payload = tokenVerification.payload!;
    
    // 3. Obtener usuario completo
    const user = await authService.getCompleteUser(payload.sub);
    
    // 4. Validar estado del usuario
    if (!user.profile.is_active) {
      return sendAuthError(res, AuthErrorCode.USER_DISABLED, 'Usuario inactivo');
    }
    
    // 5. Inyectar información en el request
    req.user = user;
    req.token = token;
    req.tokenPayload = payload;
    req.clientIp = getClientIp(req);
    req.userAgent = req.get('User-Agent') || 'Unknown';
    
    logger.info('Usuario autenticado exitosamente', {
      userId: user.profile.id,
      email: user.profile.email,
      role: user.profile.role,
      clinicId: user.profile.clinic_id,
      path: req.path,
      method: req.method,
      ip: getClientIp(req),
      action: 'auth_success',
      timestamp: new Date().toISOString()
    });
    
    // 6. Continuar
    next();
    
  } catch (error) {
    logger.error('Error en proceso de autenticación', {
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
      path: req.path,
      method: req.method,
      ip: getClientIp(req),
      userAgent: req.get('User-Agent'),
      action: 'auth_error',
      timestamp: new Date().toISOString()
    });
    return sendAuthError(res, AuthErrorCode.AUTHENTICATION_FAILED, 'Error de autenticación');
  }
};

// =================================================================
// MIDDLEWARE DE AUTORIZACIÓN POR ROLES
// =================================================================

/**
 * Crea un middleware que verifica si el usuario tiene uno de los roles permitidos
 * 
 * @param allowedRoles - Array de roles permitidos
 * @returns Middleware de autorización
 */
export const authorize = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      logger.debug('Iniciando verificación de autorización', {
        allowedRoles,
        path: req.path,
        method: req.method,
        userId: req.user?.profile.id,
        userRole: req.user?.profile.role,
        action: 'authorization_check_start',
        timestamp: new Date().toISOString()
      });
      
      // Verificar que el usuario esté autenticado
      if (!req.user) {
        return sendAuthError(res, AuthErrorCode.AUTHENTICATION_FAILED, 'Usuario no autenticado');
      }
      
      // Verificar rol del usuario
      const userRole = req.user.profile.role;
      if (!allowedRoles.includes(userRole)) {
        logger.warn('Acceso denegado por permisos insuficientes', {
          userId: req.user.profile.id,
          email: req.user.profile.email,
          userRole,
          allowedRoles,
          path: req.path,
          method: req.method,
          ip: req.clientIp,
          action: 'access_denied',
          timestamp: new Date().toISOString()
        });
        return sendAuthError(res, AuthErrorCode.INSUFFICIENT_PERMISSIONS, 'Permisos insuficientes');
      }
      
      logger.info('Usuario autorizado exitosamente', {
        userId: req.user.profile.id,
        email: req.user.profile.email,
        userRole,
        allowedRoles,
        path: req.path,
        method: req.method,
        action: 'authorization_success',
        timestamp: new Date().toISOString()
      });
      next();
      
    } catch (error) {
      logger.error('Error en proceso de autorización', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        allowedRoles,
        path: req.path,
        method: req.method,
        userId: req.user?.profile.id,
        action: 'authorization_error',
        timestamp: new Date().toISOString()
      });
      return sendAuthError(res, AuthErrorCode.AUTHORIZATION_FAILED, 'Error de autorización');
    }
  };
};

// =================================================================
// MIDDLEWARES DE ROLES ESPECÍFICOS
// =================================================================

/**
 * Middleware que permite solo a administradores del sistema
 */
export const requireSystemAdmin = authorize([UserRole.SYSTEM_ADMIN]);

/**
 * Middleware que permite a administradores del sistema y de clínica
 */
export const requireClinicAdmin = authorize([
  UserRole.SYSTEM_ADMIN,
  UserRole.CLINIC_ADMIN
]);

/**
 * Middleware que permite a doctores y administradores
 */
export const requireDoctor = authorize([
  UserRole.SYSTEM_ADMIN,
  UserRole.CLINIC_ADMIN,
  UserRole.DENTIST
]);

/**
 * Middleware que permite a personal médico (doctores y asistentes)
 */
export const requireMedicalStaff = authorize([
  UserRole.SYSTEM_ADMIN,
  UserRole.CLINIC_ADMIN,
  UserRole.DENTIST,
  UserRole.ASSISTANT
]);

/**
 * Middleware que permite a todo el personal de la clínica
 */
export const requireClinicStaff = authorize([
  UserRole.SYSTEM_ADMIN,
  UserRole.CLINIC_ADMIN,
  UserRole.DENTIST,
  UserRole.ASSISTANT,
  UserRole.RECEPTIONIST
]);

// =================================================================
// MIDDLEWARE DE VERIFICACIÓN DE CLÍNICA
// =================================================================

/**
 * Middleware que verifica que el usuario pertenezca a la clínica especificada
 * Útil para rutas que incluyen clinic_id en los parámetros
 * 
 * @param req - Request de Express
 * @param res - Response de Express
 * @param next - Función next de Express
 */
export const verifyClinicAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    logger.debug('Iniciando verificación de acceso a clínica', {
      path: req.path,
      method: req.method,
      userId: req.user?.profile.id,
      userRole: req.user?.profile.role,
      userClinicId: req.user?.profile.clinic_id,
      action: 'clinic_access_check_start',
      timestamp: new Date().toISOString()
    });
    
    // Verificar que el usuario esté autenticado
    if (!req.user) {
      return sendAuthError(res, AuthErrorCode.AUTHENTICATION_FAILED, 'Usuario no autenticado');
    }
    
    // Obtener clinic_id de los parámetros o query
    const clinicId = req.params.clinic_id || req.query.clinic_id as string;
    
    if (!clinicId) {
      return sendAuthError(res, AuthErrorCode.INVALID_REQUEST, 'ID de clínica requerido');
    }
    
    // Los administradores del sistema pueden acceder a cualquier clínica
    if (req.user.profile.role === UserRole.SYSTEM_ADMIN) {
      logger.info('Acceso de administrador del sistema permitido', {
        userId: req.user.profile.id,
        email: req.user.profile.email,
        role: req.user.profile.role,
        requestedClinicId: clinicId,
        action: 'system_admin_access_granted',
        timestamp: new Date().toISOString()
      });
      return next();
    }
    
    // Verificar que el usuario pertenezca a la clínica
    if (req.user.profile.clinic_id !== clinicId) {
      logger.warn('Acceso denegado a clínica no autorizada', {
        userId: req.user.profile.id,
        email: req.user.profile.email,
        userClinicId: req.user.profile.clinic_id,
        requestedClinicId: clinicId,
        path: req.path,
        method: req.method,
        ip: req.clientIp,
        action: 'clinic_access_denied',
        timestamp: new Date().toISOString()
      });
      return sendAuthError(res, AuthErrorCode.INSUFFICIENT_PERMISSIONS, 'Acceso a clínica no autorizado');
    }
    
    logger.info('Acceso a clínica verificado exitosamente', {
      userId: req.user.profile.id,
      email: req.user.profile.email,
      clinicId,
      path: req.path,
      method: req.method,
      action: 'clinic_access_granted',
      timestamp: new Date().toISOString()
    });
    next();
    
  } catch (error) {
    logger.error('Error en verificación de acceso a clínica', {
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
      path: req.path,
      method: req.method,
      userId: req.user?.profile.id,
      action: 'clinic_access_error',
      timestamp: new Date().toISOString()
    });
    return sendAuthError(res, AuthErrorCode.AUTHORIZATION_FAILED, 'Error de verificación de clínica');
  }
};

// =================================================================
// MIDDLEWARE OPCIONAL DE AUTENTICACIÓN
// =================================================================

/**
 * Middleware que intenta autenticar al usuario pero no falla si no hay token
 * Útil para rutas que pueden funcionar con o sin autenticación
 * 
 * @param req - Request de Express
 * @param res - Response de Express
 * @param next - Función next de Express
 */
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req);
    
    if (!token) {
      // No hay token, continuar sin autenticación
      return next();
    }
    
    // Intentar verificar token
    const tokenVerification = await authService.verifyToken(token);
    
    if (tokenVerification.valid) {
      // Token válido, obtener usuario
      const user = await authService.getCompleteUser(tokenVerification.payload!.sub);
      
      if (user.profile.is_active) {
        // Usuario activo, inyectar información
        req.user = user;
        req.token = token;
        req.tokenPayload = tokenVerification.payload;
        req.clientIp = getClientIp(req);
        req.userAgent = req.get('User-Agent') || 'Unknown';
        
        logger.info('Usuario autenticado opcionalmente', {
          userId: user.profile.id,
          email: user.profile.email,
          role: user.profile.role,
          clinicId: user.profile.clinic_id,
          path: req.path,
          method: req.method,
          ip: getClientIp(req),
          action: 'optional_auth_success',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Continuar independientemente del resultado
    next();
    
  } catch (error) {
    logger.warn('Error en autenticación opcional, continuando sin autenticación', {
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
      path: req.path,
      method: req.method,
      ip: getClientIp(req),
      userAgent: req.get('User-Agent'),
      action: 'optional_auth_error',
      timestamp: new Date().toISOString()
    });
    // Continuar sin autenticación
    next();
  }
};

// =================================================================
// FUNCIONES DE UTILIDAD
// =================================================================

/**
 * Extrae el token del header Authorization
 * 
 * @param req - Request de Express
 * @returns Token JWT o null
 */
function extractTokenFromHeader(req: Request): string | null {
  const authHeader = req.get('Authorization');
  
  if (!authHeader) {
    return null;
  }
  
  // Formato esperado: "Bearer <token>"
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1] || null;
}

/**
 * Obtiene la IP real del cliente considerando proxies
 * 
 * @param req - Request de Express
 * @returns IP del cliente
 */
function getClientIp(req: Request): string {
  return (
    req.get('X-Forwarded-For')?.split(',')[0] ||
    req.get('X-Real-IP') ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Envía una respuesta de error de autenticación estandarizada
 * 
 * @param res - Response de Express
 * @param code - Código de error
 * @param message - Mensaje de error
 */
function sendAuthError(
  res: Response,
  code: AuthErrorCode,
  message: string
): void {
  const statusCode = getStatusCodeForAuthError(code);
  
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Mapea códigos de error de autenticación a códigos de estado HTTP
 * 
 * @param code - Código de error de autenticación
 * @returns Código de estado HTTP
 */
function getStatusCodeForAuthError(code: AuthErrorCode): number {
  switch (code) {
    case AuthErrorCode.TOKEN_MISSING:
    case AuthErrorCode.TOKEN_INVALID:
    case AuthErrorCode.TOKEN_EXPIRED:
    case AuthErrorCode.AUTHENTICATION_FAILED:
      return 401; // Unauthorized
    
    case AuthErrorCode.INSUFFICIENT_PERMISSIONS:
    case AuthErrorCode.AUTHORIZATION_FAILED:
      return 403; // Forbidden
    
    case AuthErrorCode.USER_NOT_FOUND:
      return 404; // Not Found
    
    case AuthErrorCode.USER_DISABLED:
      return 423; // Locked
    
    case AuthErrorCode.INVALID_REQUEST:
      return 400; // Bad Request
    
    default:
      return 500; // Internal Server Error
  }
}

// =================================================================
// MIDDLEWARE DE AUDITORÍA
// =================================================================

/**
 * Middleware que registra eventos de acceso para auditoría
 * 
 * @param req - Request de Express
 * @param res - Response de Express
 * @param next - Función next de Express
 */
export const auditAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Registrar información del acceso
  const accessInfo = {
    method: req.method,
    path: req.path,
    ip: getClientIp(req),
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    userId: req.user?.auth.id,
    clinicId: req.user?.profile.clinic_id
  };
  
  logger.info('Acceso registrado para auditoría', {
    ...accessInfo,
    action: 'access_audit',
    userEmail: req.user?.profile.email,
    userRole: req.user?.profile.role
  });
  
  // TODO: Implementar logging a base de datos para auditoría
  // await logAccessEvent(accessInfo);
  
  next();
};

// =================================================================
// EXPORTACIONES ADICIONALES
// =================================================================

/**
 * Objeto con todos los middlewares de autenticación
 */
export const authMiddleware = {
  authenticate,
  authorize,
  requireSystemAdmin,
  requireClinicAdmin,
  requireDoctor,
  requireMedicalStaff,
  requireClinicStaff,
  verifyClinicAccess,
  optionalAuthenticate,
  auditAccess
};

/**
 * Exportación por defecto
 */
export default authMiddleware;

// =================================================================
// NOTAS DE IMPLEMENTACIÓN
// =================================================================
/*

1. **SEGURIDAD**:
   - Verificación estricta de tokens JWT
   - Validación de roles y permisos
   - Protección contra ataques de autorización
   - Auditoría de accesos

2. **FLEXIBILIDAD**:
   - Middlewares específicos por rol
   - Autenticación opcional
   - Verificación de clínica
   - Composición de middlewares

3. **MULTI-TENANT**:
   - Verificación automática de clínica
   - Aislamiento de datos por clínica
   - Roles jerárquicos
   - Administradores del sistema

4. **CUMPLIMIENTO**:
   - Auditoría de accesos
   - Logging estructurado
   - Trazabilidad completa
   - Manejo de errores

5. **PERFORMANCE**:
   - Verificación eficiente de tokens
   - Caché de información de usuario
   - Logging asíncrono
   - Manejo de errores optimizado

*/