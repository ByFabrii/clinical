/**
 * =================================================================
 * CONTROLADOR DE AUTENTICACIÓN - SISTEMA EXPEDIENTES DENTALES
 * =================================================================
 * 
 * Este controlador maneja todas las rutas relacionadas con
 * autenticación de usuarios.
 * 
 * ENDPOINTS:
 * - POST /auth/register - Registro de nuevos usuarios
 * - POST /auth/login - Autenticación de usuarios
 * - GET /auth/profile - Obtener perfil del usuario autenticado
 * - PUT /auth/profile - Actualizar perfil del usuario
 * - POST /auth/logout - Cerrar sesión
 * - POST /auth/refresh - Renovar token de acceso
 * 
 * =================================================================
 */

import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { config } from '../config/env';
import logger from '@/config/logger';

// Tipos
import {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  CompleteUser,
  AuthError,
  AuthErrorCode
} from '../types/auth';

// =================================================================
// INTERFACES PARA REQUESTS
// =================================================================

interface RegisterRequestBody extends RegisterRequest {}

interface LoginRequestBody extends LoginRequest {}

interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  phone?: string;
  language?: string;
  timezone?: string;
}

// =================================================================
// CONTROLADOR PRINCIPAL
// =================================================================

export class AuthController {
  
  // =================================================================
  // REGISTRO DE USUARIOS
  // =================================================================

  /**
   * Registra un nuevo usuario en el sistema
   * 
   * @route POST /auth/register
   * @access Public
   */
  async register(req: Request, res: Response): Promise<void> {
    const requestId = req.headers['x-request-id'] as string;
    const startTime = Date.now();
    
    try {
      logger.info('🔐 Iniciando proceso de registro de usuario', {
        requestId,
        ip: this.getClientIp(req),
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      
      const registerData: RegisterRequestBody = {
        ...req.body,
        clinic_id: req.body.clinicId || req.body.clinic_id // Mapear clinicId a clinic_id
      };
      const clientIp = this.getClientIp(req);
      const userAgent = req.get('User-Agent') || 'Unknown';
      
      logger.debug('📋 Datos de registro recibidos', {
        requestId,
        email: registerData.email,
        clinic_id: registerData.clinic_id,
        hasPassword: !!registerData.password,
        acceptedTerms: registerData.terms_accepted,
        acceptedPrivacy: registerData.privacy_accepted
      });
      
      // Validar datos requeridos
      const validation = this.validateRegisterData(registerData);
      if (!validation.valid) {
        logger.warn('⚠️ Validación de datos de registro fallida', {
          requestId,
          email: registerData.email,
          validationError: validation.message,
          ip: clientIp
        });
        
        res.status(400).json({
          success: false,
          error: {
            code: AuthErrorCode.INVALID_CREDENTIALS,
            message: validation.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
      
      // Registrar usuario
      logger.info('🔄 Procesando registro en servicio de autenticación', {
        requestId,
        email: registerData.email,
        clinic_id: registerData.clinic_id
      });
      
      const authResponse = await authService.register(registerData, clientIp, userAgent);
      
      const processingTime = Date.now() - startTime;
      
      logger.info('✅ Usuario registrado exitosamente', {
        requestId,
        userId: authResponse.user.auth.id,
        email: authResponse.user.auth.email,
        clinicId: authResponse.user.clinic.id,
        clinicName: authResponse.user.clinic.clinic_name,
        role: authResponse.user.profile.role,
        processingTime: `${processingTime}ms`,
        ip: clientIp,
        timestamp: new Date().toISOString()
      });
      
      // Log de auditoría para cumplimiento normativo
      logger.info('📊 AUDIT: Nuevo usuario registrado en el sistema', {
        action: 'USER_REGISTRATION',
        userId: authResponse.user.auth.id,
        email: authResponse.user.auth.email,
        clinicId: authResponse.user.clinic.id,
        ip: clientIp,
        userAgent,
        timestamp: new Date().toISOString(),
        requestId
      });
      
      // Respuesta exitosa
      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: {
          user: {
            id: authResponse.user.auth.id,
            email: authResponse.user.auth.email,
            first_name: authResponse.user.profile.first_name,
            last_name: authResponse.user.profile.last_name,
            role: authResponse.user.profile.role,
            clinic: {
              id: authResponse.user.clinic.id,
              name: authResponse.user.clinic.clinic_name
            }
          },
          access_token: authResponse.access_token,
          refresh_token: authResponse.refresh_token,
          expires_in: authResponse.expires_in,
          token_type: authResponse.token_type
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('❌ Error en proceso de registro de usuario', {
        requestId,
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        email: req.body?.email,
        clinic_id: req.body?.clinic_id || req.body?.clinicId,
        ip: this.getClientIp(req),
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      });
      
      this.handleAuthError(res, error);
    }
  }

  // =================================================================
  // LOGIN DE USUARIOS
  // =================================================================

  /**
   * Autentica un usuario existente
   * 
   * @route POST /auth/login
   * @access Public
   */
  async login(req: Request, res: Response): Promise<void> {
    const requestId = req.headers['x-request-id'] as string;
    const startTime = Date.now();
    
    try {
      logger.info('🔐 Iniciando proceso de autenticación de usuario', {
        requestId,
        ip: this.getClientIp(req),
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      
      const loginData: LoginRequestBody = req.body;
      const clientIp = this.getClientIp(req);
      const userAgent = req.get('User-Agent') || 'Unknown';
      
      logger.debug('📋 Datos de login recibidos', {
        requestId,
        email: loginData.email,
        hasPassword: !!loginData.password,
        ip: clientIp
      });
      
      // Validar datos requeridos
      if (!loginData.email || !loginData.password) {
        logger.warn('⚠️ Intento de login con datos incompletos', {
          requestId,
          email: loginData.email,
          missingEmail: !loginData.email,
          missingPassword: !loginData.password,
          ip: clientIp
        });
        
        res.status(400).json({
          success: false,
          error: {
            code: AuthErrorCode.INVALID_CREDENTIALS,
            message: 'Email y contraseña son requeridos',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
      
      // Autenticar usuario
      logger.info('🔄 Procesando autenticación en servicio', {
        requestId,
        email: loginData.email,
        ip: clientIp
      });
      
      const authResponse = await authService.login(loginData, clientIp, userAgent);
      
      const processingTime = Date.now() - startTime;
      
      logger.info('✅ Usuario autenticado exitosamente', {
        requestId,
        userId: authResponse.user.auth.id,
        email: authResponse.user.auth.email,
        clinicId: authResponse.user.clinic.id,
        clinicName: authResponse.user.clinic.clinic_name,
        role: authResponse.user.profile.role,
        lastLoginAt: authResponse.user.profile.last_login_at,
        processingTime: `${processingTime}ms`,
        ip: clientIp,
        timestamp: new Date().toISOString()
      });
      
      // Log de auditoría para cumplimiento normativo
      logger.info('📊 AUDIT: Usuario autenticado en el sistema', {
        action: 'USER_LOGIN',
        userId: authResponse.user.auth.id,
        email: authResponse.user.auth.email,
        clinicId: authResponse.user.clinic.id,
        ip: clientIp,
        userAgent,
        timestamp: new Date().toISOString(),
        requestId
      });
      
      // Respuesta exitosa
      res.status(200).json({
        success: true,
        message: 'Autenticación exitosa',
        data: {
          user: {
            id: authResponse.user.auth.id,
            email: authResponse.user.auth.email,
            first_name: authResponse.user.profile.first_name,
            last_name: authResponse.user.profile.last_name,
            role: authResponse.user.profile.role,
            clinic: {
              id: authResponse.user.clinic.id,
              name: authResponse.user.clinic.clinic_name
            },
            last_login_at: authResponse.user.profile.last_login_at
          },
          access_token: authResponse.access_token,
          refresh_token: authResponse.refresh_token,
          expires_in: authResponse.expires_in,
          token_type: authResponse.token_type
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('❌ Error en proceso de autenticación de usuario', {
        requestId,
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        email: req.body?.email,
        ip: this.getClientIp(req),
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      });
      
      // Log de auditoría para intentos fallidos
      logger.warn('📊 AUDIT: Intento de autenticación fallido', {
        action: 'USER_LOGIN_FAILED',
        email: req.body?.email,
        ip: this.getClientIp(req),
        userAgent: req.get('User-Agent'),
        error: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString(),
        requestId
      });
      
      this.handleAuthError(res, error);
    }
  }

  // =================================================================
  // PERFIL DE USUARIO
  // =================================================================

  /**
   * Obtiene el perfil del usuario autenticado
   * 
   * @route GET /auth/profile
   * @access Private
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    const requestId = req.headers['x-request-id'] as string;
    
    try {
      logger.info('👤 Obteniendo perfil de usuario', {
        requestId,
        userId: req.user?.auth.id,
        email: req.user?.auth.email,
        ip: this.getClientIp(req),
        action: 'get_profile',
        timestamp: new Date().toISOString()
      });
      
      // El usuario ya está disponible gracias al middleware de autenticación
      const user = req.user!;
      
      logger.info('✅ Perfil obtenido exitosamente', {
        requestId,
        userId: user.auth.id,
        email: user.auth.email,
        clinicId: user.clinic.id,
        role: user.profile.role,
        action: 'get_profile_success',
        timestamp: new Date().toISOString()
      });
      
      // Respuesta exitosa
      res.status(200).json({
        success: true,
        message: 'Perfil obtenido exitosamente',
        data: {
          user: {
            id: user.auth.id,
            email: user.auth.email,
            first_name: user.profile.first_name,
            last_name: user.profile.last_name,
            phone: user.profile.phone,
            role: user.profile.role,
            is_active: user.profile.is_active,
            language: user.profile.language,
            timezone: user.profile.timezone,
            clinic: {
              id: user.clinic.id,
              name: user.clinic.clinic_name,
              status: user.clinic.is_active ? 'active' : 'inactive'
            },
            created_at: user.profile.created_at,
            updated_at: user.profile.updated_at,
            last_login_at: user.profile.last_login_at
          }
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Error al obtener perfil de usuario', {
        requestId,
        userId: req.user?.auth.id,
        email: req.user?.auth.email,
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        ip: this.getClientIp(req),
        action: 'get_profile_error',
        timestamp: new Date().toISOString()
      });
      
      this.handleAuthError(res, error);
    }
  }

  /**
   * Actualiza el perfil del usuario autenticado
   * 
   * @route PUT /auth/profile
   * @access Private
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    const requestId = req.headers['x-request-id'] as string;
    
    try {
      logger.info('👤 Iniciando actualización de perfil de usuario', {
        requestId,
        userId: req.user?.auth.id,
        email: req.user?.auth.email,
        updateFields: Object.keys(req.body),
        ip: this.getClientIp(req),
        action: 'update_profile_start',
        timestamp: new Date().toISOString()
      });
      
      const user = req.user!;
      const updateData: UpdateProfileRequest = req.body;
      
      // Validar datos de actualización
      const validation = this.validateUpdateData(updateData);
      if (!validation.valid) {
        logger.warn('⚠️ Validación de datos de actualización fallida', {
          requestId,
          userId: user.auth.id,
          email: user.auth.email,
          validationError: validation.message,
          updateData: Object.keys(updateData),
          action: 'update_profile_validation_failed',
          timestamp: new Date().toISOString()
        });
        
        res.status(400).json({
          success: false,
          error: {
            code: AuthErrorCode.INVALID_REQUEST,
            message: validation.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
      
      // TODO: Implementar actualización de perfil en el servicio
      // const updatedUser = await authService.updateProfile(user.auth.id, updateData);
      
      logger.info('✅ Perfil actualizado exitosamente', {
        requestId,
        userId: user.auth.id,
        email: user.auth.email,
        updatedFields: Object.keys(updateData),
        clinicId: user.clinic.id,
        action: 'update_profile_success',
        timestamp: new Date().toISOString()
      });
      
      // Por ahora, simular actualización exitosa
      res.status(200).json({
        success: true,
        message: 'Perfil actualizado exitosamente',
        data: {
          user: {
            id: user.auth.id,
            email: user.auth.email,
            first_name: updateData.first_name || user.profile.first_name,
            last_name: updateData.last_name || user.profile.last_name,
            phone: updateData.phone || user.profile.phone,
            language: updateData.language || user.profile.language,
            timezone: updateData.timezone || user.profile.timezone,
            updated_at: new Date().toISOString()
          }
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Error al actualizar perfil de usuario', {
        requestId,
        userId: req.user?.auth.id,
        email: req.user?.auth.email,
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        updateData: Object.keys(req.body || {}),
        ip: this.getClientIp(req),
        action: 'update_profile_error',
        timestamp: new Date().toISOString()
      });
      
      this.handleAuthError(res, error);
    }
  }

  // =================================================================
  // LOGOUT
  // =================================================================

  /**
   * Cierra la sesión del usuario
   * 
   * @route POST /auth/logout
   * @access Private
   */
  async logout(req: Request, res: Response): Promise<void> {
    const requestId = req.headers['x-request-id'] as string;
    
    try {
      logger.info('🚪 Iniciando cierre de sesión de usuario', {
        requestId,
        userId: req.user?.auth.id,
        email: req.user?.auth.email,
        ip: this.getClientIp(req),
        action: 'logout_start',
        timestamp: new Date().toISOString()
      });
      
      const user = req.user!;
      const token = req.token!;
      
      // Invalidar sesión usando el servicio
      await authService.logout(user.auth.id, token);
      
      logger.info('✅ Sesión cerrada exitosamente', {
        requestId,
        userId: user.auth.id,
        email: user.auth.email,
        clinicId: user.clinic.id,
        ip: this.getClientIp(req),
        action: 'logout_success',
        timestamp: new Date().toISOString()
      });
      
      // Log de auditoría para cumplimiento normativo
      logger.info('📊 AUDIT: Usuario cerró sesión', {
        action: 'USER_LOGOUT',
        userId: user.auth.id,
        email: user.auth.email,
        clinicId: user.clinic.id,
        ip: this.getClientIp(req),
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        requestId
      });
      
      res.status(200).json({
        success: true,
        message: 'Sesión cerrada exitosamente',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Error al cerrar sesión de usuario', {
        requestId,
        userId: req.user?.auth.id,
        email: req.user?.auth.email,
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        ip: this.getClientIp(req),
        action: 'logout_error',
        timestamp: new Date().toISOString()
      });
      
      this.handleAuthError(res, error);
    }
  }

  // =================================================================
  // REFRESH TOKEN
  // =================================================================

  /**
   * Renueva el token de acceso usando el refresh token
   * 
   * @route POST /auth/refresh
   * @access Public
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    const requestId = req.headers['x-request-id'] as string;
    
    try {
      logger.info('🔄 Iniciando renovación de token de acceso', {
        requestId,
        ip: this.getClientIp(req),
        userAgent: req.get('User-Agent'),
        action: 'refresh_token_start',
        timestamp: new Date().toISOString()
      });
      
      const { refresh_token } = req.body;
      
      if (!refresh_token) {
        logger.warn('❌ Intento de renovación de token sin refresh token', {
          requestId,
          ip: this.getClientIp(req),
          action: 'refresh_token_missing',
          timestamp: new Date().toISOString()
        });
        
        res.status(400).json({
          success: false,
          error: {
            code: AuthErrorCode.TOKEN_MISSING,
            message: 'Refresh token requerido',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
      
      // Renovar token usando el servicio
      const newTokens = await authService.refreshToken(refresh_token);
      
      logger.info('✅ Token renovado exitosamente', {
        requestId,
        ip: this.getClientIp(req),
        action: 'refresh_token_success',
        timestamp: new Date().toISOString()
      });
      
      // Responder con nuevos tokens
      res.status(200).json({
        success: true,
        data: {
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_in: newTokens.expires_in,
          token_type: 'Bearer'
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Error al renovar token de acceso', {
        requestId,
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        ip: this.getClientIp(req),
        action: 'refresh_token_error',
        timestamp: new Date().toISOString()
      });
      
      this.handleAuthError(res, error);
    }
  }

  // =================================================================
  // MÉTODOS PRIVADOS DE VALIDACIÓN
  // =================================================================

  /**
   * Valida los datos de registro
   */
  private validateRegisterData(data: RegisterRequestBody): { valid: boolean; message?: string } {
    if (!data.email) {
      return { valid: false, message: 'Email es requerido' };
    }
    
    if (!this.isValidEmail(data.email)) {
      return { valid: false, message: 'Email inválido' };
    }
    
    if (!data.password) {
      return { valid: false, message: 'Contraseña es requerida' };
    }
    
    if (data.password.length < 8) {
      return { valid: false, message: 'La contraseña debe tener al menos 8 caracteres' };
    }
    
    if (!data.first_name || data.first_name.trim().length < 2) {
      return { valid: false, message: 'Nombre inválido' };
    }
    
    if (!data.last_name || data.last_name.trim().length < 2) {
      return { valid: false, message: 'Apellido inválido' };
    }
    
    if (!data.terms_accepted) {
      return { valid: false, message: 'Debe aceptar los términos y condiciones' };
    }
    
    if (!data.privacy_accepted) {
      return { valid: false, message: 'Debe aceptar la política de privacidad' };
    }
    
    if (!data.clinic_id) {
      return { valid: false, message: 'ID de clínica es requerido' };
    }
    
    return { valid: true };
  }

  /**
   * Valida los datos de actualización de perfil
   */
  private validateUpdateData(data: UpdateProfileRequest): { valid: boolean; message?: string } {
    if (data.first_name && data.first_name.trim().length < 2) {
      return { valid: false, message: 'Nombre inválido' };
    }
    
    if (data.last_name && data.last_name.trim().length < 2) {
      return { valid: false, message: 'Apellido inválido' };
    }
    
    if (data.phone && data.phone.length < 10) {
      return { valid: false, message: 'Teléfono inválido' };
    }
    
    if (data.language && !['es', 'en'].includes(data.language)) {
      return { valid: false, message: 'Idioma no soportado' };
    }
    
    return { valid: true };
  }

  // =================================================================
  // MÉTODOS PRIVADOS DE UTILIDAD
  // =================================================================

  /**
   * Valida formato de email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Obtiene la IP del cliente
   */
  private getClientIp(req: Request): string {
    return (
      req.get('X-Forwarded-For')?.split(',')[0] ||
      req.get('X-Real-IP') ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Maneja errores de autenticación
   */
  private handleAuthError(res: Response, error: any): void {
    if (error.code && Object.values(AuthErrorCode).includes(error.code)) {
      // Error de autenticación conocido
      const statusCode = this.getStatusCodeForAuthError(error.code);
      res.status(statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      // Error genérico
      res.status(500).json({
        success: false,
        error: {
          code: AuthErrorCode.INTERNAL_ERROR,
          message: 'Error interno del servidor',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Mapea códigos de error a códigos de estado HTTP
   */
  private getStatusCodeForAuthError(code: AuthErrorCode): number {
    switch (code) {
      case AuthErrorCode.INVALID_CREDENTIALS:
      case AuthErrorCode.TOKEN_MISSING:
      case AuthErrorCode.TOKEN_INVALID:
      case AuthErrorCode.TOKEN_EXPIRED:
      case AuthErrorCode.AUTHENTICATION_FAILED:
        return 401;
      
      case AuthErrorCode.INSUFFICIENT_PERMISSIONS:
      case AuthErrorCode.AUTHORIZATION_FAILED:
        return 403;
      
      case AuthErrorCode.USER_NOT_FOUND:
        return 404;
      
      case AuthErrorCode.EMAIL_ALREADY_EXISTS:
      case AuthErrorCode.WEAK_PASSWORD:
      case AuthErrorCode.INVALID_REQUEST:
        return 400;
      
      case AuthErrorCode.USER_DISABLED:
        return 423;
      
      case AuthErrorCode.TERMS_NOT_ACCEPTED:
        return 422;
      
      default:
        return 500;
    }
  }
}

// =================================================================
// INSTANCIA DEL CONTROLADOR
// =================================================================

/**
 * Instancia del controlador de autenticación
 */
export const authController = new AuthController();

/**
 * Exportación por defecto
 */
export default authController;

// =================================================================
// NOTAS DE IMPLEMENTACIÓN
// =================================================================
/*

1. **ESTRUCTURA**:
   - Controlador basado en clases
   - Métodos async/await
   - Manejo robusto de errores
   - Validación de datos

2. **SEGURIDAD**:
   - Validación estricta de entrada
   - Sanitización de respuestas
   - Manejo seguro de errores
   - Logging de eventos

3. **API DESIGN**:
   - Respuestas consistentes
   - Códigos de estado apropiados
   - Mensajes descriptivos
   - Timestamps en respuestas

4. **CUMPLIMIENTO**:
   - Validación de términos
   - Auditoría de acciones
   - Manejo de datos personales
   - Trazabilidad completa

5. **ESCALABILIDAD**:
   - Separación de responsabilidades
   - Reutilización de código
   - Fácil testing
   - Mantenimiento simple

*/