/**
 * =================================================================
 * CONFIGURACIÓN DE VARIABLES DE ENTORNO
 * =================================================================
 * 
 * Este archivo centraliza y valida todas las variables de entorno
 * necesarias para el funcionamiento del sistema de expedientes dentales.
 * 
 * PROPÓSITO:
 * 1. Validación temprana de configuración
 * 2. Tipado fuerte de variables de entorno
 * 3. Valores por defecto seguros
 * 4. Documentación de cada variable
 * 
 * =================================================================
 */

import dotenv from 'dotenv';
import logger from './logger';

// Cargar variables de entorno desde .env
dotenv.config();

// =================================================================
// INTERFACES Y TIPOS
// =================================================================

/**
 * Configuración completa de la aplicación
 * Todas las variables de entorno tipadas y validadas
 */
export interface AppConfig {
  // Configuración del servidor
  server: {
    port: number;
    environment: 'development' | 'production' | 'test';
    host: string;
  };
  
  // Configuración de Supabase
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  
  // Configuración de JWT
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  
  // Configuración de seguridad
  security: {
    bcryptRounds: number;
    corsOrigins: string[];
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };
  
  // Configuración de logging
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    enableSqlLogs: boolean;
  };
  
  // Configuración de archivos
  files: {
    maxSizeBytes: number;
    allowedImageTypes: string[];
    uploadPath: string;
  };
  
  // Configuración de cumplimiento normativo
  compliance: {
    enableAuditLogs: boolean;
    dataRetentionYears: number;
    enableEncryption: boolean;
  };
}

// =================================================================
// VALIDADORES
// =================================================================

/**
 * Valida que una variable de entorno esté presente
 */
function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `❌ Variable de entorno requerida faltante: ${name}\n` +
      `📝 Agrega esta variable a tu archivo .env\n` +
      `📋 Consulta .env.example para ver el formato correcto`
    );
  }
  return value;
}

/**
 * Obtiene una variable de entorno con valor por defecto
 */
function getEnvVar(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Convierte string a número con validación
 */
function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(
      `❌ Variable de entorno ${name} debe ser un número válido. ` +
      `Valor recibido: "${value}"`
    );
  }
  return parsed;
}

/**
 * Convierte string a boolean
 */
function getEnvBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  
  return value.toLowerCase() === 'true';
}

/**
 * Convierte string separado por comas a array
 */
function getEnvArray(name: string, defaultValue: string[]): string[] {
  const value = process.env[name];
  if (!value) return defaultValue;
  
  return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
}

/**
 * Valida el entorno de ejecución
 */
function validateEnvironment(env: string): 'development' | 'production' | 'test' {
  const validEnvs = ['development', 'production', 'test'];
  if (!validEnvs.includes(env)) {
    logger.warn('NODE_ENV inválido, usando development por defecto', {
      action: 'validate_environment',
      invalidEnv: env,
      defaultEnv: 'development',
      validEnvs: validEnvs,
      timestamp: new Date().toISOString()
    });
    return 'development';
  }
  return env as 'development' | 'production' | 'test';
}

/**
 * Valida formato de URL de Supabase
 */
function validateSupabaseUrl(url: string): string {
  if (!url.startsWith('https://')) {
    throw new Error(
      `❌ SUPABASE_URL debe comenzar con https://\n` +
      `Valor recibido: "${url}"`
    );
  }
  
  if (!url.includes('.supabase.co')) {
    throw new Error(
      `❌ SUPABASE_URL debe ser una URL válida de Supabase\n` +
      `Formato esperado: https://tu-proyecto.supabase.co\n` +
      `Valor recibido: "${url}"`
    );
  }
  
  return url;
}

/**
 * Valida que las claves de Supabase tengan el formato correcto
 */
function validateSupabaseKey(key: string, keyType: 'anon' | 'service'): string {
  if (key.length < 100) {
    throw new Error(
      `❌ ${keyType === 'anon' ? 'SUPABASE_ANON_KEY' : 'SUPABASE_SERVICE_ROLE_KEY'} ` +
      `parece ser inválida (muy corta)\n` +
      `Las claves de Supabase suelen tener más de 100 caracteres`
    );
  }
  
  // Validar prefijo esperado
  const expectedPrefix = keyType === 'anon' ? 'eyJ' : 'eyJ';
  if (!key.startsWith(expectedPrefix)) {
    logger.warn('Clave de Supabase no tiene el prefijo esperado', {
      action: 'validate_supabase_key',
      keyType: keyType === 'anon' ? 'SUPABASE_ANON_KEY' : 'SUPABASE_SERVICE_ROLE_KEY',
      expectedPrefix,
      timestamp: new Date().toISOString()
    });
  }
  
  return key;
}

// =================================================================
// CONFIGURACIÓN PRINCIPAL
// =================================================================

/**
 * Carga y valida toda la configuración de la aplicación
 */
function loadConfig(): AppConfig {
  logger.info('Cargando configuración de la aplicación', {
    action: 'load_config',
    step: 'start',
    timestamp: new Date().toISOString()
  });
  
  try {
    // Configuración del servidor
    const environment = validateEnvironment(getEnvVar('NODE_ENV', 'development'));
    const port = getEnvNumber('PORT', 3000);
    const host = getEnvVar('HOST', 'localhost');
    
    // Configuración de Supabase (requeridas)
    const supabaseUrl = validateSupabaseUrl(requireEnvVar('SUPABASE_URL'));
    const anonKey = validateSupabaseKey(requireEnvVar('SUPABASE_ANON_KEY'), 'anon');
    const serviceRoleKey = validateSupabaseKey(requireEnvVar('SUPABASE_SERVICE_ROLE_KEY'), 'service');
    
    // Configuración de JWT
    const jwtSecret = requireEnvVar('JWT_SECRET');
    if (jwtSecret.length < 32) {
      throw new Error(
        `❌ JWT_SECRET debe tener al menos 32 caracteres para ser seguro\n` +
        `Longitud actual: ${jwtSecret.length} caracteres`
      );
    }
    
    const jwtExpiresIn = getEnvVar('JWT_EXPIRES_IN', '24h');
    const jwtRefreshExpiresIn = getEnvVar('JWT_REFRESH_EXPIRES_IN', '7d');
    
    // Configuración de seguridad
    const bcryptRounds = getEnvNumber('BCRYPT_ROUNDS', 12);
    if (bcryptRounds < 10 || bcryptRounds > 15) {
      logger.warn('BCRYPT_ROUNDS fuera del rango recomendado', {
        action: 'validate_bcrypt_rounds',
        currentValue: bcryptRounds,
        recommendedRange: '10-15',
        timestamp: new Date().toISOString()
      });
    }
    
    const corsOrigins = getEnvArray('CORS_ORIGIN', ['http://localhost:3000']);
    const rateLimitWindowMs = getEnvNumber('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000); // 15 min
    const rateLimitMaxRequests = getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100);
    
    // Configuración de logging
    const logLevel = getEnvVar('LOG_LEVEL', 'info') as 'error' | 'warn' | 'info' | 'debug';
    const enableSqlLogs = getEnvBoolean('ENABLE_SQL_LOGS', environment === 'development');
    
    // Configuración de archivos
    const maxSizeBytes = getEnvNumber('MAX_FILE_SIZE_MB', 10) * 1024 * 1024; // Convertir MB a bytes
    const allowedImageTypes = getEnvArray('ALLOWED_IMAGE_TYPES', [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/dicom'
    ]);
    const uploadPath = getEnvVar('UPLOAD_PATH', './uploads');
    
    // Configuración de cumplimiento normativo
    const enableAuditLogs = getEnvBoolean('ENABLE_AUDIT_LOGS', true);
    const dataRetentionYears = getEnvNumber('DATA_RETENTION_YEARS', 5);
    const enableEncryption = getEnvBoolean('ENABLE_ENCRYPTION', environment === 'production');
    
    const config: AppConfig = {
      server: {
        port,
        environment,
        host
      },
      supabase: {
        url: supabaseUrl,
        anonKey,
        serviceRoleKey
      },
      jwt: {
        secret: jwtSecret,
        expiresIn: jwtExpiresIn,
        refreshExpiresIn: jwtRefreshExpiresIn
      },
      security: {
        bcryptRounds,
        corsOrigins,
        rateLimitWindowMs,
        rateLimitMaxRequests
      },
      logging: {
        level: logLevel,
        enableSqlLogs
      },
      files: {
        maxSizeBytes,
        allowedImageTypes,
        uploadPath
      },
      compliance: {
        enableAuditLogs,
        dataRetentionYears,
        enableEncryption
      }
    };
    
    // Mostrar resumen de configuración (sin datos sensibles)
    logger.info('Configuración cargada exitosamente', {
      action: 'load_config',
      environment: config.server.environment,
      port: config.server.port,
      supabaseUrl: config.supabase.url,
      corsOrigins: config.security.corsOrigins,
      logLevel: config.logging.level,
      auditEnabled: config.compliance.enableAuditLogs,
      timestamp: new Date().toISOString()
    });
    
    logger.info('Configuración validada correctamente', {
      action: 'validate_config',
      timestamp: new Date().toISOString()
    });
    return config;
    
  } catch (error) {
    logger.error('Error al cargar configuración', {
      action: 'load_config',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

// =================================================================
// EXPORTACIONES
// =================================================================

/**
 * Configuración global de la aplicación
 * Se carga una sola vez al importar este módulo
 */
export const config: AppConfig = loadConfig();

/**
 * Función para recargar configuración (útil en tests)
 */
export function reloadConfig(): AppConfig {
  // Limpiar cache de dotenv
  delete require.cache[require.resolve('dotenv')];
  
  // Recargar variables de entorno
  dotenv.config();
  
  // Retornar nueva configuración
  return loadConfig();
}

/**
 * Verifica si estamos en modo desarrollo
 */
export const isDevelopment = config.server.environment === 'development';

/**
 * Verifica si estamos en modo producción
 */
export const isProduction = config.server.environment === 'production';

/**
 * Verifica si estamos en modo test
 */
export const isTest = config.server.environment === 'test';

/**
 * Exportación por defecto
 */
export default config;

// =================================================================
// NOTAS DE IMPLEMENTACIÓN
// =================================================================
/*

1. **SEGURIDAD**:
   - Validación estricta de todas las variables críticas
   - No se exponen valores sensibles en logs
   - Valores por defecto seguros

2. **FLEXIBILIDAD**:
   - Valores por defecto para desarrollo
   - Configuración específica por entorno
   - Fácil override con variables de entorno

3. **VALIDACIÓN**:
   - Tipos fuertes para toda la configuración
   - Validación temprana al inicio de la aplicación
   - Mensajes de error descriptivos

4. **MANTENIBILIDAD**:
   - Configuración centralizada
   - Documentación inline
   - Fácil extensión para nuevas variables

5. **CUMPLIMIENTO**:
   - Configuración específica para normativas médicas
   - Auditoría y retención de datos configurable
   - Encriptación configurable por entorno

*/