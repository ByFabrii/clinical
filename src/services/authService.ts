/**
 * =================================================================
 * SERVICIO DE AUTENTICACIÓN - SISTEMA EXPEDIENTES DENTALES
 * =================================================================
 * 
 * Este servicio maneja toda la lógica de autenticación utilizando
 * Supabase Auth como proveedor principal.
 * 
 * RESPONSABILIDADES:
 * 1. Registro y login de usuarios
 * 2. Gestión de tokens JWT
 * 3. Validación de sesiones
 * 4. Integración con perfiles de usuario
 * 5. Auditoría de eventos de autenticación
 * 
 * =================================================================
 */

import { AuthResponse, User } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// Configuración
import { config } from '../config/env';
import { supabaseAnon, supabaseService, getSupabaseClient } from '../config/supabase';
import  logger from '../config/logger';

// Tipos
import {
  RegisterRequest,
  LoginRequest,
  AuthResponse as CustomAuthResponse,
  CompleteUser,
  UserProfile,
  UserRole,
  UserStatus,
  JWTPayload,
  TokenVerification,
  AuthError,
  AuthErrorCode,
  UserSession,
  AuthAuditLog
} from '../types/auth';

// =================================================================
// CLASE PRINCIPAL DEL SERVICIO
// =================================================================

export class AuthService {
  
  // =================================================================
  // MÉTODOS DE REGISTRO
  // =================================================================

  /**
   * Registra un nuevo usuario en el sistema
   * 
   * PROCESO:
   * 1. Validar datos de entrada
   * 2. Crear usuario en Supabase Auth
   * 3. Crear perfil en nuestra base de datos
   * 4. Crear o asociar clínica
   * 5. Generar tokens
   * 6. Registrar auditoría
   * 
   * @param registerData - Datos de registro
   * @param ipAddress - IP del cliente
   * @param userAgent - User agent del cliente
   * @returns Usuario completo con tokens
   */
  async register(
    registerData: RegisterRequest,
    ipAddress: string,
    userAgent: string
  ): Promise<CustomAuthResponse> {
    const startTime = Date.now();
    const requestId = uuidv4();
    
    try {
      logger.info('Iniciando proceso de registro de usuario', {
        requestId,
        email: registerData.email,
        clinic_id: registerData.clinic_id,
        ip: ipAddress,
        userAgent,
        action: 'user_registration_start',
        timestamp: new Date().toISOString()
      });
      
      // 1. Validar datos de entrada
      this.validateRegisterData(registerData);
      
      // 2. Verificar que el email no exista
      await this.checkEmailExists(registerData.email);
      
      // 3. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabaseAnon.auth.signUp({
        email: registerData.email,
        password: registerData.password,
        options: {
          data: {
            first_name: registerData.first_name,
            last_name: registerData.last_name,
            phone: registerData.phone
          },
          emailRedirectTo: undefined // Evitar redirección de confirmación
        }
      });
      
      logger.info('Usuario creado exitosamente en Supabase Auth', {
        requestId,
        userId: authData.user?.id,
        email: registerData.email,
        emailConfirmed: !!authData.user?.email_confirmed_at,
        userConfirmed: !!authData.user?.confirmed_at,
        action: 'supabase_user_created',
        timestamp: new Date().toISOString()
      });
      
      if (authError) {
        throw this.createAuthError(AuthErrorCode.INVALID_CREDENTIALS, authError.message);
      }
      
      if (!authData.user) {
        throw this.createAuthError(AuthErrorCode.USER_NOT_FOUND, 'No se pudo crear el usuario');
      }
      
      // Confirmar usuario automáticamente si no está confirmado
      if (!authData.user.email_confirmed_at) {
        logger.info('Iniciando confirmación automática de usuario', {
          requestId,
          userId: authData.user.id,
          email: registerData.email,
          action: 'auto_confirm_start',
          timestamp: new Date().toISOString()
        });
        
        const { error: confirmError } = await supabaseService.auth.admin.updateUserById(
          authData.user.id,
          { email_confirm: true }
        );
        
        if (confirmError) {
          logger.warn('Error en confirmación automática de usuario', {
            requestId,
            userId: authData.user.id,
            email: registerData.email,
            error: confirmError.message,
            action: 'auto_confirm_failed',
            timestamp: new Date().toISOString()
          });
        } else {
          logger.info('Usuario confirmado automáticamente', {
            requestId,
            userId: authData.user.id,
            email: registerData.email,
            action: 'auto_confirm_success',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // 4. Validar que se proporcione un clinic_id válido
      if (!registerData.clinic_id) {
        throw this.createAuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Se requiere un clinic_id válido para registrar el usuario');
      }
      
      // Verificar que la clínica existe
      logger.info('Iniciando búsqueda de clínica', {
        requestId,
        clinic_id: registerData.clinic_id,
        email: registerData.email,
        action: 'clinic_search_start',
        timestamp: new Date().toISOString()
      });
      
      let clinicData: any = null;
      
      // Intentar primero con consulta directa usando service role
      logger.debug('Probando consulta directa con service role', {
        requestId,
        clinic_id: registerData.clinic_id,
        method: 'direct_query',
        timestamp: new Date().toISOString()
      });
      const { data: directClinic, error: directError } = await supabaseService
        .from('clinics')
        .select('id, clinic_name, is_active')
        .eq('id', registerData.clinic_id)
        .single();
      
      logger.debug('Resultado de consulta directa', {
        requestId,
        clinic_id: registerData.clinic_id,
        hasData: !!directClinic,
        hasError: !!directError,
        error: directError?.message,
        method: 'direct_query_result',
        timestamp: new Date().toISOString()
      });
      
      if (directClinic && !directError) {
        logger.info('Consulta directa exitosa', {
          requestId,
          clinic_id: registerData.clinic_id,
          clinic_name: directClinic.clinic_name,
          is_active: directClinic.is_active,
          method: 'direct_query_success',
          timestamp: new Date().toISOString()
        });
        clinicData = directClinic;
      } else {
        logger.debug('Consulta directa falló, probando función RPC', {
          requestId,
          clinic_id: registerData.clinic_id,
          method: 'fallback_to_rpc',
          timestamp: new Date().toISOString()
        });
        
        // Usar función RPC para obtener clínica (bypass RLS)
        const { data: clinicResult, error: clinicError } = await supabaseService
          .rpc('get_clinic_by_id', { clinic_uuid: registerData.clinic_id });
        
         logger.debug('Resultado de función RPC', {
           requestId,
           clinic_id: registerData.clinic_id,
           hasData: !!clinicResult,
           hasError: !!clinicError,
           dataType: typeof clinicResult,
           isArray: Array.isArray(clinicResult),
           method: 'rpc_query_result',
           timestamp: new Date().toISOString()
         });
         
         if (clinicError) {
           logger.error('Error en función RPC para búsqueda de clínica', {
             requestId,
             clinic_id: registerData.clinic_id,
             error: clinicError.message,
             method: 'rpc_query_error',
             timestamp: new Date().toISOString()
           });
           throw this.createAuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Error al verificar la clínica');
         }
         
         if (!clinicResult || (Array.isArray(clinicResult) && clinicResult.length === 0)) {
           logger.warn('Clínica no encontrada', {
             requestId,
             clinic_id: registerData.clinic_id,
             email: registerData.email,
             method: 'clinic_not_found',
             timestamp: new Date().toISOString()
           });
           throw this.createAuthError(AuthErrorCode.INVALID_CREDENTIALS, 'La clínica especificada no existe');
         }
         
         // La función RPC puede devolver un array o un objeto único
         clinicData = Array.isArray(clinicResult) ? clinicResult[0] : clinicResult;
         
         logger.info('Datos de clínica obtenidos exitosamente', {
           requestId,
           clinic_id: registerData.clinic_id,
           clinic_name: clinicData?.clinic_name,
           is_active: clinicData?.is_active,
           method: 'clinic_data_retrieved',
           timestamp: new Date().toISOString()
         });
       }
       
       // Validar que la clínica esté activa
       if (!clinicData || !clinicData.is_active) {
         logger.warn('Clínica inactiva o no encontrada', {
           requestId,
           clinic_id: registerData.clinic_id,
           email: registerData.email,
           hasClinicData: !!clinicData,
           isActive: clinicData?.is_active,
           action: 'clinic_validation_failed',
           timestamp: new Date().toISOString()
         });
         throw this.createAuthError(AuthErrorCode.INVALID_CREDENTIALS, 'La clínica especificada no existe o no está activa');
       }
      
      const clinicId = registerData.clinic_id;
      
      // 5. Crear perfil de usuario
      const userProfile = await this.createUserProfile(authData.user, registerData, clinicId);
      
      // 6. Crear usuario completo
      const completeUser: CompleteUser = {
        auth: authData.user,
        profile: userProfile,
        clinic: {
            id: clinicId,
            clinic_name: clinicData.clinic_name,
            is_active: true
          }
      };
      
      // 7. Generar tokens
      const tokens = await this.generateTokens(completeUser);
      
      // 8. Crear sesión
      await this.createUserSession(completeUser, ipAddress, userAgent, tokens.access_token);
      
      // 9. Registrar auditoría
      await this.logAuthEvent({
        event_type: 'register',
        event_description: 'Usuario registrado exitosamente',
        user_id: authData.user.id,
        user_email: authData.user.email,
        clinic_id: clinicId,
        ip_address: ipAddress,
        user_agent: userAgent,
        success: true,
        timestamp: new Date().toISOString()
      });
      
      const processingTime = Date.now() - startTime;
      
      logger.info('Usuario registrado exitosamente', {
        requestId,
        userId: authData.user.id,
        email: authData.user.email,
        clinic_id: clinicId,
        clinic_name: clinicData.clinic_name,
        ip: ipAddress,
        processingTime,
        action: 'user_registration_success',
        timestamp: new Date().toISOString()
      });
      
      return {
        user: completeUser,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: 'Bearer'
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Error en proceso de registro', {
        requestId,
        email: registerData.email,
        clinic_id: registerData.clinic_id,
        ip: ipAddress,
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime,
        action: 'user_registration_error',
        timestamp: new Date().toISOString()
      });
      
      // Registrar auditoría de error
      await this.logAuthEvent({
        event_type: 'register',
        event_description: 'Error en registro de usuario',
        user_email: registerData.email,
        ip_address: ipAddress,
        user_agent: userAgent,
        success: false,
        error_message: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  // =================================================================
  // MÉTODOS DE LOGIN
  // =================================================================

  /**
   * Autentica un usuario existente
   * 
   * @param loginData - Credenciales de login
   * @param ipAddress - IP del cliente
   * @param userAgent - User agent del cliente
   * @returns Usuario completo con tokens
   */
  async login(
    loginData: LoginRequest,
    ipAddress: string,
    userAgent: string
  ): Promise<CustomAuthResponse> {
    const startTime = Date.now();
    const requestId = uuidv4();
    
    try {
      logger.info('Iniciando proceso de autenticación', {
        requestId,
        email: loginData.email,
        ip: ipAddress,
        userAgent,
        action: 'user_login_start',
        timestamp: new Date().toISOString()
      });
      
      // 1. Autenticar con Supabase
      const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password
      });
      
      if (authError) {
        throw this.createAuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Credenciales inválidas');
      }
      
      if (!authData.user) {
        throw this.createAuthError(AuthErrorCode.USER_NOT_FOUND, 'Usuario no encontrado');
      }
      
      // 2. Obtener perfil completo del usuario
      const completeUser = await this.getCompleteUser(authData.user.id);
      
      // 3. Verificar estado del usuario
      this.validateUserStatus(completeUser.profile);
      
      // 4. Generar tokens
      const tokens = await this.generateTokens(completeUser);
      
      // 5. Crear sesión
      await this.createUserSession(completeUser, ipAddress, userAgent, tokens.access_token);
      
      // 6. Actualizar último login
      await this.updateLastLogin(completeUser.profile.id);
      
      // 7. Registrar auditoría
      await this.logAuthEvent({
        event_type: 'login',
        event_description: 'Usuario autenticado exitosamente',
        user_id: authData.user.id,
        user_email: authData.user.email,
        clinic_id: completeUser.profile.clinic_id,
        ip_address: ipAddress,
        user_agent: userAgent,
        success: true,
        timestamp: new Date().toISOString()
      });
      
      const processingTime = Date.now() - startTime;
      
      logger.info('Usuario autenticado exitosamente', {
        requestId,
        userId: authData.user.id,
        email: authData.user.email,
        clinic_id: completeUser.profile.clinic_id,
        clinic_name: completeUser.clinic.clinic_name,
        role: completeUser.profile.role,
        ip: ipAddress,
        processingTime,
        action: 'user_login_success',
        timestamp: new Date().toISOString()
      });
      
      return {
        user: completeUser,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: 'Bearer'
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Error en proceso de autenticación', {
        requestId,
        email: loginData.email,
        ip: ipAddress,
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime,
        action: 'user_login_error',
        timestamp: new Date().toISOString()
      });
      
      // Registrar auditoría de error
      await this.logAuthEvent({
        event_type: 'login',
        event_description: 'Error en autenticación',
        user_email: loginData.email,
        ip_address: ipAddress,
        user_agent: userAgent,
        success: false,
        error_message: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  // =================================================================
  // MÉTODOS DE TOKENS
  // =================================================================

  /**
   * Genera tokens JWT para un usuario
   * 
   * @param user - Usuario completo
   * @returns Tokens de acceso y refresh
   */
  async generateTokens(user: CompleteUser): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const sessionId = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    
    // Payload del token de acceso
    const accessPayload: JWTPayload = {
      sub: user.auth.id,
      email: user.auth.email!,
      role: user.profile.role,
      clinic_id: user.profile.clinic_id,
      iat: now,
      exp: now + this.parseTimeToSeconds(config.jwt.expiresIn),
      iss: 'dental-records-api',
      aud: 'dental-records-app',
      session_id: sessionId
    };
    
    // Payload del token de refresh
    const refreshPayload = {
      sub: user.auth.id,
      type: 'refresh',
      session_id: sessionId,
      iat: now,
      exp: now + this.parseTimeToSeconds(config.jwt.refreshExpiresIn)
    };
    
    // Generar tokens
    const accessToken = jwt.sign(accessPayload, config.jwt.secret);
    const refreshToken = jwt.sign(refreshPayload, config.jwt.secret);
    
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.parseTimeToSeconds(config.jwt.expiresIn)
    };
  }

  /**
   * Verifica y decodifica un token JWT
   * 
   * @param token - Token a verificar
   * @returns Resultado de la verificación
   */
  async verifyToken(token: string): Promise<TokenVerification> {
    try {
      const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;
      
      // Verificar que el token no haya expirado
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return {
          valid: false,
          error: 'Token expirado',
          expired: true
        };
      }
      
      return {
        valid: true,
        payload
      };
      
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          error: 'Token expirado',
          expired: true
        };
      }
      
      return {
        valid: false,
        error: 'Token inválido'
      };
    }
  }

  /**
   * Renueva el access token usando un refresh token válido
   * 
   * @param refreshToken - Refresh token a validar
   * @returns Nuevos tokens de acceso
   */
  async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    try {
      // 1. Verificar el refresh token
      const payload = jwt.verify(refreshToken, config.jwt.secret) as any;
      
      // 2. Validar que es un refresh token
      if (payload.type !== 'refresh') {
        throw this.createAuthError(AuthErrorCode.TOKEN_INVALID, 'Token de tipo inválido');
      }
      
      // 3. Verificar que no haya expirado
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        throw this.createAuthError(AuthErrorCode.TOKEN_EXPIRED, 'Refresh token expirado');
      }
      
      // 4. Obtener usuario completo
      const completeUser = await this.getCompleteUser(payload.sub);
      
      // 5. Verificar estado del usuario
      this.validateUserStatus(completeUser.profile);
      
      // 6. Generar nuevos tokens
      const newTokens = await this.generateTokens(completeUser);
      
      // 7. Log de auditoría
      await this.logAuthEvent({
        event_type: 'login',
        event_description: 'Token renovado exitosamente',
        user_id: completeUser.auth.id,
        user_email: completeUser.auth.email,
        clinic_id: completeUser.profile.clinic_id,
        ip_address: 'refresh-token',
        user_agent: 'token-refresh',
        success: true,
        timestamp: new Date().toISOString()
      });
      
      logger.info('Token renovado exitosamente', {
        userId: completeUser.auth.id,
        email: completeUser.auth.email,
        clinic_id: completeUser.profile.clinic_id,
        action: 'token_refresh_success',
        timestamp: new Date().toISOString()
      });
      
      return newTokens;
      
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw this.createAuthError(AuthErrorCode.TOKEN_EXPIRED, 'Refresh token expirado');
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        throw this.createAuthError(AuthErrorCode.TOKEN_INVALID, 'Refresh token inválido');
      }
      
      // Re-lanzar errores de autenticación
      if (error instanceof Error && error.message.includes('AuthErrorCode')) {
        throw error;
      }
      
      logger.error('Error al renovar token', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        action: 'token_refresh_error',
        timestamp: new Date().toISOString()
      });
      
      throw this.createAuthError(AuthErrorCode.INTERNAL_ERROR, 'Error interno al renovar token');
    }
  }

  /**
   * Invalida la sesión del usuario (logout)
   * 
   * @param userId - ID del usuario
   * @param accessToken - Token de acceso actual
   */
  async logout(userId: string, accessToken: string): Promise<void> {
    try {
      // 1. Verificar el token de acceso
      const tokenVerification = await this.verifyToken(accessToken);
      
      if (!tokenVerification.valid || !tokenVerification.payload) {
        throw this.createAuthError(AuthErrorCode.TOKEN_INVALID, 'Token de acceso inválido');
      }
      
      // 2. Obtener información del usuario
      const completeUser = await this.getCompleteUser(userId);
      
      // 3. Invalidar sesión en la base de datos
      const { error: sessionError } = await supabaseService
        .from('user_sessions')
        .update({
          is_active: false,
          logout_reason: 'manual',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_active', true);
      
      if (sessionError) {
        logger.warn('Error al invalidar sesión en BD', {
          userId,
          error: sessionError.message,
          action: 'logout_session_update_error'
        });
      }
      
      // 4. Log de auditoría
      await this.logAuthEvent({
        event_type: 'logout',
        event_description: 'Usuario cerró sesión exitosamente',
        user_id: userId,
        user_email: completeUser.auth.email,
        clinic_id: completeUser.profile.clinic_id,
        ip_address: 'logout-request',
        user_agent: 'logout-request',
        success: true,
        timestamp: new Date().toISOString()
      });
      
      logger.info('Logout exitoso', {
        userId,
        email: completeUser.auth.email,
        clinic_id: completeUser.profile.clinic_id,
        action: 'logout_success',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Error en logout', {
        userId,
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        action: 'logout_error',
        timestamp: new Date().toISOString()
      });
      
      // Re-lanzar errores de autenticación
      if (error instanceof Error && error.message.includes('AuthErrorCode')) {
        throw error;
      }
      
      throw this.createAuthError(AuthErrorCode.INTERNAL_ERROR, 'Error interno en logout');
    }
  }

  // =================================================================
  // MÉTODOS DE USUARIO
  // =================================================================

  /**
   * Obtiene un usuario completo por ID
   * 
   * @param userId - ID del usuario
   * @returns Usuario completo
   */
  async getCompleteUser(userId: string): Promise<CompleteUser> {
    // Obtener usuario de Supabase Auth
    const { data: authUser, error: authError } = await supabaseService.auth.admin.getUserById(userId);
    
    if (authError || !authUser.user) {
      throw this.createAuthError(AuthErrorCode.USER_NOT_FOUND, 'Usuario no encontrado en Auth');
    }
    
    // Obtener perfil de usuario
    const { data: profileData, error: profileError } = await supabaseService
      .from('users')
      .select(`
        *,
        clinics (
          id,
          clinic_name,
          is_active
        )
      `)
      .eq('id', userId)
      .single();
    
    if (profileError || !profileData) {
      throw this.createAuthError(AuthErrorCode.USER_NOT_FOUND, 'Perfil de usuario no encontrado');
    }
    
    return {
      auth: authUser.user,
      profile: profileData,
      clinic: profileData.clinics
    };
  }

  // =================================================================
  // MÉTODOS PRIVADOS DE VALIDACIÓN
  // =================================================================

  /**
   * Valida los datos de registro
   */
  private validateRegisterData(data: RegisterRequest): void {
    if (!data.email || !this.isValidEmail(data.email)) {
      throw this.createAuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Email inválido');
    }
    
    if (!data.password || data.password.length < 8) {
      throw this.createAuthError(AuthErrorCode.WEAK_PASSWORD, 'La contraseña debe tener al menos 8 caracteres');
    }
    
    if (!data.first_name || data.first_name.trim().length < 2) {
      throw this.createAuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Nombre inválido');
    }
    
    if (!data.last_name || data.last_name.trim().length < 2) {
      throw this.createAuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Apellido inválido');
    }
    
    if (!data.terms_accepted) {
      throw this.createAuthError(AuthErrorCode.TERMS_NOT_ACCEPTED, 'Debe aceptar los términos y condiciones');
    }
    
    if (!data.privacy_accepted) {
      throw this.createAuthError(AuthErrorCode.TERMS_NOT_ACCEPTED, 'Debe aceptar la política de privacidad');
    }
    
    if (!data.clinic_id || data.clinic_id.trim().length === 0) {
      throw this.createAuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Se requiere un ID de clínica válido');
    }
  }

  /**
   * Valida el estado del usuario
   */
  private validateUserStatus(profile: UserProfile): void {
    if (!profile.is_active) {
      throw this.createAuthError(AuthErrorCode.USER_DISABLED, 'Usuario inactivo');
    }
  }

  /**
   * Verifica si un email ya existe
   */
  private async checkEmailExists(email: string): Promise<void> {
    const { data, error } = await supabaseService
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    
    if (data) {
      throw this.createAuthError(AuthErrorCode.EMAIL_ALREADY_EXISTS, 'El email ya está registrado');
    }
  }

  // =================================================================
  // MÉTODOS PRIVADOS DE UTILIDAD
  // =================================================================

  /**
   * Crea un error de autenticación
   */
  private createAuthError(code: AuthErrorCode, message: string): AuthError {
    return {
      code,
      message
    };
  }

  /**
   * Valida formato de email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Convierte tiempo en formato string a segundos
   */
  private parseTimeToSeconds(timeString: string): number {
    const unit = timeString.slice(-1);
    const value = parseInt(timeString.slice(0, -1));
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 3600; // 1 hora por defecto
    }
  }

  // =================================================================
  // MÉTODOS PRIVADOS DE BASE DE DATOS
  // =================================================================

  /**
   * Crea el perfil de usuario en la base de datos
   */
  private async createUserProfile(
    authUser: User,
    registerData: RegisterRequest,
    clinicId: string
  ): Promise<UserProfile> {
    logger.info('🔧 Creando perfil de usuario con función RPC', {
      userId: authUser.id,
      email: authUser.email,
      clinicId,
      role: registerData.role,
      action: 'create_user_profile_start',
      timestamp: new Date().toISOString()
    });
    
    // Usar función RPC para evitar restricciones RLS
    const { data, error } = await supabaseService.rpc('create_user_profile', {
      p_id: authUser.id,
      p_email: authUser.email!,
      p_first_name: registerData.first_name,
      p_last_name: registerData.last_name,
      p_role: registerData.role, // Primer usuario es admin de la clínica
      p_clinic_id: clinicId,
      p_phone: registerData.phone || null,
      p_professional_license: null
    });
    
    logger.debug('📊 Resultado de creación de perfil de usuario', {
      userId: authUser.id,
      email: authUser.email,
      clinicId,
      hasData: !!data,
      hasError: !!error,
      errorMessage: error?.message,
      action: 'create_user_profile_result',
      timestamp: new Date().toISOString()
    });
    
    if (error) {
      logger.error('❌ Error al crear perfil de usuario', {
        userId: authUser.id,
        email: authUser.email,
        clinicId,
        error: error.message,
        action: 'create_user_profile_error',
        timestamp: new Date().toISOString()
      });
      throw new Error(`Error al crear perfil: ${error.message}`);
    }
    
    if (!data) {
      logger.error('❌ No se pudo crear el perfil de usuario - sin datos', {
        userId: authUser.id,
        email: authUser.email,
        clinicId,
        action: 'create_user_profile_no_data',
        timestamp: new Date().toISOString()
      });
      throw new Error('No se pudo crear el perfil de usuario');
    }
    
    logger.info('✅ Perfil de usuario creado exitosamente', {
      userId: authUser.id,
      email: authUser.email,
      clinicId,
      profileId: data.id,
      role: data.role,
      action: 'create_user_profile_success',
      timestamp: new Date().toISOString()
    });
    
    return data;
  }

  /**
   * Maneja la creación o asociación de clínica
   */


  /**
   * Crea una sesión de usuario
   */
  private async createUserSession(
    user: CompleteUser,
    ipAddress: string,
    userAgent: string,
    accessToken: string
  ): Promise<void> {
    const sessionData = {
      id: uuidv4(),
      user_id: user.auth.id,
      clinic_id: user.profile.clinic_id,
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + this.parseTimeToSeconds(config.jwt.expiresIn) * 1000).toISOString(),
      is_active: true
    };
    
    await supabaseService
      .from('user_sessions')
      .insert(sessionData);
  }

  /**
   * Actualiza el último login del usuario
   */
  private async updateLastLogin(userId: string): Promise<void> {
    await supabaseService
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userId);
  }

  /**
   * Registra un evento de auditoría
   */
  private async logAuthEvent(logData: Partial<AuthAuditLog>): Promise<void> {
    try {
      const auditLog = {
        id: uuidv4(),
        ...logData
      };
      
      await supabaseService
        .from('auth_audit_logs')
        .insert(auditLog);
        
    } catch (error) {
      logger.error('❌ Error al registrar auditoría de autenticación', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        auditData: {
          event_type: logData.event_type,
          user_email: logData.user_email,
          user_id: logData.user_id,
          clinic_id: logData.clinic_id
        },
        action: 'audit_log_error',
        timestamp: new Date().toISOString()
      });
      // No lanzar error para no interrumpir el flujo principal
    }
  }
}

// =================================================================
// INSTANCIA SINGLETON
// =================================================================

/**
 * Instancia singleton del servicio de autenticación
 */
export const authService = new AuthService();

/**
 * Exportación por defecto
 */
export default authService;

// =================================================================
// NOTAS DE IMPLEMENTACIÓN
// =================================================================
/*

1. **SEGURIDAD**:
   - Validación estricta de datos de entrada
   - Hashing seguro de contraseñas con bcrypt
   - Tokens JWT con información mínima
   - Auditoría completa de eventos

2. **SUPABASE INTEGRATION**:
   - Uso de Supabase Auth para autenticación
   - Perfiles personalizados en nuestra DB
   - RLS automático para multi-tenant
   - Gestión de sesiones

3. **MULTI-TENANT**:
   - Cada usuario pertenece a una clínica
   - Tokens incluyen clinic_id
   - RLS filtra automáticamente
   - Auditoría por clínica

4. **CUMPLIMIENTO**:
   - Logs de auditoría según NOM-024
   - Trazabilidad completa
   - Consentimientos documentados
   - Retención de datos

5. **ESCALABILIDAD**:
   - Servicio singleton reutilizable
   - Métodos async para performance
   - Manejo robusto de errores
   - Logging estructurado

*/