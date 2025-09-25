/**
 * =================================================================
 * TIPOS DE AUTENTICACIÓN - SISTEMA EXPEDIENTES DENTALES
 * =================================================================
 * 
 * Este archivo define todos los tipos TypeScript relacionados con
 * la autenticación y autorización del sistema.
 * 
 * CONCEPTOS CLAVE:
 * 1. Usuario de Supabase Auth (autenticación)
 * 2. Perfil de usuario en nuestra DB (información adicional)
 * 3. Roles y permisos (autorización)
 * 4. Multi-tenant (clínicas)
 * 
 * =================================================================
 */

import { User as SupabaseUser } from '@supabase/supabase-js';

// =================================================================
// ENUMS Y CONSTANTES
// =================================================================

/**
 * Roles disponibles en el sistema
 * Cada rol tiene diferentes permisos
 */
export enum UserRole {
  // Administrador del sistema (super admin)
  SYSTEM_ADMIN = 'admin',
  
  // Administrador de clínica (owner)
  CLINIC_ADMIN = 'clinic_admin',
  
  // Doctor/Dentista
  DENTIST = 'dentist',
  
  // Asistente dental
  ASSISTANT = 'assistant',
  
  // Recepcionista
  RECEPTIONIST = 'receptionist',
  
  // Solo lectura (para reportes, auditorías)
  VIEWER = 'viewer'
}

/**
 * Estados de usuario
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification'
}

/**
 * Tipos de autenticación soportados
 */
export enum AuthProvider {
  EMAIL = 'email',
  GOOGLE = 'google',
  APPLE = 'apple'
}

// =================================================================
// INTERFACES DE USUARIO
// =================================================================

/**
 * Perfil de usuario en nuestra base de datos
 * Extiende la información básica de Supabase Auth
 */
export interface UserProfile {
  id: string; // UUID del usuario (mismo que Supabase Auth)
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string;
  
  // Información profesional
  professional_license?: string; // Cédula profesional
  specialties?: string[]; // Especialidades médicas
  
  // Relación con clínica
  clinic_id: string; // ID de la clínica (multi-tenant)
  role: UserRole;
  is_active: boolean;
  
  // Configuración personal
  language: string; // 'es' | 'en'
  timezone: string; // 'America/Mexico_City'
  
  // Metadatos
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  
  // Cumplimiento normativo
  terms_accepted_at?: string;
  privacy_accepted_at?: string;
}

/**
 * Usuario completo (Supabase + nuestro perfil)
 */
export interface CompleteUser {
  // Datos de Supabase Auth
  auth: SupabaseUser;
  
  // Nuestro perfil personalizado
  profile: UserProfile;
  
  // Información de la clínica
  clinic: {
    id: string;
    clinic_name: string;
    is_active: boolean;
  };
}

// =================================================================
// INTERFACES DE AUTENTICACIÓN
// =================================================================

/**
 * Datos para registro de usuario
 */
export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: UserRole;
  
  // ID de la clínica existente a la que se unirá el usuario
  clinic_id: string;
  
  // Términos y condiciones
  terms_accepted: boolean;
  privacy_accepted: boolean;
}

/**
 * Datos para login
 */
export interface LoginRequest {
  email: string;
  password: string;
  remember_me?: boolean;
}

/**
 * Respuesta de autenticación exitosa
 */
export interface AuthResponse {
  user: CompleteUser;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

/**
 * Datos para cambio de contraseña
 */
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

/**
 * Datos para recuperación de contraseña
 */
export interface ForgotPasswordRequest {
  email: string;
}

/**
 * Datos para reset de contraseña
 */
export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

/**
 * Datos para actualización de perfil
 */
export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
  language?: string;
  timezone?: string;
  specialties?: string[];
}

// =================================================================
// INTERFACES DE AUTORIZACIÓN
// =================================================================

/**
 * Permisos del sistema
 */
export interface Permission {
  resource: string; // 'patients', 'appointments', 'medical_records', etc.
  action: string;   // 'create', 'read', 'update', 'delete'
  conditions?: Record<string, any>; // Condiciones adicionales
}

/**
 * Contexto de autorización
 */
export interface AuthContext {
  user: CompleteUser;
  clinic_id: string;
  permissions: Permission[];
  session_id: string;
}

/**
 * Configuración de roles y permisos
 */
export interface RolePermissions {
  [UserRole.SYSTEM_ADMIN]: Permission[];
  [UserRole.CLINIC_ADMIN]: Permission[];
  [UserRole.DENTIST]: Permission[];
  [UserRole.ASSISTANT]: Permission[];
  [UserRole.RECEPTIONIST]: Permission[];
  [UserRole.VIEWER]: Permission[];
}

// =================================================================
// INTERFACES DE JWT
// =================================================================

/**
 * Payload del JWT token
 */
export interface JWTPayload {
  // Información del usuario
  sub: string; // User ID
  email: string;
  role: UserRole;
  clinic_id: string;
  
  // Metadatos del token
  iat: number; // Issued at
  exp: number; // Expires at
  iss: string; // Issuer
  aud: string; // Audience
  
  // Información adicional
  session_id: string;
  permissions?: string[]; // Lista de permisos codificados
}

/**
 * Datos para verificación de token
 */
export interface TokenVerification {
  valid: boolean;
  payload?: JWTPayload;
  error?: string;
  expired?: boolean;
}

// =================================================================
// INTERFACES DE SESIÓN
// =================================================================

/**
 * Información de sesión activa
 */
export interface UserSession {
  id: string;
  user_id: string;
  clinic_id: string;
  
  // Información de la sesión
  ip_address: string;
  user_agent: string;
  device_info?: {
    type: 'desktop' | 'mobile' | 'tablet';
    os: string;
    browser: string;
  };
  
  // Timestamps
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  
  // Estado
  is_active: boolean;
  logout_reason?: 'manual' | 'timeout' | 'security' | 'admin';
}

// =================================================================
// INTERFACES DE AUDITORÍA
// =================================================================

/**
 * Log de auditoría para autenticación
 * Cumple con NOM-024-SSA3-2012
 */
export interface AuthAuditLog {
  id: string;
  
  // Información del evento
  event_type: 'login' | 'logout' | 'register' | 'password_change' | 'profile_update' | 'permission_change';
  event_description: string;
  
  // Información del usuario
  user_id?: string;
  user_email?: string;
  clinic_id?: string;
  
  // Información técnica
  ip_address: string;
  user_agent: string;
  session_id?: string;
  
  // Resultado del evento
  success: boolean;
  error_message?: string;
  
  // Metadatos
  timestamp: string;
  additional_data?: Record<string, any>;
}

// =================================================================
// TIPOS DE UTILIDAD
// =================================================================

/**
 * Tipo para requests que requieren autenticación
 */
export interface AuthenticatedRequest {
  user: CompleteUser;
  session: UserSession;
  permissions: Permission[];
}

/**
 * Tipo para respuestas de error de autenticación
 */
export interface AuthError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * Códigos de error de autenticación
 */
export enum AuthErrorCode {
  // Errores de autenticación
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_DISABLED = 'USER_DISABLED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  
  // Errores de autorización
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  CLINIC_ACCESS_DENIED = 'CLINIC_ACCESS_DENIED',
  ROLE_NOT_AUTHORIZED = 'ROLE_NOT_AUTHORIZED',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  
  // Errores de token
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_MISSING = 'TOKEN_MISSING',
  
  // Errores de sesión
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_INVALID = 'SESSION_INVALID',
  CONCURRENT_SESSION_LIMIT = 'CONCURRENT_SESSION_LIMIT',
  
  // Errores de registro
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  TERMS_NOT_ACCEPTED = 'TERMS_NOT_ACCEPTED',
  
  // Errores generales
  INVALID_REQUEST = 'INVALID_REQUEST',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

// =================================================================
// EXPORTACIONES DE TIPOS ÚTILES
// =================================================================

/**
 * Tipo para middleware de autenticación
 */
export type AuthMiddleware = (
  req: any,
  res: any,
  next: any
) => Promise<void> | void;

/**
 * Tipo para funciones de validación de permisos
 */
export type PermissionValidator = (
  user: CompleteUser,
  resource: string,
  action: string,
  context?: Record<string, any>
) => boolean;

/**
 * Tipo para handlers de autenticación
 */
export type AuthHandler = (
  req: any,
  res: any
) => Promise<void>;

// =================================================================
// NOTAS DE IMPLEMENTACIÓN
// =================================================================
/*

1. **MULTI-TENANT**:
   - Todos los usuarios pertenecen a una clínica (clinic_id)
   - RLS en Supabase filtra automáticamente por clinic_id
   - Los permisos se evalúan dentro del contexto de la clínica

2. **ROLES Y PERMISOS**:
   - Sistema basado en roles (RBAC)
   - Cada rol tiene permisos predefinidos
   - Permisos granulares por recurso y acción
   - Condiciones adicionales para casos especiales

3. **SEGURIDAD**:
   - Tokens JWT con información mínima necesaria
   - Sesiones rastreadas para auditoría
   - Logs de auditoría para cumplimiento normativo
   - Validación estricta de permisos

4. **CUMPLIMIENTO**:
   - Auditoría según NOM-024-SSA3-2012
   - Trazabilidad completa de acciones
   - Retención de logs según normativa
   - Consentimientos documentados

5. **ESCALABILIDAD**:
   - Tipos extensibles para nuevos roles
   - Permisos configurables
   - Soporte para múltiples proveedores de auth
   - Sesiones distribuidas

*/